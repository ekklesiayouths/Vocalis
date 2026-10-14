/*
# Add completed_modules tracking to profiles + update submit_score

## What this migration does

1. Adds `completed_modules` text[] column to the `profiles` table to
   persist which modules the user has completed (accuracy >= 70%).
   This replaces the localStorage-only tracking in UserContext and
   allows cross-device sync.

2. Updates the `submit_score` RPC to append the module name to the
   user's `completed_modules` array when accuracy >= 70%. This ensures
   that completion is recorded server-side alongside the score.

3. Security: No new RLS policies needed — the `profiles` table already
   has owner-scoped policies. The `submit_score` RPC is SECURITY DEFINER
   and already validates auth.uid().

## Important Notes
- The column is nullable with a default of an empty array, so existing
  rows are unaffected.
- The append uses `array_append` with `DISTINCT` semantics via a check
  to avoid duplicates.
*/

-- Add completed_modules column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS completed_modules text[] NOT NULL DEFAULT '{}';

-- Update submit_score to track completion
CREATE OR REPLACE FUNCTION submit_score(p_module_name text, p_accuracy integer, p_time_elapsed integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id     uuid := auth.uid();
  v_clamped_acc integer;
  v_xp          integer;
  v_score_id    uuid;
  v_time_val    integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  IF p_module_name IS NULL OR length(p_module_name) < 1 OR length(p_module_name) > 200 THEN
    RETURN jsonb_build_object('error', 'Invalid module name');
  END IF;

  v_clamped_acc := LEAST(GREATEST(p_accuracy, 0), 100);

  v_time_val := LEAST(p_time_elapsed, 86400);
  IF v_time_val <= 0 THEN
    RETURN jsonb_build_object('error', 'Invalid time elapsed');
  END IF;

  v_xp := (v_clamped_acc / 10) * 10;
  IF v_time_val < 30 AND v_clamped_acc >= 80 THEN
    v_xp := v_xp + 5;
  END IF;

  INSERT INTO scores (user_id, module_name, accuracy, time_elapsed, xp_earned)
  VALUES (v_user_id, p_module_name, v_clamped_acc, v_time_val, v_xp)
  RETURNING id INTO v_score_id;

  -- Update XP, level, and completed_modules
  UPDATE profiles
  SET xp = xp + v_xp,
      level = 1 + (xp + v_xp) / 100,
      completed_modules = CASE
        WHEN v_clamped_acc >= 70 AND NOT (p_module_name = ANY(completed_modules)) THEN
          array_append(completed_modules, p_module_name)
        ELSE completed_modules
      END,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'score_id', v_score_id,
    'accuracy', v_clamped_acc,
    'xp_earned', v_xp
  );
END;
$function$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION submit_score(text, integer, integer) TO authenticated;
