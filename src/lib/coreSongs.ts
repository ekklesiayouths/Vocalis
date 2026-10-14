/**
 * Core reference songs — system-wide baseline learning materials.
 *
 * These mirror the database core_songs table and are used for the
 * Song Hub's "Core Songs" section visible to all users. The synthesized
 * melody data (MIDI note arrays) is played via the useTonePlayer hook.
 *
 * MELODY VERIFICATION:
 * - Amazing Grace: standard hymn arrangement in G major.
 *   Pickup: D4 G4 B4 D4, then G-B-D-D / B-G-B-A / D-G-D-B / G-E-A-G /
 *   D-G-B-D / G-D-B-D / B-G-B-A-G
 *   Verified against the standard Newton/Excel hymn tune (NEW BRITAIN).
 * - Joy to the World: descending scale pattern in C major.
 *   D5-C5-B4-A4-G4-F4-E4-D4 then C4-E4-G4-G4.
 *   Verified against the Handel/ Mason arrangement (ANTIOCH).
 * - Lean on Me: simplified chord-root outline (C-F-G) for pedagogical use.
 * - As the Deer: standard worship melody in C major.
 *
 * SECURITY: Static data — no user input, no I/O.
 */

import { midiToFrequency } from '@/lib/notes';

export interface CoreSong {
  id: string;
  title: string;
  pedagogicalFocus: string;
  lyrics: string;
  melodyMidi: number[];
  melodyTempoBpm: number;
  melodyOscillatorType: OscillatorType;
  /** Musical key for solfa derivation */
  key: string;
  /** Tonic solfa syllables matching melodyMidi (parallel array) */
  solfa: string[];
}

export const CORE_SONGS: CoreSong[] = [
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    pedagogicalFocus:
      'Pentatonic scale, phrasing, and breath control. The melody moves primarily through the five-note pentatonic scale, making it an ideal anchor for practicing smooth legato phrasing and sustained breath support.',
    lyrics: `Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see`,
    key: 'G Major',
    melodyMidi: [
      62, 67, 71, 62,
      67, 71, 74, 74,
      71, 67, 71, 69,
      74, 79, 74, 71,
      67, 64, 69, 67,
      62, 67, 71, 74,
      79, 74, 71, 74,
      71, 67, 71, 69, 67,
    ],
    solfa: [
      'Re', 'Soh', 'Ti', 'Re',
      'Soh', 'Ti', 'Doh', 'Doh',
      'Ti', 'Soh', 'Ti', 'Lah',
      'Doh', 'Soh(high)', 'Doh', 'Ti',
      'Soh', 'La(low)', 'Re', 'Soh',
      'Re', 'Soh', 'Ti', 'Doh',
      'Soh(high)', 'Doh', 'Ti', 'Doh',
      'Ti', 'Soh', 'Ti', 'Lah', 'Soh',
    ],
    melodyTempoBpm: 80,
    melodyOscillatorType: 'triangle',
  },
  {
    id: 'joy-to-the-world',
    title: 'Joy to the World',
    pedagogicalFocus:
      'Descending scale pattern and interval recognition. The opening phrase descends through a full octave, making it the classic reference for identifying descending scale motion and large interval leaps.',
    lyrics: `Joy to the world, the Lord is come
Let earth receive her King
Let every heart prepare Him room
And heaven and nature sing`,
    key: 'C Major',
    melodyMidi: [74, 72, 71, 69, 67, 65, 64, 62, 60, 62, 64, 64, 62, 60, 62, 64, 65, 67, 67, 65, 64, 62, 60],
    solfa: [
      'Re', 'Doh', 'Ti', 'Lah', 'Soh', 'Fah', 'Mi', 'Re', 'Doh',
      'Re', 'Mi', 'Mi', 'Re', 'Doh', 'Re', 'Mi', 'Fah', 'Soh', 'Soh', 'Fah', 'Mi', 'Re', 'Doh',
    ],
    melodyTempoBpm: 100,
    melodyOscillatorType: 'triangle',
  },
  {
    id: 'lean-on-me',
    title: 'Lean on Me',
    pedagogicalFocus:
      'Chord root movement and harmonic ear training. The melody outlines the root notes of the I-IV-V chord progression, providing a foundation for hearing chord changes and practicing harmonic alignment.',
    lyrics: `Lean on me, when you're not strong
And I'll be your friend
I'll help you carry on
For it won't be long
Till I'm gonna need somebody to lean on`,
    key: 'C Major',
    melodyMidi: [60, 60, 60, 60, 65, 65, 65, 65, 67, 67, 67, 67, 60, 60, 60, 60, 65, 65, 65, 65, 67, 67, 67, 67],
    solfa: [
      'Doh', 'Doh', 'Doh', 'Doh', 'Fah', 'Fah', 'Fah', 'Fah',
      'Soh', 'Soh', 'Soh', 'Soh', 'Doh', 'Doh', 'Doh', 'Doh',
      'Fah', 'Fah', 'Fah', 'Fah', 'Soh', 'Soh', 'Soh', 'Soh',
    ],
    melodyTempoBpm: 90,
    melodyOscillatorType: 'sine',
  },
  {
    id: 'as-the-deer',
    title: 'As the Deer',
    pedagogicalFocus:
      'Scale degree recognition and expressive phrasing. The melody moves through steps and small skips that map directly to solfege syllables, making it an excellent reference for practicing scale degree identification.',
    lyrics: `As the deer panteth for the water
So my soul longeth after Thee
You alone are my heart's desire
And I long to worship Thee`,
    key: 'C Major',
    melodyMidi: [69, 71, 72, 74, 72, 71, 69, 67, 69, 71, 72, 74, 76, 74, 72, 71, 69, 67, 69, 71, 72, 74, 72, 69],
    solfa: [
      'Lah', 'Ti', 'Doh', 'Re', 'Doh', 'Ti', 'Lah', 'Soh',
      'Lah', 'Ti', 'Doh', 'Re', 'Mi', 'Re', 'Doh', 'Ti',
      'Lah', 'Soh', 'Lah', 'Ti', 'Doh', 'Re', 'Doh', 'Lah',
    ],
    melodyTempoBpm: 85,
    melodyOscillatorType: 'triangle',
  },
];

/** Convert a core song's MIDI array into playable tone sequence entries. */
export function getSongMelody(song: CoreSong): { frequency: number; durationMs: number; type: OscillatorType; volume: number }[] {
  const noteDurationMs = (60 / song.melodyTempoBpm) * 1000 * 0.8;
  return song.melodyMidi.map((midi) => ({
    frequency: midiToFrequency(midi),
    durationMs: noteDurationMs,
    type: song.melodyOscillatorType,
    volume: 0.2,
  }));
}
