/**
 * Progress tracking service — fetches score history and submits detailed
 * exercise attempts for the adaptive recommendation engine.
 *
 * SECURITY: All data is scoped to the authenticated user via RLS.
 * get_progress_summary is a SECURITY DEFINER RPC that reads the user's
 * own rows. Exercise attempts are inserted directly with RLS enforcing
 * ownership via auth.uid() = user_id.
 */

import { supabase } from './supabaseClient';

export interface ModuleStat {
  module_name: string;
  attempts: number;
  best_accuracy: number;
  avg_accuracy: number;
  last_attempted: string;
}

export interface RecentActivity {
  module_name: string;
  accuracy: number;
  xp_earned: number;
  created_at: string;
}

export interface ProgressSummary {
  xp: number;
  level: number;
  streak_days: number;
  modules: ModuleStat[];
  recent_activity: RecentActivity[];
  error?: string;
}

export interface AttemptSubmissionResult {
  success: boolean;
  error?: string;
}

/**
 * Fetch the authenticated user's progress summary from the server.
 * Returns null if the user is not signed in (no auth session).
 */
export async function getProgress(): Promise<ProgressSummary | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase.rpc('get_progress_summary');

  if (error) {
    return {
      xp: 0,
      level: 1,
      streak_days: 0,
      modules: [],
      recent_activity: [],
      error: error.message,
    };
  }

  if (!data || typeof data !== 'object') {
    return {
      xp: 0,
      level: 1,
      streak_days: 0,
      modules: [],
      recent_activity: [],
      error: 'Invalid response from server',
    };
  }

  const result = data as Record<string, unknown>;

  if (result.error) {
    return {
      xp: 0,
      level: 1,
      streak_days: 0,
      modules: [],
      recent_activity: [],
      error: String(result.error),
    };
  }

  return {
    xp: result.xp as number ?? 0,
    level: result.level as number ?? 1,
    streak_days: result.streak_days as number ?? 0,
    modules: (result.modules as ModuleStat[]) ?? [],
    recent_activity: (result.recent_activity as RecentActivity[]) ?? [],
  };
}

/**
 * Submit a detailed exercise attempt record. This is called after a
 * successful submitScore() call to store richer per-attempt data.
 */
export async function submitAttempt(
  moduleName: string,
  accuracy: number,
  timeElapsedSeconds: number,
  xpEarned: number,
  pitchMatchRatio?: number,
  metadata?: Record<string, unknown>
): Promise<AttemptSubmissionResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { success: false, error: 'Not signed in' };
  }

  const { error } = await supabase.from('exercise_attempts').insert({
    module_name: moduleName,
    accuracy: Math.max(0, Math.min(100, Math.round(accuracy))),
    time_elapsed_seconds: Math.max(0, Math.round(timeElapsedSeconds)),
    xp_earned: Math.max(0, Math.round(xpEarned)),
    pitch_match_ratio: pitchMatchRatio != null ? Math.max(0, Math.min(1, pitchMatchRatio)) : null,
    metadata: metadata ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get the best accuracy for a specific module from the progress summary.
 * Returns 0 if the module has no attempts yet.
 */
export function getBestAccuracy(summary: ProgressSummary | null, moduleName: string): number {
  if (!summary) return 0;
  const stat = summary.modules.find((m) => m.module_name === moduleName);
  return stat?.best_accuracy ?? 0;
}

/**
 * Get the number of attempts for a specific module.
 */
export function getAttemptCount(summary: ProgressSummary | null, moduleName: string): number {
  if (!summary) return 0;
  const stat = summary.modules.find((m) => m.module_name === moduleName);
  return stat?.attempts ?? 0;
}
