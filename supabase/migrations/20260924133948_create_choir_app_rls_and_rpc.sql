/*
# Gamified Choir Training App — RLS Policies & Anti-Tamper RPC (Part 2)

## Security Changes
Enables RLS on all tables and creates ownership/membership-scoped policies.

- profiles: Users read/update only their own profile
- choirs: Directors CRUD their choirs; members read choirs they belong to
- choir_memberships: Directors manage memberships; members read their own
- assignments: Directors CRUD; members read assignments assigned to them
- scores: Users read/insert own scores; directors read scores of their choir members
  Scores are immutable — UPDATE and DELETE are denied to all.

## Anti-Tamper
- submit_score() RPC: SECURITY DEFINER, clamps accuracy [0,100], requires
  positive time_elapsed, computes XP server-side so client cannot inflate it.
- Leaderboard view: aggregated stats only, no PII leakage.
*/

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE choirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE choir_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================================
-- CHOIRS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "select_choir_if_member_or_director" ON choirs;
CREATE POLICY "select_choir_if_member_or_director" ON choirs FOR SELECT
  TO authenticated USING (
    auth.uid() = director_id
    OR EXISTS (
      SELECT 1 FROM choir_memberships
      WHERE choir_memberships.choir_id = choirs.id
        AND choir_memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_choir_if_director" ON choirs;
CREATE POLICY "insert_choir_if_director" ON choirs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = director_id);

DROP POLICY IF EXISTS "update_choir_if_director" ON choirs;
CREATE POLICY "update_choir_if_director" ON choirs FOR UPDATE
  TO authenticated USING (auth.uid() = director_id) WITH CHECK (auth.uid() = director_id);

DROP POLICY IF EXISTS "delete_choir_if_director" ON choirs;
CREATE POLICY "delete_choir_if_director" ON choirs FOR DELETE
  TO authenticated USING (auth.uid() = director_id);

-- ============================================================================
-- CHOIR MEMBERSHIPS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "select_own_or_choir_membership" ON choir_memberships;
CREATE POLICY "select_own_or_choir_membership" ON choir_memberships FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_memberships.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_membership_if_director_or_self" ON choir_memberships;
CREATE POLICY "insert_membership_if_director_or_self" ON choir_memberships FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_memberships.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_membership_if_director" ON choir_memberships;
CREATE POLICY "update_membership_if_director" ON choir_memberships FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_memberships.choir_id
        AND choirs.director_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_memberships.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_membership_if_director_or_self" ON choir_memberships;
CREATE POLICY "delete_membership_if_director_or_self" ON choir_memberships FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_memberships.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

-- ============================================================================
-- ASSIGNMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "select_assignment_if_assignee_or_director" ON assignments;
CREATE POLICY "select_assignment_if_assignee_or_director" ON assignments FOR SELECT
  TO authenticated USING (
    auth.uid() = assigned_to
    OR EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = assignments.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_assignment_if_director" ON assignments;
CREATE POLICY "insert_assignment_if_director" ON assignments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = assignments.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_assignment_if_director" ON assignments;
CREATE POLICY "update_assignment_if_director" ON assignments FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = assignments.choir_id
        AND choirs.director_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = assignments.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_assignment_if_director" ON assignments;
CREATE POLICY "delete_assignment_if_director" ON assignments FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = assignments.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

-- ============================================================================
-- SCORES POLICIES (immutable — no UPDATE or DELETE)
-- ============================================================================
DROP POLICY IF EXISTS "select_own_score_or_choir_member" ON scores;
CREATE POLICY "select_own_score_or_choir_member" ON scores FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM choir_memberships cm
      WHERE cm.user_id = scores.user_id
        AND EXISTS (
          SELECT 1 FROM choirs
          WHERE choirs.id = cm.choir_id
            AND choirs.director_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "insert_own_score" ON scores;
CREATE POLICY "insert_own_score" ON scores FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deny_update_scores" ON scores;
CREATE POLICY "deny_update_scores" ON scores FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_delete_scores" ON scores;
CREATE POLICY "deny_delete_scores" ON scores FOR DELETE
  TO authenticated USING (false);

-- ============================================================================
-- ANTI-TAMPER SCORE SUBMISSION RPC (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION submit_score(
  p_module_name  text,
  p_accuracy     integer,
  p_time_elapsed integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE profiles
  SET xp = xp + v_xp,
      level = 1 + (xp + v_xp) / 100,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'score_id', v_score_id,
    'accuracy', v_clamped_acc,
    'xp_earned', v_xp
  );
END;
$$;

REVOKE ALL ON FUNCTION submit_score(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_score(text, integer, integer) TO authenticated;

-- ============================================================================
-- LEADERBOARD VIEW (aggregated, no PII)
-- ============================================================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  s.user_id,
  COUNT(*)               AS total_scores,
  AVG(s.accuracy)::int   AS avg_accuracy,
  SUM(s.xp_earned)       AS total_xp,
  MAX(s.created_at)      AS last_played
FROM scores s
GROUP BY s.user_id;

ALTER VIEW leaderboard OWNER TO postgres;
GRANT SELECT ON leaderboard TO authenticated;
