/*
# Create exercise_attempts table and get_progress_summary RPC

## What this migration does

1. New Tables
   - `exercise_attempts` — stores detailed per-attempt data for every exercise
     session beyond the aggregate score. Each row captures module name,
     accuracy, time elapsed, XP earned, pitch-match ratio, and metadata.

2. New Functions
   - `get_progress_summary()` — SECURITY DEFINER RPC returning the
     authenticated user's progress: total XP, level, streak, per-module
     statistics, and recent activity. Powers the adaptive recommendation engine.

3. Security
   - RLS enabled on `exercise_attempts` with four owner-scoped policies.
   - `get_progress_summary()` is SECURITY DEFINER with auth.uid() check.
*/

-- 1. exercise_attempts table
CREATE TABLE IF NOT EXISTS exercise_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  accuracy integer NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  time_elapsed_seconds integer NOT NULL CHECK (time_elapsed_seconds >= 0),
  xp_earned integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  pitch_match_ratio double precision,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exercise_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_attempts" ON exercise_attempts;
CREATE POLICY "select_own_attempts" ON exercise_attempts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_attempts" ON exercise_attempts;
CREATE POLICY "insert_own_attempts" ON exercise_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_attempts" ON exercise_attempts;
CREATE POLICY "update_own_attempts" ON exercise_attempts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_attempts" ON exercise_attempts;
CREATE POLICY "delete_own_attempts" ON exercise_attempts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_exercise_attempts_user_id ON exercise_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_attempts_module ON exercise_attempts(user_id, module_name);

-- 2. get_progress_summary RPC
CREATE OR REPLACE FUNCTION get_progress_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_modules jsonb;
  v_recent jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT xp, level, streak_days INTO v_profile
  FROM profiles WHERE id = v_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'module_name', module_name,
    'attempts', attempt_count,
    'best_accuracy', best_accuracy,
    'avg_accuracy', avg_accuracy,
    'last_attempted', last_attempted
  )), '[]'::jsonb) INTO v_modules
  FROM (
    SELECT
      module_name,
      COUNT(*) AS attempt_count,
      MAX(accuracy) AS best_accuracy,
      ROUND(AVG(accuracy)) AS avg_accuracy,
      MAX(created_at) AS last_attempted
    FROM scores
    WHERE user_id = v_user_id
    GROUP BY module_name
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'module_name', module_name,
    'accuracy', accuracy,
    'xp_earned', xp_earned,
    'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT module_name, accuracy, xp_earned, created_at
    FROM scores
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 5
  ) r;

  RETURN jsonb_build_object(
    'xp', COALESCE(v_profile.xp, 0),
    'level', COALESCE(v_profile.level, 1),
    'streak_days', COALESCE(v_profile.streak_days, 0),
    'modules', v_modules,
    'recent_activity', v_recent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_progress_summary() TO authenticated;
