/*
# Song Hub — Core Songs, Choir Songs, and Storage Bucket

## New Tables
1. core_songs — System-wide baseline reference songs (Amazing Grace, Joy to the World,
   Lean on Me, As the Deer). Public/read-only, seeded at migration time.
   Fields: title, pedagogical_focus, lyrics, melody_midi (integer array for synthesized
   playback), melody_tempo_bpm, melody_oscillator_type.
2. choir_songs — Rehearsal songs uploaded by a Music Director to a specific Choir Space.
   Fields: choir_id, title, pedagogical_focus, lyrics, audio_path, uploaded_by,
   transcription_status.

## Security
- core_songs: public read for all authenticated users. No write policies.
- choir_songs: SELECT for choir members and directors via membership check.
  INSERT/UPDATE/DELETE for the choir director only.
- Storage bucket 'choir-audio' is private with MIME-type restrictions.
  Upload restricted to choir directors, read for choir members.

## Notes
1. Core songs are seeded with pedagogical content and MIDI note arrays.
2. choir_songs.audio_path stores the storage object path for signed URL playback.
3. transcription_status tracks the AI lyric pipeline state.
*/

-- ============================================================================
-- CORE SONGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS core_songs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  pedagogical_focus       text NOT NULL CHECK (length(pedagogical_focus) BETWEEN 1 AND 500),
  lyrics                  text NOT NULL,
  melody_midi             integer[] NOT NULL DEFAULT '{}',
  melody_tempo_bpm        integer NOT NULL DEFAULT 120 CHECK (melody_tempo_bpm BETWEEN 40 AND 300),
  melody_oscillator_type  text NOT NULL DEFAULT 'triangle' CHECK (melody_oscillator_type IN ('sine', 'triangle', 'square', 'sawtooth')),
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE core_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_core_songs_all" ON core_songs;
CREATE POLICY "select_core_songs_all" ON core_songs FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- CHOIR SONGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS choir_songs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  choir_id             uuid NOT NULL REFERENCES choirs(id) ON DELETE CASCADE,
  title                text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  pedagogical_focus    text CHECK (length(pedagogical_focus) <= 500),
  lyrics               text NOT NULL DEFAULT '',
  audio_path           text,
  uploaded_by          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  transcription_status text NOT NULL DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_choir_songs_choir_id ON choir_songs(choir_id);
CREATE INDEX IF NOT EXISTS idx_choir_songs_created_at ON choir_songs(created_at DESC);

ALTER TABLE choir_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_choir_songs_if_member" ON choir_songs;
CREATE POLICY "select_choir_songs_if_member" ON choir_songs FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM choir_memberships cm
      WHERE cm.choir_id = choir_songs.choir_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_songs.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_choir_songs_if_director" ON choir_songs;
CREATE POLICY "insert_choir_songs_if_director" ON choir_songs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_songs.choir_id
        AND choirs.director_id = auth.uid()
    )
    AND auth.uid() = uploaded_by
  );

DROP POLICY IF EXISTS "update_choir_songs_if_director" ON choir_songs;
CREATE POLICY "update_choir_songs_if_director" ON choir_songs FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_songs.choir_id
        AND choirs.director_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_songs.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_choir_songs_if_director" ON choir_songs;
CREATE POLICY "delete_choir_songs_if_director" ON choir_songs FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM choirs
      WHERE choirs.id = choir_songs.choir_id
        AND choirs.director_id = auth.uid()
    )
  );

-- ============================================================================
-- STORAGE BUCKET FOR CHOIR AUDIO
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'choir-audio',
  'choir-audio',
  false,
  52428800,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "choir_audio_upload_if_director" ON storage.objects;
CREATE POLICY "choir_audio_upload_if_director" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'choir-audio'
    AND EXISTS (
      SELECT 1 FROM choirs c
      WHERE c.director_id = auth.uid()
        AND (storage.foldername(name))[1] = c.id::text
    )
  );

DROP POLICY IF EXISTS "choir_audio_read_if_member" ON storage.objects;
CREATE POLICY "choir_audio_read_if_member" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'choir-audio'
    AND (
      EXISTS (
        SELECT 1 FROM choir_memberships cm
        WHERE cm.choir_id::text = (storage.foldername(name))[1]
          AND cm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM choirs c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.director_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "choir_audio_delete_if_director" ON storage.objects;
CREATE POLICY "choir_audio_delete_if_director" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'choir-audio'
    AND EXISTS (
      SELECT 1 FROM choirs c
      WHERE c.director_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================================================
-- SEED CORE REFERENCE SONGS
-- ============================================================================
INSERT INTO core_songs (title, pedagogical_focus, lyrics, melody_midi, melody_tempo_bpm, melody_oscillator_type)
VALUES (
  'Amazing Grace',
  'Pentatonic scale, phrasing, and breath control. The melody moves primarily through the five-note pentatonic scale, making it an ideal anchor for practicing smooth legato phrasing and sustained breath support.',
  'Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see',
  ARRAY[67, 72, 67, 64, 65, 67, 72, 67, 64, 65, 67, 72, 74, 72, 67, 72, 67, 64, 65, 67, 72, 67, 64, 62, 60],
  80,
  'triangle'
) ON CONFLICT DO NOTHING;

INSERT INTO core_songs (title, pedagogical_focus, lyrics, melody_midi, melody_tempo_bpm, melody_oscillator_type)
VALUES (
  'Joy to the World',
  'Descending scale pattern and interval recognition. The opening phrase descends through a full octave, making it the classic reference for identifying descending scale motion and large interval leaps.',
  'Joy to the world, the Lord is come
Let earth receive her King
Let every heart prepare Him room
And heaven and nature sing',
  ARRAY[74, 72, 71, 69, 67, 65, 64, 62, 60, 62, 64, 64, 62, 60, 62, 64, 65, 67, 67, 65, 64, 62, 60],
  100,
  'triangle'
) ON CONFLICT DO NOTHING;

INSERT INTO core_songs (title, pedagogical_focus, lyrics, melody_midi, melody_tempo_bpm, melody_oscillator_type)
VALUES (
  'Lean on Me',
  'Chord root movement and harmonic ear training. The melody outlines the root notes of the I-IV-V chord progression, providing a foundation for hearing chord changes and practicing harmonic alignment.',
  'Lean on me, when you''re not strong
And I''ll be your friend
I''ll help you carry on
For it won''t be long
Till I''m gonna need somebody to lean on',
  ARRAY[60, 60, 60, 60, 65, 65, 65, 65, 67, 67, 67, 67, 60, 60, 60, 60, 65, 65, 65, 65, 67, 67, 67, 67],
  90,
  'sine'
) ON CONFLICT DO NOTHING;

INSERT INTO core_songs (title, pedagogical_focus, lyrics, melody_midi, melody_tempo_bpm, melody_oscillator_type)
VALUES (
  'As the Deer',
  'Scale degree recognition and expressive phrasing. The melody moves through steps and small skips that map directly to solfege syllables, making it an excellent reference for practicing scale degree identification.',
  'As the deer panteth for the water
So my soul longeth after Thee
You alone are my heart''s desire
And I long to worship Thee',
  ARRAY[69, 71, 72, 74, 72, 71, 69, 67, 69, 71, 72, 74, 76, 74, 72, 71, 69, 67, 69, 71, 72, 74, 72, 69],
  85,
  'triangle'
) ON CONFLICT DO NOTHING;
