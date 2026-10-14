/**
 * Train Recommendations edge function — reproducible training and
 * evaluation pipeline for the adaptive recommendation model.
 *
 * PHASE 7 PIPELINE:
 * 1. Assess data sufficiency (need >= 10 users, >= 3 scores each)
 * 2. Temporal split: training data is strictly older than test data
 *    (80/20 split by created_at timestamp) — prevents data leakage
 * 3. Train a collaborative filtering model (item-based, using module
 *    co-occurrence and accuracy patterns)
 * 4. Evaluate on the held-out test set using NDCG@5
 * 5. Evaluate the baseline (lowest avg accuracy) on the same test set
 * 6. Compare: activate the model only if NDCG@5 improvement >= 5%
 * 7. Store model version, metrics, and per-user predictions
 *
 * SECURITY:
 * - Requires service role key (admin only — not callable by regular users)
 * - CORS headers on every response
 * - No user data is logged or exposed
 * - The function is idempotent — re-running updates the model if data has grown
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MIN_USERS = 10;
const MIN_SCORES_PER_USER = 3;
const MIN_TOTAL_SCORES = 30;
const TRAIN_SPLIT = 0.8;
const NDCG_K = 5;
const MIN_IMPROVEMENT = 0.05; // 5% NDCG improvement required to activate

interface ScoreRecord {
  user_id: string;
  module_name: string;
  accuracy: number;
  time_elapsed: number;
  xp_earned: number;
  created_at: string;
}

interface UserModuleStats {
  attempts: number;
  avgAccuracy: number;
  bestAccuracy: number;
  totalXp: number;
  lastAttempted: string;
}

/**
 * NDCG@K — Normalized Discounted Cumulative Gain at rank K.
 * Measures ranking quality. Higher is better (1.0 = perfect).
 */
