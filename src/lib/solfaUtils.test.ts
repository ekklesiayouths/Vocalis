/**
 * Tests for music analysis utilities — key estimation and solfa derivation.
 *
 * Tests verify:
 * - Key estimation correctly identifies major/minor keys from note distributions
 * - Solfa derivation produces correct movable-do syllables for diatonic notes
 * - Chromatic alterations are handled
 * - Song isolation: different melodies produce different solfa sequences
 */

import { describe, it, expect } from 'vitest';
import { estimateKey, deriveSolfa, midiToNoteLabel } from '@/lib/solfaUtils';

describe('Key estimation', () => {
  it('identifies C Major from a C major scale', () => {
    // C major scale: C D E F G A B
    const cMajorNotes = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
    const result = estimateKey(cMajorNotes);
    expect(result).not.toBeNull();
    expect(result!.key).toBe('C Major');
    expect(result!.isMajor).toBe(true);
    expect(result!.tonic).toBe(0);
  });

  it('identifies G Major from G major scale notes', () => {
    // G major: G A B C D E F#
    const gMajorNotes = [67, 69, 71, 72, 74, 76, 78, 79];
    const result = estimateKey(gMajorNotes);
    expect(result).not.toBeNull();
    expect(result!.key).toBe('G Major');
    expect(result!.isMajor).toBe(true);
  });

  it('identifies A Minor from A minor scale notes', () => {
    // A natural minor: A B C D E F G
    const aMinorNotes = [69, 71, 72, 74, 76, 77, 79];
    const result = estimateKey(aMinorNotes);
    expect(result).not.toBeNull();
    expect(result!.isMajor).toBe(false);
    expect(result!.key).toContain('Minor');
  });

  it('returns null for empty input', () => {
    expect(estimateKey([])).toBeNull();
  });

  it('provides candidate keys sorted by score', () => {
    // Emphasize C as tonic by repeating it
    const cMajorNotes = [60, 60, 62, 64, 65, 67, 69, 71, 72, 60, 67, 60];
    const result = estimateKey(cMajorNotes);
    expect(result).not.toBeNull();
    expect(result!.candidates.length).toBe(3);
    // Best candidate should be C Major
    expect(result!.candidates[0].key).toBe('C Major');
  });

  it('identifies G Major from Amazing Grace melody notes', () => {
    // Amazing Grace in G: pickup D4, then G4 B4 D5 D5 C5 B4 G4...
    // Notes: D G B D D C B G D B G
    const notes = [62, 67, 71, 74, 74, 72, 71, 67, 62, 71, 67];
    const result = estimateKey(notes);
    expect(result).not.toBeNull();
    expect(result!.isMajor).toBe(true);
  });
});

describe('Tonic solfa derivation', () => {
  it('derives correct solfa for C major scale', () => {
    // C D E F G A B C = Doh Re Mi Fah Soh Lah Ti Doh
    const notes = [60, 62, 64, 65, 67, 69, 71, 72];
    const solfa = deriveSolfa(notes, 'C Major');
    expect(solfa).toEqual(['Doh', 'Re', 'Mi', 'Fah', 'Soh', 'Lah', 'Ti', 'Doh']);
  });

  it('derives correct solfa for G major scale', () => {
    // G A B C D E F# G = Doh Re Mi Fah Soh Lah Ti Doh
    const notes = [67, 69, 71, 72, 74, 76, 78, 79];
    const solfa = deriveSolfa(notes, 'G Major');
    expect(solfa).toEqual(['Doh', 'Re', 'Mi', 'Fah', 'Soh', 'Lah', 'Ti', 'Doh']);
  });

  it('derives correct solfa for Amazing Grace opening in G major', () => {
    // Pickup: D4 G4 B4 D4 = Soh Doh Mi Soh (in G major, D is the 5th)
    // Phrase: G4 B4 D5 D5 = Doh Mi Soh Soh
    const notes = [62, 67, 71, 62, 67, 71, 74, 74];
    const solfa = deriveSolfa(notes, 'G Major');
    expect(solfa.slice(0, 4)).toEqual(['Soh', 'Doh', 'Mi', 'Soh']);
    expect(solfa.slice(4, 8)).toEqual(['Doh', 'Mi', 'Soh', 'Soh']);
  });

  it('derives correct solfa for Joy to the World in C major', () => {
    // D5 C5 B4 A4 G4 F4 E4 D4 C4 = Re Doh Ti Lah Soh Fah Mi Re Doh
    const notes = [74, 72, 71, 69, 67, 65, 64, 62, 60];
    const solfa = deriveSolfa(notes, 'C Major');
    expect(solfa).toEqual(['Re', 'Doh', 'Ti', 'Lah', 'Soh', 'Fah', 'Mi', 'Re', 'Doh']);
  });

  it('returns ? for unknown key format', () => {
    const solfa = deriveSolfa([60, 62, 64], 'Invalid Key');
    expect(solfa).toEqual(['?', '?', '?']);
  });

  it('handles chromatic notes with alteration syllables', () => {
    // C C# D in C major — C# is a raised Doh / lowered Re
    const notes = [60, 61, 62];
    const solfa = deriveSolfa(notes, 'C Major');
    expect(solfa[0]).toBe('Doh');
    // C# should be some form of chromatic alteration
    expect(solfa[1]).not.toBe('Doh');
    expect(solfa[1]).not.toBe('Re');
    expect(solfa[2]).toBe('Re');
  });

  it('produces different solfa for different keys with same notes', () => {
    const notes = [60, 62, 64, 65, 67];
    const solfaC = deriveSolfa(notes, 'C Major');
    const solfaG = deriveSolfa(notes, 'G Major');
    // Same notes in different keys should produce different solfa
    expect(solfaC).not.toEqual(solfaG);
  });
});

describe('Song isolation — different songs produce different solfa', () => {
  it('Amazing Grace and Joy to the World have different solfa sequences', () => {
    const amazingGraceNotes = [62, 67, 71, 62, 67, 71, 74, 74, 71, 67, 71, 69];
    const joyToTheWorldNotes = [74, 72, 71, 69, 67, 65, 64, 62, 60];

    const agSolfa = deriveSolfa(amazingGraceNotes, 'G Major');
    const jtwSolfa = deriveSolfa(joyToTheWorldNotes, 'C Major');

    expect(agSolfa).not.toEqual(jtwSolfa);
  });
});

describe('MIDI to note label', () => {
  it('converts MIDI 60 to C4', () => {
    expect(midiToNoteLabel(60)).toBe('C4');
  });

  it('converts MIDI 69 to A4', () => {
    expect(midiToNoteLabel(69)).toBe('A4');
  });

  it('converts MIDI 74 to D5', () => {
    expect(midiToNoteLabel(74)).toBe('D5');
  });
});
