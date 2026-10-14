/**
 * Music analysis utilities — key estimation and tonic solfa derivation.
 *
 * KEY ESTIMATION:
 * Uses the Krumhansl-Schmuckler key-finding algorithm, which correlates
 * the pitch-class distribution of the melody against major and minor
 * key profiles. Pure math — no external dependencies.
 *
 * SOLFA DERIVATION:
 * Given a detected key and a sequence of MIDI notes, derives movable-do
 * tonic solfa syllables. Follows the standard English convention:
 *   Doh, Re, Mi, Fah, Soh, Lah, Ti
 * Chromatic alterations use the "modified vowel" convention:
 *   Raised: De (Re→), Ri (Mi→), Fi (Fah→), Si (Soh→), Li (Lah→)
 *   Lowered: Ra (→Re), Ma (→Mi), Se (→Soh), Lo (→Lah), Ta (→Ti)
 *
 * Reference: Krumhansl, C. L. (1990). Cognitive Foundations of Musical Pitch.
 *
 * SECURITY: Pure computation — no I/O, no external calls.
 */

/** Standard major key profile (Krumhansl-Schmuckler) */
const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];

/** Standard minor key profile (Krumhansl-Schmuckler) */
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_KEYS = ['C Major', 'C# Major', 'D Major', 'D# Major', 'E Major', 'F Major',
  'F# Major', 'G Major', 'G# Major', 'A Major', 'A# Major', 'B Major'];
const MINOR_KEYS = ['C Minor', 'C# Minor', 'D Minor', 'D# Minor', 'E Minor', 'F Minor',
  'F# Minor', 'G Minor', 'G# Minor', 'A Minor', 'A# Minor', 'B Minor'];

export interface KeyEstimate {
  key: string;
  tonic: number;
  isMajor: boolean;
  confidence: number;
  /** Top 3 candidate keys with their correlation scores */
  candidates: { key: string; score: number }[];
}

/**
 * Estimate the musical key from a collection of MIDI notes.
 * Uses the Krumhansl-Schmuckler algorithm.
 */
export function estimateKey(midiNotes: number[]): KeyEstimate | null {
  if (midiNotes.length === 0) return null;

  // Build pitch-class histogram (weighted by duration — each note counts equally here)
  const pitchClassCounts = new Array(12).fill(0);
  for (const midi of midiNotes) {
    const pc = ((midi % 12) + 12) % 12;
    pitchClassCounts[pc]++;
  }

  // Normalize the histogram
  const total = pitchClassCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const normalized = pitchClassCounts.map((c) => c / total);

  // Correlate against all 24 key profiles
  const results: { key: string; tonic: number; isMajor: boolean; score: number }[] = [];

  for (let i = 0; i < 12; i++) {
    // Major key starting at pitch class i
    const majorScore = correlation(normalized, MAJOR_PROFILE, i);
    results.push({ key: MAJOR_KEYS[i], tonic: i, isMajor: true, score: majorScore });

    // Minor key starting at pitch class i
    const minorScore = correlation(normalized, MINOR_PROFILE, i);
    results.push({ key: MINOR_KEYS[i], tonic: i, isMajor: false, score: minorScore });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  const best = results[0];
  const top3 = results.slice(0, 3).map((r) => ({ key: r.key, score: r.score }));

  // Confidence: how much the best score exceeds the second best
  const secondScore = results[1]?.score ?? 0;
  const confidence = best.score > 0 ? Math.max(0, (best.score - secondScore) / best.score) : 0;

  return {
    key: best.key,
    tonic: best.tonic,
    isMajor: best.isMajor,
    confidence,
    candidates: top3,
  };
}

/** Circular correlation between a normalized histogram and a profile, rotated by `offset`.
 *  For a key with tonic at pitch class `offset`, histogram[i] is compared with
 *  profile[(i - offset + 12) % 12] — so the profile's tonic (index 0) aligns with
 *  the key's tonic pitch class. */
function correlation(histogram: number[], profile: number[], offset: number): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const pc = (i - offset + 12) % 12;
    sum += histogram[i] * profile[pc];
  }
  return sum;
}

// ============================================================
// TONIC SOLFA DERIVATION
// ============================================================

/**
 * Solfa syllables for natural (diatonic) scale degrees in major keys.
 * Index 0 = tonic (Doh), 11 = leading tone (Ti).
 */
const MAJOR_SOLFA = ['Doh', 'Re', 'Mi', 'Fah', 'Soh', 'Lah', 'Ti'];