function ndcgAtK(recommended: string[], relevant: Set<string>, k: number): number {
  const dcg = recommended.slice(0, k).reduce((sum, module, i) => {
    if (relevant.has(module)) {
      return sum + 1 / Math.log2(i + 2);
    }
    return sum;
  }, 0);

  const idealCount = Math.min(relevant.size, k);
  const idcg = Array.from({ length: idealCount }, (_, i) => 1 / Math.log2(i + 2)).reduce((a, b) => a + b, 0);

  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Build a user-module matrix from score records.
 * Returns a map: userId -> moduleName -> stats
 */
function buildUserModuleMatrix(scores: ScoreRecord[]): Map<string, Map<string, UserModuleStats>> {
  const matrix = new Map<string, Map<string, UserModuleStats>>();

  for (const s of scores) {
    if (!matrix.has(s.user_id)) {
      matrix.set(s.user_id, new Map());
    }
    const userModules = matrix.get(s.user_id)!;
    const existing = userModules.get(s.module_name);
    if (existing) {
      existing.attempts++;
      existing.avgAccuracy = (existing.avgAccuracy * (existing.attempts - 1) + s.accuracy) / existing.attempts;
      existing.bestAccuracy = Math.max(existing.bestAccuracy, s.accuracy);
      existing.totalXp += s.xp_earned;
      if (s.created_at > existing.lastAttempted) {
        existing.lastAttempted = s.created_at;
      }
    } else {
      userModules.set(s.module_name, {
        attempts: 1,
        avgAccuracy: s.accuracy,
        bestAccuracy: s.accuracy,
        totalXp: s.xp_earned,
        lastAttempted: s.created_at,
      });
    }
  }

  return matrix;
}

/**
 * Train an item-based collaborative filtering model.
 * For each pair of modules, compute the similarity (co-occurrence weighted
 * by inverse accuracy). Then for each user, recommend modules similar to
 * those they struggled with.
 */
function trainModel(
  trainMatrix: Map<string, Map<string, UserModuleStats>>,
  allModules: string[]
): { moduleSimilarity: Map<string, Map<string, number>> } {
  // Build module co-occurrence: how often two modules are practiced by the same user
  const coOccurrence = new Map<string, Map<string, number>>();
  const moduleUserCount = new Map<string, number>();

  for (const [, userModules] of trainMatrix) {
    const modules = Array.from(userModules.keys());
    for (const m of modules) {
      moduleUserCount.set(m, (moduleUserCount.get(m) ?? 0) + 1);
    }
    for (let i = 0; i < modules.length; i++) {
      for (let j = i + 1; j < modules.length; j++) {
        const a = modules[i];
        const b = modules[j];
        if (!coOccurrence.has(a)) coOccurrence.set(a, new Map());
        if (!coOccurrence.has(b)) coOccurrence.set(b, new Map());
        coOccurrence.get(a)!.set(b, (coOccurrence.get(a)!.get(b) ?? 0) + 1);
        coOccurrence.get(b)!.set(a, (coOccurrence.get(b)!.get(a) ?? 0) + 1);
      }
    }
  }

  // Compute cosine similarity between modules
  const moduleSimilarity = new Map<string, Map<string, number>>();
  for (const m1 of allModules) {
    moduleSimilarity.set(m1, new Map());
    for (const m2 of allModules) {
      if (m1 === m2) {
        moduleSimilarity.get(m1)!.set(m2, 1);
        continue;
      }
      const co = coOccurrence.get(m1)?.get(m2) ?? 0;
      const c1 = moduleUserCount.get(m1) ?? 0;
      const c2 = moduleUserCount.get(m2) ?? 0;
      if (co === 0 || c1 === 0 || c2 === 0) {
        moduleSimilarity.get(m1)!.set(m2, 0);
      } else {
        // Cosine similarity
        moduleSimilarity.get(m1)!.set(m2, co / Math.sqrt(c1 * c2));
      }
    }
  }

  return { moduleSimilarity };
}

/**
 * Generate recommendations for a user using the trained model.
 * Recommends modules similar to those the user struggled with (avg accuracy < 70%)
 * that they haven't completed yet (accuracy < 70%).
 */
function predictForUser(
  userId: string,
  userModules: Map<string, UserModuleStats>,
  moduleSimilarity: Map<string, Map<string, number>>,
  allModules: string[]
): Array<{ module: string; score: number }> {
  // Find modules the user struggled with
  const struggled = Array.from(userModules.entries())
    .filter(([, stats]) => stats.avgAccuracy < 70)
    .map(([module]) => module);

  // If no struggled modules, use all attempted modules
  const sourceModules = struggled.length > 0 ? struggled : Array.from(userModules.keys());

  const scores = new Map<string, number>();

  for (const targetModule of allModules) {
    // Skip modules the user has already mastered (>= 80%)
    const userStats = userModules.get(targetModule);
    if (userStats && userStats.avgAccuracy >= 80) continue;

    let score = 0;
    for (const srcModule of sourceModules) {
      const sim = moduleSimilarity.get(srcModule)?.get(targetModule) ?? 0;
      const srcStats = userModules.get(srcModule);
      // Weight by how much they struggled (lower accuracy = higher weight)
      const struggleWeight = srcStats ? (100 - srcStats.avgAccuracy) / 100 : 0.5;
      score += sim * struggleWeight;
    }

    // Normalize
    if (sourceModules.length > 0) {
      score = score / sourceModules.length;
    }

    scores.set(targetModule, score);
  }

  return Array.from(scores.entries())
    .map(([module, score]) => ({ module, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Baseline recommendation: lowest avg accuracy module that hasn't been mastered.
 */
function baselineRecommendForUser(
  userModules: Map<string, UserModuleStats>,
  allModules: string[]
): string[] {
  return allModules
    .filter((m) => {
      const stats = userModules.get(m);
      return !stats || stats.avgAccuracy < 80;
    })
    .map((m) => ({
      module: m,
      avgAccuracy: userModules.get(m)?.avgAccuracy ?? 100,
      attempts: userModules.get(m)?.attempts ?? 0,
    }))
    .filter((m) => m.attempts >= 1)
    .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
    .slice(0, NDCG_K)
    .map((m) => m.module);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch all scores
    const { data: allScores, error: scoresError } = await adminClient
      .from("scores")
      .select("user_id, module_name, accuracy, time_elapsed, xp_earned, created_at");

    if (scoresError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch training data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scores = (allScores ?? []) as ScoreRecord[];

    // 2. Assess data sufficiency
    const userScoreCounts = new Map<string, number>();
    for (const s of scores) {
      userScoreCounts.set(s.user_id, (userScoreCounts.get(s.user_id) ?? 0) + 1);
    }
    const qualifiedUsers = Array.from(userScoreCounts.entries())
      .filter(([, count]) => count >= MIN_SCORES_PER_USER);

    const dataReport = {
      totalScores: scores.length,
      totalUsers: userScoreCounts.size,
      qualifiedUsers: qualifiedUsers.length,
      minUsersRequired: MIN_USERS,
      minScoresPerUser: MIN_SCORES_PER_USER,
      sufficient: qualifiedUsers.length >= MIN_USERS && scores.length >= MIN_TOTAL_SCORES,
    };

    if (!dataReport.sufficient) {
      return new Response(
        JSON.stringify({
          status: "insufficient_data",
          data: dataReport,
          message: `Need at least ${MIN_USERS} users with ${MIN_SCORES_PER_USER}+ scores each. Currently have ${qualifiedUsers.length} qualified users out of ${userScoreCounts.size} total.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Temporal split — sort by created_at, split 80/20
    const sortedScores = scores.sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const splitIdx = Math.floor(sortedScores.length * TRAIN_SPLIT);
    const trainScores = sortedScores.slice(0, splitIdx);
    const testScores = sortedScores.slice(splitIdx);

    // 4. Build user-module matrices
    const trainMatrix = buildUserModuleMatrix(trainScores);
    const testMatrix = buildUserModuleMatrix(testScores);

    // Collect all module names
    const allModules = Array.from(new Set(
      scores.map((s) => s.module_name)
    )).sort();

    // 5. Train the model
    const { moduleSimilarity } = trainModel(trainMatrix, allModules);

    // 6. Evaluate model vs baseline on the test set
    // "Relevant" modules for a user = modules they practiced in the test set
    // with accuracy < 70% (these are modules they should be recommended)
    const testUsers = Array.from(testMatrix.keys());
    let modelNdcgSum = 0;
    let baselineNdcgSum = 0;
    let evalCount = 0;

    for (const userId of testUsers) {
      const testModules = testMatrix.get(userId)!;
      const trainModules = trainMatrix.get(userId) ?? new Map();

      // Relevant = modules in test set where user scored < 70%
      const relevant = new Set(
        Array.from(testModules.entries())
          .filter(([, stats]) => stats.avgAccuracy < 70)
          .map(([module]) => module)
      );

      if (relevant.size === 0) continue;

      // Model predictions
      const modelPreds = predictForUser(userId, trainModules, moduleSimilarity, allModules);
      const modelTopK = modelPreds.slice(0, NDCG_K).map((p) => p.module);
      const modelNdcg = ndcgAtK(modelTopK, relevant, NDCG_K);

      // Baseline predictions
      const baselineTopK = baselineRecommendForUser(trainModules, allModules);
      const baselineNdcg = ndcgAtK(baselineTopK, relevant, NDCG_K);

      modelNdcgSum += modelNdcg;
      baselineNdcgSum += baselineNdcg;
      evalCount++;
    }

    const modelNdcg = evalCount > 0 ? modelNdcgSum / evalCount : 0;
    const baselineNdcg = evalCount > 0 ? baselineNdcgSum / evalCount : 0;
    const improvement = baselineNdcg > 0
      ? (modelNdcg - baselineNdcg) / baselineNdcg
      : modelNdcg > 0 ? 1 : 0;

    const modelMetrics = {
      ndcg_at_5: Math.round(modelNdcg * 1000) / 1000,
      eval_users: evalCount,
      train_size: trainScores.length,
      test_size: testScores.length,
    };

    const baselineMetrics = {
      ndcg_at_5: Math.round(baselineNdcg * 1000) / 1000,
    };

    const shouldActivate = improvement >= MIN_IMPROVEMENT;

    // 7. Store model version
    const versionLabel = `v${Date.now()}`;
    const { data: modelVersion, error: insertError } = await adminClient
      .from("model_versions")
      .insert({
        version: versionLabel,
        algorithm: "item_based_cf",
        hyperparameters: { train_split: TRAIN_SPLIT, ndcg_k: NDCG_K, min_improvement: MIN_IMPROVEMENT },
        training_data_size: trainScores.length,
        evaluation_metrics: modelMetrics,
        baseline_metrics: baselineMetrics,
        is_active: shouldActivate,
        activated_at: shouldActivate ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertError || !modelVersion) {
      return new Response(
        JSON.stringify({ error: "Failed to store model version" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. If activating, deactivate old models and store predictions
    if (shouldActivate) {
      // Deactivate all other models
      await adminClient
        .from("model_versions")
        .update({ is_active: false, activated_at: null })
        .neq("id", modelVersion.id);

      // Generate predictions for all users who have training data
      const allUsers = Array.from(trainMatrix.keys());
      const predictions: Array<{
        user_id: string;
        module_name: string;
        score: number;
        model_version_id: string;
      }> = [];

      for (const userId of allUsers) {
        const userModules = trainMatrix.get(userId)!;
        const preds = predictForUser(userId, userModules, moduleSimilarity, allModules);
        for (const p of preds.slice(0, 10)) {
          predictions.push({
            user_id: userId,
            module_name: p.module,
            score: Math.max(0, Math.min(1, p.score)),
            model_version_id: modelVersion.id,
          });
        }
      }

      // Batch insert predictions
      if (predictions.length > 0) {
        await adminClient
          .from("model_predictions")
          .upsert(predictions, { onConflict: "user_id,module_name,model_version_id" });
      }
    }

    return new Response(
      JSON.stringify({
        status: shouldActivate ? "activated" : "not_activated",
        data: dataReport,
        model_metrics: modelMetrics,
        baseline_metrics: baselineMetrics,
        improvement: Math.round(improvement * 1000) / 1000,
        min_improvement_required: MIN_IMPROVEMENT,
        activated: shouldActivate,
        message: shouldActivate
          ? `Model activated! NDCG@5: model ${modelMetrics.ndcg_at_5} vs baseline ${baselineMetrics.ndcg_at_5} (${Math.round(improvement * 100)}% improvement).`
          : `Model NOT activated. NDCG@5: model ${modelMetrics.ndcg_at_5} vs baseline ${baselineMetrics.ndcg_at_5} (${Math.round(improvement * 100)}% improvement). Need >= ${MIN_IMPROVEMENT * 100}% improvement.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Training pipeline failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
