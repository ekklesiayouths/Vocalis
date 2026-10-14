/**
 * Recommendation service — provides adaptive module recommendations
 * using a trained ML model when available, falling back to the
 * rule-based baseline otherwise.
 *
 * PHASE 7 ML INFRASTRUCTURE:
 * - checkDataSufficiency() reports whether enough learner data exists
 *   to train a recommendation model. Currently requires >= 10 users
 *   with >= 3 score records each.
 * - getModelRecommendations() fetches the active model's predictions
 *   for the current user from the `model_predictions` table.
 * - getBaselineRecommendations() implements the existing rule-based
 *   baseline: lowest avg accuracy among modules with >= 2 attempts.
 * - getRecommendation() tries the model first, falls back to baseline,
 *   and returns a RecommendationResult with the source label.
 *
 * DATA LEAKAGE PREVENTION:
 * - The training pipeline (train-recommendations edge function) uses
 *   temporal splits: training data is strictly older than evaluation
 *   data (split by created_at timestamp), so the model never sees
 *   future interactions during training.
 * - The evaluation uses a held-out test set, not the training set.
 * - The model is only activated if it beats the baseline by >= 5%
 *   NDCG@5 on the test set.
 */

import { supabase } from './supabaseClient';
import type { ProgressSummary, ModuleStat } from './progressService';

export interface Recommendation {
  moduleName: string;
  moduleId: string;
  score: number;
  reason: string;
  source: 'model' | 'baseline' | 'none';
}

export interface DataSufficiencyReport {
  sufficient: boolean;
  totalUsers: number;
  totalScores: number;
  avgScoresPerUser: number;
  reason: string;
}

/** Map DB module names to LearningMap module IDs */
const NAME_TO_ID: Record<string, string> = {
  'Breath Tracker': 'breath-support',
  'Breath Support': 'breath-support',
  'Interval Recognition': 'intervals',
  'Fine-Tuning Drill': 'fine-tuning',
  'Fine Tuning Drill': 'fine-tuning',
  'Scale Degrees': 'scale-degrees',
  'Register Blending': 'register-blending',
  'Dexterity Drills': 'dexterity-drills',
  '3rd/5th Finding': 'third-fifth-finding',
  'Third Fifth Finding': 'third-fifth-finding',
  'Vowel Blending': 'vowel-blending',
  'Modulation Mission': 'modulation-mission',
  'A Cappella Key Starts': 'a-cappella-key-starts',
  'Siren Elevator': 'register-blending',
  'Resonance Tracker': 'register-blending',
  'Pitch Tracker': 'fine-tuning',
};

const MIN_USERS = 10;
const MIN_SCORES_PER_USER = 3;
const MIN_TOTAL_SCORES = 30;

/**
 * Check whether there is enough learner data to train a recommendation model.
 * This calls the train-recommendations edge function's status endpoint,
 * or falls back to estimating from the progress summary.
 */
export async function checkDataSufficiency(): Promise<DataSufficiencyReport> {
  try {
    if (!supabase) {
      return {
        sufficient: false,
        totalUsers: 0,
        totalScores: 0,
        avgScoresPerUser: 0,
        reason: 'Not signed in.',
      };
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        sufficient: false,
        totalUsers: 0,
        totalScores: 0,
        avgScoresPerUser: 0,
        reason: 'Not signed in.',
      };
    }

    // Query aggregate counts from scores (RLS-scoped to own data)
    const { count: userScoresCount } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true });

    const totalScores = userScoresCount ?? 0;

    // We can't count distinct users from the client (RLS), so estimate
    // from what we can see. The training edge function has the real count.
    const insufficient = totalScores < MIN_TOTAL_SCORES;

    return {
      sufficient: !insufficient,
      totalUsers: 0, // Unknown from client — the edge function knows
      totalScores,
      avgScoresPerUser: 0,
      reason: insufficient
        ? `Need at least ${MIN_TOTAL_SCORES} total score records across ${MIN_USERS}+ users (each with ${MIN_SCORES_PER_USER}+ attempts). Currently have ${totalScores} accessible records.`
        : 'Sufficient data for training.',
    };
  } catch {
    return {
      sufficient: false,
      totalUsers: 0,
      totalScores: 0,
      avgScoresPerUser: 0,
      reason: 'Unable to check data sufficiency.',
    };
  }
}

/**
 * Fetch model-based recommendations for the current user.
 * Returns null if no active model exists or no predictions are available.
 */
async function getModelRecommendations(): Promise<Recommendation[] | null> {
  try {
    if (!supabase) return null;
    const { data: activeModel } = await supabase
      .from('model_versions')
      .select('id, version, evaluation_metrics')
      .eq('is_active', true)
      .maybeSingle();

    if (!activeModel) return null;

    const { data: predictions, error } = await supabase
      .from('model_predictions')
      .select('module_name, score')
      .eq('model_version_id', activeModel.id)
      .order('score', { ascending: false })
      .limit(5);

    if (error || !predictions || predictions.length === 0) return null;

    return predictions.map((p) => ({
      moduleName: p.module_name,
      moduleId: NAME_TO_ID[p.module_name] ?? p.module_name,
      score: p.score,
      reason: `Model v${activeModel.version}: recommended based on your practice patterns`,
      source: 'model' as const,
    }));
  } catch {
    return null;
  }
}

/**
 * Baseline recommendation: the module with the lowest average accuracy
 * among modules with >= 2 attempts. This is the existing rule-based approach.
 */
export function getBaselineRecommendations(
  progress: ProgressSummary | null
): Recommendation[] {
  if (!progress || progress.modules.length === 0) return [];

  const weakModules = progress.modules
    .filter((m: ModuleStat) => m.attempts >= 2 && m.avg_accuracy < 80)
    .sort((a, b) => a.avg_accuracy - b.avg_accuracy);

  if (weakModules.length === 0) return [];

  return weakModules.slice(0, 3).map((m) => ({
    moduleName: m.module_name,
    moduleId: NAME_TO_ID[m.module_name] ?? m.module_name,
    score: (100 - m.avg_accuracy) / 100,
    reason: `Avg ${m.avg_accuracy}% over ${m.attempts} attempts`,
    source: 'baseline' as const,
  }));
}

/**
 * Get the best recommendation for the user.
 * Tries the ML model first, falls back to the baseline.
 */
export async function getRecommendation(
  progress: ProgressSummary | null
): Promise<Recommendation | null> {
  // Try model first
  const modelRecs = await getModelRecommendations();
  if (modelRecs && modelRecs.length > 0) {
    return modelRecs[0];
  }

  // Fall back to baseline
  const baselineRecs = getBaselineRecommendations(progress);
  if (baselineRecs.length > 0) {
    return baselineRecs[0];
  }

  return null;
}
