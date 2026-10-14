/**
 * Score submission service.
 *
 * SECURITY: Score payloads are validated on the client first (defense in
 * depth) and then submitted through the `submit_score` RPC, which runs as
 * a SECURITY DEFINER function on the server. The server re-validates and
 * clamps all values, computes XP independently, and inserts using the
 * authenticated user's ID from auth.uid() — the client cannot spoof the
 * user ID, inflate accuracy, or inflate XP.
 *
 * ANTI-TAMPER: The server-side RPC clamps accuracy to [0, 100], requires
 * positive time_elapsed, and caps it at 86400 seconds. XP is computed
 * entirely server-side. Even if a user modifies the browser console to
 * call supabase.rpc with crafted values, the server enforces the limits.
 */

import { supabase } from './supabaseClient';
import { validateAccuracy, validateModuleName, validateTimeElapsed } from './validation';

export interface ScoreSubmissionResult {
  success: boolean;
  scoreId?: string;
  accuracy?: number;
  xpEarned?: number;
  error?: string;
}

export async function submitScore(
  moduleName: string,
  accuracy: number,
  timeElapsedSeconds: number
): Promise<ScoreSubmissionResult> {
  const moduleCheck = validateModuleName(moduleName);
  if (!moduleCheck.valid) {
    return { success: false, error: moduleCheck.error };
  }

  const accuracyCheck = validateAccuracy(accuracy);
  if (!accuracyCheck.valid) {
    return { success: false, error: accuracyCheck.error };
  }

  const timeCheck = validateTimeElapsed(timeElapsedSeconds);
  if (!timeCheck.valid) {
    return { success: false, error: timeCheck.error };
  }

  const { data, error } = await supabase.rpc('submit_score', {
    p_module_name: moduleCheck.value,
    p_accuracy: accuracyCheck.value,
    p_time_elapsed: timeCheck.value,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // The RPC returns a jsonb object — validate the shape before using it
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid response from server' };
  }

  const result = data as Record<string, unknown>;

  if (result.error) {
    return { success: false, error: String(result.error) };
  }

  return {
    success: true,
    scoreId: result.score_id as string,
    accuracy: result.accuracy as number,
    xpEarned: result.xp_earned as number,
  };
}
