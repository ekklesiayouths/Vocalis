-- Add musical analysis fields to choir_songs for proper song isolation
-- and director review workflow.
-- Adds: detected_key, confirmed_key, melody_midi, tonic_solfa,
--   processing_status (replaces transcription_status), processing_error,
--   lyrics_verified, melody_verified

-- Add new columns (all nullable — songs can exist without analysis)
ALTER TABLE choir_songs
  ADD COLUMN IF NOT EXISTS detected_key text,
  ADD COLUMN IF NOT EXISTS confirmed_key text,
  ADD COLUMN IF NOT EXISTS melody_midi integer[],
  ADD COLUMN IF NOT EXISTS tonic_solfa text[],
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'review', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS lyrics_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS melody_verified boolean NOT NULL DEFAULT false;

-- Backfill: migrate existing transcription_status values to processing_status
UPDATE choir_songs
  SET processing_status = CASE transcription_status
    WHEN 'completed' THEN 'completed'
    WHEN 'processing' THEN 'processing'
    WHEN 'failed' THEN 'failed'
    ELSE 'pending'
  END
WHERE processing_status = 'pending' AND transcription_status != 'pending';

-- Fix Amazing Grace seed data — the melody was incorrect
-- Correct melody in G major: pickup D4 G4 B4 D4, then the standard hymn tune
UPDATE core_songs
  SET melody_midi = ARRAY[
    62, 67, 71, 62,   -- pickup: D4 G4 B4 D4
    67, 71, 74, 74,   -- "Amazing grace, how sweet the"
    71, 67, 71, 69,   -- "sound"
    74, 79, 74, 71,   -- "That saved a wretch like"
    67, 64, 69, 67,   -- "me"
    62, 67, 71, 74,   -- "I once was lost, but now am"
    79, 74, 71, 74,   -- "found"
    71, 67, 71, 69, 67 -- "was blind, but now I see"
  ]
WHERE title = 'Amazing Grace';
