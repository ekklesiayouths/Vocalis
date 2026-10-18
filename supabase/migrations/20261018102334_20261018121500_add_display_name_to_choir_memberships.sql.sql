-- Add display_name snapshot to choir_memberships so rosters can show singer
-- names without reading other users' profiles rows (profiles RLS correctly
-- limits each user to their own row). Additive change; existing rows are null
-- and the UI falls back to a generic label.

ALTER TABLE choir_memberships ADD COLUMN IF NOT EXISTS display_name text;