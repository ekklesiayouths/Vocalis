/*
# Create ai_tutor_rate_limits table for server-side rate limiting

## What this migration does

1. New Tables
   - `ai_tutor_rate_limits` — tracks per-user API call counts to enforce
     rate limiting on the AI tutor edge function. Each row stores the
     user ID, a window start timestamp, and a request count.

2. Security
   - RLS enabled with owner-scoped policies. The edge function uses the
     service role key (which bypasses RLS) to insert/update rate limit
     rows, so the policies exist for defense-in-depth — the anon/authenticated
     client cannot directly manipulate rate limit data.

3. Important Notes
   - The edge function checks this table before calling the OpenAI API.
   - Rate limit: 20 requests per user per hour. The window resets when
     a new hour starts (identified by the `window_start` timestamp).
   - Old rows are cleaned up by the edge function on each check.
*/

CREATE TABLE IF NOT EXISTS ai_tutor_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, window_start)
);

ALTER TABLE ai_tutor_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_rate_limits" ON ai_tutor_rate_limits;
CREATE POLICY "select_own_rate_limits" ON ai_tutor_rate_limits FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_rate_limits" ON ai_tutor_rate_limits;
CREATE POLICY "insert_own_rate_limits" ON ai_tutor_rate_limits FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_window ON ai_tutor_rate_limits(user_id, window_start);
