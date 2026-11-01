/**
 * Pitch Ball game rules: pitch-to-height mapping, octave-jump guard,
 * gate judgement, and note-match checks. Pure functions only, no audio or DOM.
 */

import { centsDiffFromTarget, MIN_CLARITY, SILENCE_RMS, DEFAULT_HOLD_MS } from '@/lib/pitchQuest';

export interface VoiceRange {
  lowMidi: number;
  highMidi: number;
}

export interface TrackState {
  acceptedMidi: number | null;
  candidateMidi: number | null;
  candidateFrames: number;
  silentFrames: number;
}

export interface Gate {
  id: number;
  /** Horizontal position as a fraction of the canvas width; the ball sits at BALL_X. */
  x: number;
  gapY: number;
  gapH: number;
  noteMidi: number | null;
  noteLabel: string | null;
  resolved: boolean;
  passed: boolean;
}

export const MIN_RANGE_SEMITONES = 7;
export const BALL_X = 0.22;
export const BALL_RADIUS = 0.045;
export const LIVES_START = 3;
export const GATE_SPACING = 0.5;
export const SMOOTHING_TAU_MS = 90;
export const SILENCE_RESET_FRAMES = 30;
export const OCTAVE_JUMP_SEMITONES = 9;
export const JUMP_CONFIRM_FRAMES = 8;
export const MATCH_TOLERANCE_CENTS = 50;
export const MATCH_HOLD_MS = DEFAULT_HOLD_MS;
export const GATE_PASS_POINTS = 10;
export const NOTE_MATCH_POINTS = 5;
export const INITIAL_TRACK: TrackState = {
  acceptedMidi: null,
  candidateMidi: null,
  candidateFrames: 0,
  silentFrames: 0,
};

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function freqToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function isReliableReading(frequency: number | null, clarity: number, rms: number): boolean {
  return frequency !== null && Number.isFinite(frequency) && frequency > 0 && clarity >= MIN_CLARITY && rms >= SILENCE_RMS;
}

export function createVoiceRange(lowMidi: number, highMidi: number): VoiceRange | null {
  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) return null;
  if (highMidi - lowMidi < MIN_RANGE_SEMITONES) return null;
  return { lowMidi, highMidi };
}

/** Higher pitch maps to a lower y value (top of the canvas). */
export function midiToY(midi: number, range: VoiceRange): number {
  const t = (midi - range.lowMidi) / (range.highMidi - range.lowMidi);
  return 1 - clamp01(t);
}

export function yToMidi(y: number, range: VoiceRange): number {
  return range.lowMidi + (1 - clamp01(y)) * (range.highMidi - range.lowMidi);
}

export function smoothY(current: number, target: number, dtMs: number): number {
  if (dtMs <= 0) return current;
  const alpha = 1 - Math.exp(-dtMs / SMOOTHING_TAU_MS);
  return current + (target - current) * alpha;
}

/**
 * Accepts a reliable pitch (already filtered for clarity and loudness) and returns
 * the pitch the ball should follow. Silence keeps the last accepted pitch. A jump
 * larger than an octave-jump threshold is only accepted once it persists.
 */
export function trackPitch(state: TrackState, midi: number | null): TrackState {
  if (midi === null) {
    const silentFrames = state.silentFrames + 1;
    if (silentFrames >= SILENCE_RESET_FRAMES) {
      return { acceptedMidi: null, candidateMidi: null, candidateFrames: 0, silentFrames };
    }
    return { ...state, candidateMidi: null, candidateFrames: 0, silentFrames };
  }

  if (state.acceptedMidi === null || Math.abs(midi - state.acceptedMidi) <= OCTAVE_JUMP_SEMITONES) {
    return { acceptedMidi: midi, candidateMidi: null, candidateFrames: 0, silentFrames: 0 };
  }

  if (state.candidateMidi !== null && Math.abs(midi - state.candidateMidi) <= 1) {
    const candidateFrames = state.candidateFrames + 1;
    if (candidateFrames >= JUMP_CONFIRM_FRAMES) {
      return { acceptedMidi: midi, candidateMidi: null, candidateFrames: 0, silentFrames: 0 };
    }
    return { ...state, candidateMidi: midi, candidateFrames, silentFrames: 0 };
  }

  return { ...state, candidateMidi: midi, candidateFrames: 1, silentFrames: 0 };
}

/** True when a reliable reading sits within tolerance of the target, in the same octave. */
export function isNoteOnTarget(frequency: number | null, clarity: number, rms: number, targetMidi: number): boolean {
  if (!isReliableReading(frequency, clarity, rms) || frequency === null) return false;
  if (Math.round(freqToMidi(frequency)) !== targetMidi) return false;
  const cents = centsDiffFromTarget(frequency, targetMidi);
  return cents !== null && Math.abs(cents) <= MATCH_TOLERANCE_CENTS;
}

export function gateHeightFor(level: number): number {
  return Math.max(0.2, 0.36 - 0.02 * level);
}

export function speedFor(level: number): number {
  return 0.14 + 0.02 * Math.min(level, 10);
}

export function clampGapY(y: number, gapH: number): number {
  const half = gapH / 2 + 0.02;
  return Math.min(1 - half, Math.max(half, y));
}

/** A gate is passed when the ball's centre and radius both fit inside the opening. */
export function judgeGate(ballY: number, gate: Pick<Gate, 'gapY' | 'gapH'>): boolean {
  const halfOpening = gate.gapH / 2 - BALL_RADIUS;
  return Math.abs(ballY - gate.gapY) <= halfOpening;
}

export function levelFor(gatesPassed: number): number {
  return 1 + Math.floor(gatesPassed / 5);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Calibration needs a steady note: every sample must stay within half a semitone of the median. */
export function isSteadySample(midis: number[]): boolean {
  const mid = median(midis);
  if (mid === null || midis.length < 10) return false;
  return midis.every((m) => Math.abs(m - mid) <= 0.5);
}
