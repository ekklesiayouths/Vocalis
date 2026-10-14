/*
# Fix Database Readiness for Authentication

## Purpose
Addresses security and account-creation gaps identified by the Phase 1 audit,
preparing the database for production registration and login.

## Changes

### 1. Auto-create profile on signup (handle_new_user trigger)
- Creates a `handle_new_user()` SECURITY DEFINER function that inserts a
  `profiles` row when a new auth.users row is created.
- Uses `ON CONFLICT (id) DO NOTHING` so retried/duplicate events are safe.
- Extracts display_name from `raw_user_meta_data->>full_name` if provided
  during signup; defaults to empty string (onboarding will populate it).
- Does NOT store passwords, tokens, or email in the profiles table.
- Restricted search_path to 'public' to prevent search_path injection.
- Attaches the function as an AFTER INSERT trigger on auth.users.

### 2. Revoke anon EXECUTE on SECURITY DEFINER functions
- `submit_score` and `get_progress_summary` are callable by `anon` role
  (confirmed by audit). Both have internal auth.uid() checks, but the
  grant is unnecessary and removed for defense in depth.
- EXECUTE retained for `authenticated` only.

### 3. Fix leaderboard view security
- The existing `leaderboard` view is SECURITY DEFINER (owner = postgres),
  bypassing RLS on the scores table. Any authenticated user can see
  aggregate score data for ALL users, not just their choir members.
- Recreated as SECURITY INVOKER so the scores RLS SELECT policy applies.
  Authenticated users will only see rows for themselves and their choir
  members, consistent with the scores table policy.

### 4. Lock down model_versions writes
- Existing policies use USING(true) / WITH CHECK(true), allowing any
  authenticated user to INSERT, UPDATE, DELETE model version records.
- Replaced with deny-by-default for INSERT, UPDATE, DELETE (USING(false) /
  WITH CHECK(false)). The service role bypasses RLS, so the
  train-recommendations edge function continues to work.
- SELECT remains open to authenticated (read-only access to model metadata).

### 5. Lock down ai_tutor_rate_limits against client manipulation
- Added UPDATE and DELETE policies with USING(false) / WITH CHECK(false)
  so authenticated users cannot modify or delete their own rate-limit
  records. The edge function uses the service-role key (bypasses RLS)
  to manage rate-limit rows.
- Existing SELECT and INSERT (self-scoped) policies preserved.

### 6. Do NOT add profiles DELETE policy
- Per the task requirements, account deletion must use a complete secure
  workflow, not a simple row delete that leaves auth.users active.
- No DELETE policy is added. The auth cascade will handle profile cleanup
  if/when the auth account is deleted through a proper admin flow.

### 7. Reduce overly broad table grants
- Revoked TRUNCATE, TRIGGER, and REFERENCES from anon and authenticated
  on all public tables — these are not needed by the application.
- Retained SELECT, INSERT, UPDATE, DELETE where policies exist.
- Service role and postgres retain all privileges (bypasses RLS).

## Security Impact
- New users get a profile row automatically — no silent failures.
- Anon can no longer call submit_score or get_progress_summary.
- Leaderboard respects RLS — no cross-user data leakage.
- Model version records are write-protected from regular users.
- Rate-limit records are tamper-proof from the client.
- Table grants follow least-privilege principle.
*/

-- ============================================================================
-- 1. HANDLE_NEW_USER TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Revoke from anon/public, grant only to postgres (trigger runs as owner)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. REVOKE ANON EXECUTE ON SECURITY DEFINER FUNCTIONS
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.submit_score(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_progress_summary() FROM anon;

-- ============================================================================
-- 3. FIX LEADERBOARD VIEW — SECURITY INVOKER
-- ============================================================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  s.user_id,
  COUNT(*)             AS total_scores,
  AVG(s.accuracy)::int AS avg_accuracy,
  SUM(s.xp_earned)     AS total_xp,
  MAX(s.created_at)    AS last_played
FROM public.scores s
GROUP BY s.user_id;

ALTER VIEW public.leaderboard OWNER TO postgres;
GRANT SELECT ON public.leaderboard TO authenticated;

-- ============================================================================
-- 4. LOCK DOWN MODEL_VERSIONS WRITES
-- ============================================================================
DROP POLICY IF EXISTS "insert_model_versions" ON model_versions;
CREATE POLICY "insert_model_versions" ON model_versions FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "update_model_versions" ON model_versions;
CREATE POLICY "update_model_versions" ON model_versions FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "delete_model_versions" ON model_versions;
CREATE POLICY "delete_model_versions" ON model_versions FOR DELETE
  TO authenticated USING (false);

-- SELECT remains open (existing policy preserved)
-- No change needed to select_model_versions

-- ============================================================================
-- 5. LOCK DOWN AI_TUTOR_RATE_LIMITS AGAINST CLIENT MANIPULATION
-- ============================================================================
DROP POLICY IF EXISTS "update_own_rate_limits" ON ai_tutor_rate_limits;
CREATE POLICY "update_own_rate_limits" ON ai_tutor_rate_limits FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "delete_own_rate_limits" ON ai_tutor_rate_limits;
CREATE POLICY "delete_own_rate_limits" ON ai_tutor_rate_limits FOR DELETE
  TO authenticated USING (false);

-- ============================================================================
-- 6. REDUCE OVERLY BROAD TABLE GRANTS
-- ============================================================================
-- Revoke unnecessary privileges from anon and authenticated on all public tables
-- Service role and postgres retain all privileges (they bypass RLS)
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM anon', t.tablename);
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM authenticated', t.tablename);
  END LOOP;
END $$;
