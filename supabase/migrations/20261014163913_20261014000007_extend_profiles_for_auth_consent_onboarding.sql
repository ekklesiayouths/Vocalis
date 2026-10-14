/*
# Extend Profiles Schema for Auth, Consent, and Onboarding

## Purpose
Adds columns to the existing profiles table to support registration
(full name, age, email), onboarding (preferences, assessment results,
learning map), and consent tracking (Terms, Privacy Policy, cookies).

## Changes

### 1. Profile columns added to `profiles` (all additive, no data loss)

**Registration fields:**
- `email` (text, nullable) — cached from auth.users for convenience.
  The auth system remains the source of truth for email. Updated by
  the handle_new_user trigger and by the client after login.
- `full_name` (text, nullable) — the user's full name from registration.
  display_name (existing) may differ (nickname/preferred name).
- `age` (integer, nullable, CHECK 5–120) — collected at registration.
  Nullable because existing users won't have it.

**Onboarding fields:**
- `onboarding_completed` (boolean, default false) — replaces the
  localStorage-only onboarded flag. Synced after onboarding finishes.
- `onboarding_step` (text, nullable) — current step for resume capability.
- `onboarding_data` (jsonb, default '{}') — stores the full onboarding
  questionnaire answers (goals, role, experience, reading notation,
  solfa knowledge, instrument access, practice preferences, strengths,
  struggles) and skill assessment results.

**Consent fields:**
- `terms_accepted_version` (text, nullable) — version of Terms accepted.
- `terms_accepted_at` (timestamptz, nullable) — when Terms were accepted.
- `privacy_policy_acknowledged_version` (text, nullable) — version acknowledged.
- `privacy_policy_acknowledged_at` (timestamptz, nullable) — when acknowledged.
- `cookie_consent` (jsonb, default '{}'::jsonb) — stores cookie consent
  preferences: { essential: true, analytics: bool, timestamp: ... }

**Learning map fields:**
- `learning_map` (jsonb, nullable) — the generated learning map
  (recommended courses, sequence, practice plan, assessment levels).
- `learning_map_generated_at` (timestamptz, nullable) — when the map was last generated.

### 2. Update handle_new_user to populate email
- Updated the trigger function to also set `email` from `NEW.email`.

### 3. Security
- No new tables — all changes are additive columns on existing profiles.
- RLS already enabled on profiles; existing SELECT/INSERT/UPDATE policies
  (auth.uid() = id) protect all new columns.
- No new policies needed — the existing ownership check covers all columns.

## Important Notes
1. All columns are nullable or have safe defaults — existing rows are unaffected.
2. The `age` CHECK constraint allows 5–120. The actual minimum age policy
   must be decided by the owner and enforced in the application layer.
3. `email` is stored for convenience (display in settings, etc.) but the
   auth system remains authoritative for login and password resets.
4. `onboarding_data` is a flexible jsonb field — the application validates
   its structure. Server-side validation should be added if direct DB
   writes from untrusted clients become a concern (currently RLS-scoped
   to own row only, so users can only write their own data).
*/

-- ============================================================================
-- ADD COLUMNS TO PROFILES (additive, idempotent)
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS age integer CHECK (age IS NULL OR (age >= 5 AND age <= 120)),
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step text,
  ADD COLUMN IF NOT EXISTS onboarding_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS terms_accepted_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_acknowledged_version text,
  ADD COLUMN IF NOT EXISTS privacy_policy_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS cookie_consent jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS learning_map jsonb,
  ADD COLUMN IF NOT EXISTS learning_map_generated_at timestamptz;

-- ============================================================================
-- UPDATE HANDLE_NEW_USER TO ALSO SET EMAIL
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
