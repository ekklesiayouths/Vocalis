/*
# Gamified Choir Training App — Tables (Part 1: Schema Only)

Creates all tables first without RLS policies so cross-table references resolve.
Policies are added in a second migration.

## New Tables
1. profiles — User profile (display_name, xp, level, streak) linked 1:1 to auth.users
2. choirs — Choir groups created by a Music Director
3. choir_memberships — Junction linking users to choirs with role (member/director)
4. assignments — Homework modules assigned by director to specific members
5. scores — Immutable quiz/exercise score records

## Anti-Tamper
- submit_score() RPC: SECURITY DEFINER, validates and clamps all inputs server-side
- Leaderboard view: aggregated only, no PII
*/

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  xp           integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level        integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  streak_days  integer NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. CHOIRS
CREATE TABLE IF NOT EXISTS choirs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text CHECK (length(description) <= 500),
  invite_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  director_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. CHOIR MEMBERSHIPS
CREATE TABLE IF NOT EXISTS choir_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  choir_id   uuid NOT NULL REFERENCES choirs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'director')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(choir_id, user_id)
);

-- 4. ASSIGNMENTS
CREATE TABLE IF NOT EXISTS assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  choir_id      uuid NOT NULL REFERENCES choirs(id) ON DELETE CASCADE,
  assigned_to   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name   text NOT NULL CHECK (length(module_name) BETWEEN 1 AND 200),
  difficulty    text NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'foundation', 'singer', 'harmony', 'music_director', 'advanced')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- 5. SCORES
CREATE TABLE IF NOT EXISTS scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name   text NOT NULL CHECK (length(module_name) BETWEEN 1 AND 200),
  accuracy      integer NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  time_elapsed  integer NOT NULL CHECK (time_elapsed > 0),
  xp_earned     integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_choir_memberships_choir_id ON choir_memberships(choir_id);
CREATE INDEX IF NOT EXISTS idx_choir_memberships_user_id ON choir_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_choir_id ON assignments(choir_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at DESC);
