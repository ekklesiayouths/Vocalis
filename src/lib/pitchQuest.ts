/**
 * Vocalis Pitch Quest — testable game logic.
 *
 * Pure functions for note-sequence generation, cents comparison, pitch
 * tolerance, sustained-note requirement, silence/instability rejection,
 * and scoring. No DOM, no React, no audio I/O — fully unit-testable.
 *
 * SECURITY: No I/O, no storage. Pure math.
 */

import { midiToFrequency, midiToNoteName, frequencyToNote } from '@/lib/notes';

// ─── Types ─────────────────────────────────────────────────────────────

export interface QuestNote {
  midi: number;
  solfege: string;
  label: string;
}

export interface QuestLevel {
  name: string;
  keyName: string;
  keyRootMidi: number;
  notes: QuestNote[];
}

export type PitchZone = 'silent' | 'below' | 'near-below' | 'on-target' | 'near-above' | 'above';

export interface PitchAssessment {
  zone: PitchZone;
  centsDiff: number | null;
  /** True when the reading is reliable enough to count toward sustained-note progress. */
  reliable: boolean;
}

export interface QuestScore {
  notesAttempted: number;
  notesMatched: number;
  /** Average absolute cents deviation across all matched notes. */
  avgCentsDeviation: number;
  /** Average hold time in ms for matched notes. */
  avgHoldMs: number;
  /** Total time from first note attempt to level completion, in ms. */
  totalTimeMs: number;
  /** 0–100 final score. */
  score: number;
  /** Short encouraging summary. */
  summary: string;
}

// ─── Constants ─────────────────────────────────────────────────────────

/** Default tolerance in cents for "on target." */
export const DEFAULT_TOLERANCE_CENTS = 50;
/** Minimum clarity from the pitch detector to trust a reading. */
export const MIN_CLARITY = 0.5;
/** RMS below this is silence, not singing. */
export const SILENCE_RMS = 0.01;
/** How long the player must hold an accurate note to pass a gate, in ms. */
export const DEFAULT_HOLD_MS = 600;
/** Maximum cents deviation that still counts as "holding" the note. */
export const HOLD_TOLERANCE_CENTS = 60;

// ─── Level generation ──────────────────────────────────────────────────

const SOLFEGE_5 = ['Do', 'Re', 'Mi', 'Fa', 'Sol'];
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7];

/**
 * Generate a 5-note ascending level (Do Re Mi Fa Sol) in the given key.
 * @param keyRootMidi MIDI note number for the tonic (e.g. 60 = C4)
 */
export function createLevel(keyRootMidi: number = 60, keyName: string = 'C Major'): QuestLevel {
  const notes: QuestNote[] = MAJOR_SCALE_INTERVALS.map((interval, i) => {
    const midi = keyRootMidi + interval;
    return {
      midi,
      solfege: SOLFEGE_5[i],
      label: `${SOLFEGE_5[i]} (${midiToNoteName(midi)})`,
    };
  });
  return {
    name: `${keyName} — Do Re Mi Fa Sol`,
    keyName,
    keyRootMidi,
    notes,
  };
}

// ─── Pitch assessment ──────────────────────────────────────────────────

/**
 * Convert a frequency to a cents difference from a target MIDI note.
 * Returns null for invalid input.
 */
export function centsDiffFromTarget(frequency: number, targetMidi: number): number | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const targetFreq = midiToFrequency(targetMidi);
  return Math.round(1200 * Math.log2(frequency / targetFreq));
}

/**
 * Classify a live pitch reading into a zone relative to the target.
 * Rejects silence and unstable readings.
 */
export function assessPitch(
  frequency: number | null,
  clarity: number,
  rms: number,
  targetMidi: number,
  toleranceCents: number = DEFAULT_TOLERANCE_CENTS
): PitchAssessment {
  // Silence check — don't count mic noise as singing
  if (rms < SILENCE_RMS) {
    return { zone: 'silent', centsDiff: null, reliable: false };
  }

  // Instability check — low clarity means the detector isn't confident
  if (clarity < MIN_CLARITY || !Number.isFinite(frequency) || frequency === null || frequency <= 0) {
    return { zone: 'silent', centsDiff: null, reliable: false };
  }

  const cents = centsDiffFromTarget(frequency, targetMidi);
  if (cents === null) {
    return { zone: 'silent', centsDiff: null, reliable: false };
  }

  const absCents = Math.abs(cents);
  const nearRange = toleranceCents * 2; // "near" zone is 1x–2x tolerance

  let zone: PitchZone;
  if (absCents <= toleranceCents) {
    zone = 'on-target';
  } else if (cents < 0 && absCents <= nearRange) {
    zone = 'near-below';
  } else if (cents > 0 && absCents <= nearRange) {
    zone = 'near-above';
  } else if (cents < 0) {
    zone = 'below';
  } else {
    zone = 'above';
  }

  return { zone, centsDiff: cents, reliable: true };
}

