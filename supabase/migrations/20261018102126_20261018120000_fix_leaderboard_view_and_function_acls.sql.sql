-- Corrective security migration: fixes that migration 20261014163834 intended
-- but which did not take effect in the live database.

-- 1. leaderboard view: CREATE OR REPLACE does not alter the security_invoker
--    option, and the view still runs as its owner (postgres), bypassing RLS on
--    scores. Drop and recreate as a security-invoker view.
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard
WITH (security_invoker = true) AS
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

-- 2. get_progress_summary: the earlier REVOKE ... FROM anon left the implicit
--    PUBLIC grant in place (empty ACL entry "=X/postgres"). Revoke PUBLIC,
--    then grant explicitly to authenticated and service_role.
REVOKE EXECUTE ON FUNCTION public.get_progress_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_progress_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_progress_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_progress_summary() TO service_role;

-- 3. handle_new_user: a signup trigger function must never be callable as an
--    RPC. It still shows an authenticated EXECUTE entry in its ACL.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;