/**
 * Solfa syllables for natural (diatonic) scale degrees in minor keys.
 * Index 0 = tonic (Lah in movable-do minor), 11 = leading tone.
 */
const MINOR_SOLFA = ['Lah', 'Ti', 'Doh', 'Re', 'Mi', 'Fah', 'Soh'];

/**
 * Chromatic alteration syllables.
 * For raised degrees (sharps): use the "i" variant
 * For lowered degrees (flats): use the "a/e" variant
 */
const RAISED_SOLFA: Record<number, string> = {
  1: 'Ra', // raised Re → De (but conventionally "Ra" is lowered Re; raised is "Ri")
  2: 'Ri', // raised Mi → not standard, but we handle it
  4: 'Fi', // raised Fah → Fi
  5: 'Si', // raised Soh → Si
};

const LOWERED_SOLFA: Record<number, string> = {
  1: 'Ra', // lowered Re → Ra
  2: 'Ma', // lowered Mi → Ma
  5: 'Se', // lowered Soh → Se
  6: 'Lo', // lowered Lah → Lo
};

/**
 * Derive tonic solfa syllables from MIDI notes and a key estimate.
 *
 * @param midiNotes - Array of MIDI note numbers
 * @param key - The estimated or confirmed key (e.g., "G Major")
 * @returns Array of solfa syllable strings, parallel to midiNotes
 */
export function deriveSolfa(midiNotes: number[], key: string): string[] {
  const keyInfo = parseKeyName(key);
  if (!keyInfo) return midiNotes.map(() => '?');

  const { tonic, isMajor } = keyInfo;
  const diatonicSet = isMajor
    ? new Set([0, 2, 4, 5, 7, 9, 11].map((n) => (n + tonic) % 12))
    : new Set([0, 2, 3, 5, 7, 8, 10].map((n) => (n + tonic) % 12));

  return midiNotes.map((midi) => {
    const pc = ((midi % 12) + 12) % 12;
    const degreeFromTonic = ((pc - tonic) + 12) % 12;

    // Check if this pitch class is in the diatonic set
    if (diatonicSet.has(pc)) {
      return degreeToSolfa(degreeFromTonic, isMajor);
    }

    // Chromatic alteration — determine if raised or lowered
    // Check if the natural degree below is in the diatonic set
    const lowerDegree = (degreeFromTonic - 1 + 12) % 12;
    const upperDegree = (degreeFromTonic + 1) % 12;

    const lowerIsDiatonic = diatonicSet.has((lowerDegree + tonic) % 12);
    const upperIsDiatonic = diatonicSet.has((upperDegree + tonic) % 12);

    if (lowerIsDiatonic && !upperIsDiatonic) {
      // This note is a raised version of the degree below
      const raisedSolfa = RAISED_SOLFA[lowerDegree];
      return raisedSolfa ?? `${degreeToSolfa(lowerDegree, isMajor)}#`;
    }

    if (upperIsDiatonic && !lowerIsDiatonic) {
      // This note is a lowered version of the degree above
      const loweredSolfa = LOWERED_SOLFA[upperDegree];
      return loweredSolfa ?? `${degreeToSolfa(upperDegree, isMajor)}b`;
    }

    // Ambiguous — just use the note name with a sharp
    return `${NOTE_NAMES[pc]}`;
  });
}

/** Convert a scale degree (0-11 semitones from tonic) to a solfa syllable */
function degreeToSolfa(degree: number, isMajor: boolean): string {
  const solfaSet = isMajor ? MAJOR_SOLFA : MINOR_SOLFA;
  // Map semitone intervals to diatonic positions
  const diatonicMap: Record<number, number> = isMajor
    ? { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 }
    : { 0: 0, 2: 1, 3: 2, 5: 3, 7: 4, 8: 5, 10: 6 };
  const idx = diatonicMap[degree];
  return idx !== undefined ? solfaSet[idx] : NOTE_NAMES[degree];
}

/** Parse a key name like "G Major" or "E Minor" into tonic pitch class and mode */
function parseKeyName(key: string): { tonic: number; isMajor: boolean } | null {
  const match = key.match(/^([A-G][#b]?)\s+(Major|Minor)$/i);
  if (!match) return null;
  const noteName = match[1];
  const mode = match[2].toLowerCase();
  const tonic = NOTE_NAMES.indexOf(noteName);
  if (tonic === -1) return null;
  return { tonic, isMajor: mode === 'major' };
}

/**
 * Get the note name for a MIDI note number (with octave).
 */
export function midiToNoteLabel(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}
