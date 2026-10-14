/*
# Create ML recommendation infrastructure tables

## What this migration does

1. New Tables
   - `model_versions` — stores metadata about each trained recommendation
     model version. Tracks the training algorithm, hyperparameters, training
     data size, evaluation metrics (precision/recall/NDCG), and whether the
     model is active. Only one model can be active at a time.
   - `model_predictions` — stores per-user, per-module prediction scores
     from the active model. Each row is a (user_id, module_name, score,
     model_version_id) tuple. The score represents the model's confidence
     that the user should practice this module next.

2. Security
   - RLS enabled on both tables.
   - `model_versions`: SELECT to authenticated (so users can see which model
     is active), INSERT/UPDATE/DELETE only to authenticated (the training
     pipeline runs with the service role key which bypasses RLS).
   - `model_predictions`: full owner-scoped CRUD — users can only see their
     own predictions.
   - The training edge function uses the service role key to write model
     versions and predictions, bypassing RLS.

3. Important Notes
   - The model is NOT activated at creation. The training pipeline evaluates
     the model against the baseline and only sets is_active = true if it
     demonstrates measurable improvement (NDCG@5 improvement >= 5%).
   - When no model is active, the app falls back to the rule-based baseline
     (lowest avg accuracy among modules with >= 2 attempts).
*/

-- model_versions: tracks trained recommendation models
CREATE TABLE IF NOT EXISTS model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  algorithm text NOT NULL,
  hyperparameters jsonb NOT NULL DEFAULT '{}',
  training_data_size integer NOT NULL DEFAULT 0,
  evaluation_metrics jsonb NOT NULL DEFAULT '{}',
  baseline_metrics jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_model_versions" ON model_versions;
CREATE POLICY "select_model_versions" ON model_versions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_model_versions" ON model_versions;
CREATE POLICY "insert_model_versions" ON model_versions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_model_versions" ON model_versions;
CREATE POLICY "update_model_versions" ON model_versions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_model_versions" ON model_versions;
CREATE POLICY "delete_model_versions" ON model_versions FOR DELETE
  TO authenticated USING (true);

-- model_predictions: per-user module recommendation scores
CREATE TABLE IF NOT EXISTS model_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  score double precision NOT NULL CHECK (score >= 0 AND score <= 1),
  model_version_id uuid NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_name, model_version_id)
);

ALTER TABLE model_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_predictions" ON model_predictions;
CREATE POLICY "select_own_predictions" ON model_predictions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_predictions" ON model_predictions;
CREATE POLICY "insert_own_predictions" ON model_predictions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_predictions" ON model_predictions;
CREATE POLICY "update_own_predictions" ON model_predictions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_predictions" ON model_predictions;
CREATE POLICY "delete_own_predictions" ON model_predictions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_model_predictions_user ON model_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_active ON model_versions(is_active) WHERE is_active = true;