// ─── Sustained-note tracking ───────────────────────────────────────────

/**
 * Given a timestamp and whether the current reading is "on target,"
 * compute the accumulated hold time.
 *
 * This is a pure function — the caller maintains the state between calls
 * and passes it in.
 */
export interface HoldState {
  holdMs: number;
  lastOnTargetTime: number | null;
}

export function updateHold(
  state: HoldState,
  isOnTarget: boolean,
  now: number
): HoldState {
  if (isOnTarget) {
    if (state.lastOnTargetTime === null) {
      return { holdMs: 0, lastOnTargetTime: now };
    }
    const elapsed = now - state.lastOnTargetTime;
    return {
      holdMs: state.holdMs + elapsed,
      lastOnTargetTime: now,
    };
  }
  // Reset when off target — the player must hold continuously
  return { holdMs: 0, lastOnTargetTime: null };
}

/**
 * Returns true when the accumulated hold time meets the required duration.
 */
export function isHoldComplete(holdMs: number, requiredMs: number = DEFAULT_HOLD_MS): boolean {
  return holdMs >= requiredMs;
}

// ─── Scoring ───────────────────────────────────────────────────────────

/**
 * Compute the final quest score from gameplay stats.
 *
 * Score factors:
 * - Notes matched / attempted (50% weight)
 * - Pitch accuracy: lower avg cents deviation = higher score (30% weight)
 * - Sustain consistency: longer avg hold time = higher score (20% weight)
 *
 * Never awards hardcoded scores — all inputs come from real gameplay.
 */
export function computeQuestScore(
  notesAttempted: number,
  notesMatched: number,
  matchedCentsDeviations: number[],
  matchedHoldMs: number[],
  totalTimeMs: number
): QuestScore {
  if (notesAttempted === 0) {
    return {
      notesAttempted: 0,
      notesMatched: 0,
      avgCentsDeviation: 0,
      avgHoldMs: 0,
      totalTimeMs: 0,
      score: 0,
      summary: 'No notes attempted yet — give it a try!',
    };
  }

  const matchRate = notesMatched / notesAttempted;
  const matchScore = matchRate * 50;

  const avgCents = matchedCentsDeviations.length > 0
    ? matchedCentsDeviations.reduce((a, b) => a + Math.abs(b), 0) / matchedCentsDeviations.length
    : 100;
  // 0 cents deviation → 30 points, 100+ cents → 0 points
  const accuracyScore = Math.max(0, (1 - avgCents / 100) * 30);

  const avgHold = matchedHoldMs.length > 0
    ? matchedHoldMs.reduce((a, b) => a + b, 0) / matchedHoldMs.length
    : 0;
  // 0ms hold → 0 points, 1000ms+ hold → 20 points
  const sustainScore = Math.min(20, (avgHold / 1000) * 20);

  const score = Math.round(matchScore + accuracyScore + sustainScore);

  let summary: string;
  if (score >= 90) {
    summary = 'Outstanding! Your pitch was accurate and steady — you sailed through every gate.';
  } else if (score >= 70) {
    summary = 'Great work! You hit most notes with good accuracy. Keep practicing for even steadier pitch.';
  } else if (score >= 50) {
    summary = 'Nice effort! You matched several notes. Focus on sustaining each note a little longer.';
  } else if (score >= 25) {
    summary = 'Good try! Try hearing the target note first, then matching it gently. Accuracy comes with practice.';
  } else {
    summary = 'Every singer starts here! Use the Hear Note button, take your time, and try again.';
  }

  return {
    notesAttempted,
    notesMatched,
    avgCentsDeviation: Math.round(avgCents),
    avgHoldMs: Math.round(avgHold),
    totalTimeMs,
    score,
    summary,
  };
}

// ─── Manual mode ───────────────────────────────────────────────────────

/**
 * Manual mode lets players practice without a microphone by tapping
 * "I sang it" buttons. It does NOT measure pitch accuracy and must not
 * claim to. Returns a score that only reflects completion, not accuracy.
 */
export function computeManualScore(notesCompleted: number, totalNotes: number): QuestScore {
  const completionRate = totalNotes > 0 ? notesCompleted / totalNotes : 0;
  const score = Math.round(completionRate * 50); // capped at 50 — no accuracy data

  return {
    notesAttempted: notesCompleted,
    notesMatched: notesCompleted,
    avgCentsDeviation: 0,
    avgHoldMs: 0,
    totalTimeMs: 0,
    score,
    summary: notesCompleted === totalNotes
      ? 'Manual practice complete! This did not measure your pitch — try microphone mode for a real accuracy score.'
      : 'Manual practice in progress. Remember: this mode does not measure singing accuracy.',
  };
}
