/**
 * Note detection utility — converts raw frequency (Hz) to the nearest musical
 * note name and octave, and computes the cents offset (sharp/flat deviation).
 *
 * No third-party dependencies. Pure math based on equal-temperament tuning
 * with A4 = 440 Hz as the reference pitch.
 *
 * SECURITY: This module performs no I/O and stores nothing. It is a pure
 * function library — all audio data stays in the browser and is never
 * transmitted or persisted.
 */

export interface NoteInfo {
  /** Note name without octave, e.g. "A", "C#", "Bb" */
  noteName: string;
  /** Full label including octave, e.g. "A4", "C#5" */
  fullLabel: string;
  /** Octave number (0–8 for typical vocal range) */
  octave: number;
  /** Ideal/reference frequency for this note in Hz */
  referenceFrequency: number;
  /** Cents deviation from the ideal note: negative = flat, positive = sharp */
  cents: number;
  /** Convenience: "sharp" | "flat" | "in-tune" */
  tuning: 'sharp' | 'flat' | 'in-tune';
}

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

const A4_FREQUENCY = 440;
const A4_MIDI_NUMBER = 69;
const CENTS_PER_SEMITONE = 100;

/** Cents within which we consider the note "in tune" */
export const IN_TUNE_THRESHOLD_CENTS = 5;

/**
 * Convert a frequency in Hz to the nearest musical note.
 *
 * @param frequency - raw frequency in Hz (must be > 0)
 * @returns NoteInfo or null if the frequency is invalid
 */
export function frequencyToNote(frequency: number): NoteInfo | null {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }

  const midiFloat = A4_MIDI_NUMBER + 12 * Math.log2(frequency / A4_FREQUENCY);
  const midiNumber = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midiNumber) * CENTS_PER_SEMITONE);

  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = ((midiNumber % 12) + 12) % 12;
  const noteName = NOTE_NAMES[noteIndex];
  const referenceFrequency = A4_FREQUENCY * Math.pow(2, (midiNumber - A4_MIDI_NUMBER) / 12);

  const absCents = Math.abs(cents);
  const tuning: NoteInfo['tuning'] =
    absCents <= IN_TUNE_THRESHOLD_CENTS
      ? 'in-tune'
      : cents > 0
        ? 'sharp'
        : 'flat';

  return {
    noteName,
    fullLabel: `${noteName}${octave}`,
    octave,
    referenceFrequency,
    cents,
    tuning,
  };
}

/**
 * Convert a MIDI note number to its frequency in Hz.
 */
export function midiToFrequency(midiNumber: number): number {
  return A4_FREQUENCY * Math.pow(2, (midiNumber - A4_MIDI_NUMBER) / 12);
}

/**
 * Get the note name for a MIDI note number (without octave).
 */
export function midiToNoteName(midiNumber: number): string {
  const noteIndex = ((midiNumber % 12) + 12) % 12;
  return NOTE_NAMES[noteIndex];
}
