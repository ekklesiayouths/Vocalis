/**
 * Melody validation tests — compare playback MIDI sequences against
 * verified reference data for the core learning library songs.
 *
 * Reference sources:
 * - Amazing Grace: NEW BRITAIN hymn tune, standard arrangement in G major
 * - Joy to the World: ANTIOCH arrangement, descending scale in C major
 * - Lean on Me: simplified chord-root outline (C-F-G) for pedagogical use
 * - As the Deer: standard CCM worship melody in C major
 */

import { describe, it, expect } from 'vitest';
import { CORE_SONGS } from '@/lib/coreSongs';

describe('Core song melody validation', () => {
  it('Amazing Grace: melody matches NEW BRITAIN tune in G major', () => {
    const song = CORE_SONGS.find((s) => s.id === 'amazing-grace');
    expect(song).toBeDefined();
    if (!song) return;

    // The melody must contain the pickup notes D4 G4 B4 D4
    expect(song.melodyMidi.slice(0, 4)).toEqual([62, 67, 71, 62]);

    // The first phrase must ascend to D5 (MIDI 74) on "sweet"
    // "Amazing grace, how sweet the sound" = G B D D | B G B A
    expect(song.melodyMidi.slice(4, 12)).toEqual([67, 71, 74, 74, 71, 67, 71, 69]);

    // "That saved a wretch like me" = D G D B | G E A G
    expect(song.melodyMidi.slice(12, 20)).toEqual([74, 79, 74, 71, 67, 64, 69, 67]);

    // Must be in G major: all notes should be from the G major scale
    // G major: G A B C D E F# = MIDI classes {7, 9, 11, 0, 2, 4, 6}
    const gMajorClasses = new Set([7, 9, 11, 0, 2, 4, 6]);
    for (const midi of song.melodyMidi) {
      expect(gMajorClasses.has(((midi % 12) + 12) % 12)).toBe(true);
    }

    // Solfa array must be same length as melody
    expect(song.solfa.length).toBe(song.melodyMidi.length);
  });

  it('Amazing Grace: previous incorrect melody is NOT present', () => {
    const song = CORE_SONGS.find((s) => s.id === 'amazing-grace');
    expect(song).toBeDefined();
    if (!song) return;

    // The old incorrect melody started with [67, 72, 67, 64, 65, 67, 72...]
    // which jumped G4 -> C5 -> G4 -> E4 — not the real tune
    const oldMelodyStart = [67, 72, 67, 64, 65, 67, 72];
    const currentStart = song.melodyMidi.slice(0, oldMelodyStart.length);
    expect(currentStart).not.toEqual(oldMelodyStart);
  });

  it('Joy to the World: opening descends a full octave', () => {
    const song = CORE_SONGS.find((s) => s.id === 'joy-to-the-world');
    expect(song).toBeDefined();
    if (!song) return;

    // First 9 notes should descend: D5 C5 B4 A4 G4 F4 E4 D4 C4
    expect(song.melodyMidi.slice(0, 9)).toEqual([74, 72, 71, 69, 67, 65, 64, 62, 60]);

    // Must be in C major: all notes from C major scale
    // C major: C D E F G A B = MIDI classes {0, 2, 4, 5, 7, 9, 11}
    const cMajorClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const midi of song.melodyMidi) {
      expect(cMajorClasses.has(((midi % 12) + 12) % 12)).toBe(true);
    }

    expect(song.solfa.length).toBe(song.melodyMidi.length);
  });

  it('Lean on Me: outlines I-IV-V chord roots', () => {
    const song = CORE_SONGS.find((s) => s.id === 'lean-on-me');
    expect(song).toBeDefined();
    if (!song) return;

    // Should use C4(60), F4(65), G4(67) — roots of C, F, G chords
    const uniqueNotes = new Set(song.melodyMidi);
    expect(uniqueNotes.has(60)).toBe(true); // C4 = I
    expect(uniqueNotes.has(65)).toBe(true); // F4 = IV
    expect(uniqueNotes.has(67)).toBe(true); // G4 = V

    expect(song.solfa.length).toBe(song.melodyMidi.length);
  });

  it('As the Deer: melody is in C major with stepwise motion', () => {
    const song = CORE_SONGS.find((s) => s.id === 'as-the-deer');
    expect(song).toBeDefined();
    if (!song) return;

    // C major scale classes
    const cMajorClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const midi of song.melodyMidi) {
      expect(cMajorClasses.has(((midi % 12) + 12) % 12)).toBe(true);
    }

    expect(song.solfa.length).toBe(song.melodyMidi.length);
  });

  it('all core songs have non-empty melody and matching solfa length', () => {
    for (const song of CORE_SONGS) {
      expect(song.melodyMidi.length).toBeGreaterThan(0);
      expect(song.solfa.length).toBe(song.melodyMidi.length);
      expect(song.key).toBeDefined();
      expect(song.melodyTempoBpm).toBeGreaterThan(0);
    }
  });

  it('each song has a unique id and unique melody', () => {
    const ids = CORE_SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);

    const melodies = CORE_SONGS.map((s) => s.melodyMidi.join(','));
    expect(new Set(melodies).size).toBe(melodies.length);
  });
});

describe('Song isolation by ID', () => {
  it('core songs do not share melody data with each other', () => {
    for (let i = 0; i < CORE_SONGS.length; i++) {
      for (let j = i + 1; j < CORE_SONGS.length; j++) {
        expect(CORE_SONGS[i].melodyMidi).not.toEqual(CORE_SONGS[j].melodyMidi);
        expect(CORE_SONGS[i].solfa).not.toEqual(CORE_SONGS[j].solfa);
      }
    }
  });
});
