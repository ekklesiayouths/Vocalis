/**
 * Vocal Blueprint — pure scoring rules for the onboarding skill assessment.
 *
 * Every score is derived from real trials. Nothing here generates or assumes
 * a result. Scores are PROVISIONAL starting-point estimates for choosing
 * courses; they are not clinical or definitive measures of singing ability.
 *
 * SECURITY: No I/O, no storage, no raw audio. Input is derived pitch readings.
 */

import { centsDiffFromTarget, MIN_CLARITY, SILENCE_RMS } from '@/lib/pitchQuest';
import type { AssessmentResult } from '@/lib/profileService';

export interface PitchSample {
  t: number;
  frequency: number | null;
  clarity: number;
  rms: number;
}

export type SampleKind = 'silent' | 'unreliable' | 'octave-error' | 'valid';

export type CaptureStatus = 'ok' | 'silent' | 'unreliable' | 'octave-error' | 'unstable';

export interface CaptureSummary {
  status: CaptureStatus;
  validCount: number;
  medianCents: number | null;
  spreadCents: number | null;
  detectedMidi: number | null;
}

export interface CaptureRules {
  minValid: number;
  maxSpreadCents: number;
}

export const BLUEPRINT_MODULES = {
  ear: { module: 'Musical Ear', skill: 'interval-recognition' },
  pitch: { module: 'Pitch Matching', skill: 'pitch-accuracy' },
  stability: { module: 'Pitch Stability', skill: 'pitch-stability' },
  melody: { module: 'Melody Recall', skill: 'scale-degree-id' },
} as const;

export const PITCH_TRIAL_COUNT = 5;
export const PITCH_CAPTURE_MS = 2500;
export const PITCH_HIT_CENTS = 25;
export const PITCH_RULES: CaptureRules = { minValid: 12, maxSpreadCents: 40 };
export const PITCH_REFERENCE_POOL = [60, 62, 64, 65, 67, 69];
export const OCTAVE_TOLERANCE_CENTS = 50;

export const EAR_TRIAL_COUNT = 8;
export const EAR_BASE_POOL = [60, 62, 64, 65, 67];
export const EAR_INTERVALS = [2, 4, 5, 7];

export const STABILITY_CAPTURE_MS = 6000;
export const STABILITY_RULES: CaptureRules = { minValid: 20, maxSpreadCents: 60 };
export const STABILITY_REFERENCE_OPTIONS = [60, 64, 67];

export const MELODY_POOL = [60, 62, 64, 65, 67];
export const MELODY_LENGTHS = [2, 2, 3];
export const MELODY_NOTE_CAPTURE_MS = 1600;
export const MELODY_CORRECT_CENTS = 50;
export const MELODY_RULES: CaptureRules = { minValid: 8, maxSpreadCents: 50 };

/** Provisional starting levels. Matches the thresholds the learning map already uses. */
export const LEVEL_ADVANCED_MIN = 80;
export const LEVEL_INTERMEDIATE_MIN = 60;

export type ProvisionalLevel = 'beginner' | 'intermediate' | 'advanced';

export type RandomSource = () => number;

export function classifySample(sample: PitchSample, targetMidi: number): { kind: SampleKind; cents: number | null } {
  if (sample.rms < SILENCE_RMS) return { kind: 'silent', cents: null };
  if (sample.frequency === null || sample.clarity < MIN_CLARITY) return { kind: 'unreliable', cents: null };
  const cents = centsDiffFromTarget(sample.frequency, targetMidi);
  if (cents === null) return { kind: 'unreliable', cents: null };
  const octaves = Math.round(cents / 1200);
  if (octaves !== 0 && Math.abs(cents - octaves * 1200) <= OCTAVE_TOLERANCE_CENTS) {
    return { kind: 'octave-error', cents };
  }
  return { kind: 'valid', cents };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function summarizeCapture(samples: PitchSample[], targetMidi: number, rules: CaptureRules): CaptureSummary {
  const classified = samples.map((s) => classifySample(s, targetMidi));
  const countOf = (kind: SampleKind) => classified.filter((c) => c.kind === kind).length;
  const validCents = classified
    .filter((c) => c.kind === 'valid' && c.cents !== null)
    .map((c) => c.cents as number);

  if (validCents.length < rules.minValid) {
    const silentShare = samples.length === 0 ? 1 : countOf('silent') / samples.length;
    let status: CaptureStatus = 'unreliable';
    if (countOf('octave-error') >= rules.minValid) status = 'octave-error';
    else if (silentShare >= 0.7) status = 'silent';
    return { status, validCount: validCents.length, medianCents: null, spreadCents: null, detectedMidi: null };
  }

  const spread = standardDeviation(validCents);
  if (spread > rules.maxSpreadCents) {
    return { status: 'unstable', validCount: validCents.length, medianCents: null, spreadCents: round1(spread), detectedMidi: null };
  }

  const medianCents = Math.round(median(validCents));
  return {
    status: 'ok',
    validCount: validCents.length,
    medianCents,
    spreadCents: round1(spread),
    detectedMidi: targetMidi + Math.round(medianCents / 100),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function pitchTrialScore(medianCents: number): number {
  return clampScore(100 - Math.abs(medianCents));
}

export function isPitchHit(medianCents: number): boolean {
  return Math.abs(medianCents) <= PITCH_HIT_CENTS;
}

export function scorePitchMatching(trialScores: number[]): number {
  if (trialScores.length === 0) return 0;
  return clampScore(trialScores.reduce((a, b) => a + b, 0) / trialScores.length);
}

export function stabilityScore(spreadCents: number): number {
  return clampScore(100 - spreadCents * 2);
}

export function generateEarTrials(rng: RandomSource = Math.random): EarTrial[] {
  const pick = <T,>(items: T[]): T => items[Math.floor(rng() * items.length)];
  const trials: EarTrial[] = [];
  for (let i = 0; i < 2; i++) {
    const base = pick(EAR_BASE_POOL);
    trials.push({ baseMidi: base, targetMidi: base, direction: 'same' });
  }
  for (let i = 0; i < EAR_TRIAL_COUNT - 2; i++) {
    const base = pick(EAR_BASE_POOL);
    const semitones = pick(EAR_INTERVALS);
    const up = i % 2 === 0;
    trials.push({
      baseMidi: base,
      targetMidi: up ? base + semitones : base - semitones,
      direction: up ? 'higher' : 'lower',
    });
  }
  return shuffle(trials, rng);
}

export type EarDirection = 'higher' | 'lower' | 'same';

export interface EarTrial {
  baseMidi: number;
  targetMidi: number;
  direction: EarDirection;
}

export function evaluateEarAnswer(trial: EarTrial, answer: EarDirection): boolean {
  return trial.direction === answer;
}

export function scoreEarTraining(trials: EarTrial[], answers: EarDirection[]): { correct: number; accuracy: number } {
  const correct = trials.filter((trial, i) => evaluateEarAnswer(trial, answers[i])).length;
  return { correct, accuracy: clampScore((correct / trials.length) * 100) };
}

export function generateMelodies(rng: RandomSource = Math.random): number[][] {
  return MELODY_LENGTHS.map((length) => {
    const notes: number[] = [];
    while (notes.length < length) {
      const candidate = MELODY_POOL[Math.floor(rng() * MELODY_POOL.length)];
      if (notes[notes.length - 1] !== candidate) notes.push(candidate);
    }
    return notes;
  });
}

export interface MelodyNoteResult {
  targetMidi: number;
  summary: CaptureSummary;
}

export function isMelodyNoteCorrect(note: MelodyNoteResult): boolean {
  const { summary, targetMidi } = note;
  return summary.status === 'ok'
    && summary.medianCents !== null
    && Math.abs(summary.medianCents) <= MELODY_CORRECT_CENTS
    && summary.detectedMidi === targetMidi;
}

export function scoreMelody(notes: MelodyNoteResult[]): { accuracy: number; notesCorrect: number; notesTotal: number } {
  const perNote = notes.map((note) => {
    if (note.summary.status !== 'ok' || note.summary.medianCents === null) return 0;
    return clampScore(100 - Math.abs(note.summary.medianCents));
  });
  const accuracy = perNote.length === 0 ? 0 : clampScore(perNote.reduce((a, b) => a + b, 0) / perNote.length);
  return {
    accuracy,
    notesCorrect: notes.filter(isMelodyNoteCorrect).length,
    notesTotal: notes.length,
  };
}

export function levelFromAccuracy(accuracy: number): ProvisionalLevel {
  if (accuracy >= LEVEL_ADVANCED_MIN) return 'advanced';
  if (accuracy >= LEVEL_INTERMEDIATE_MIN) return 'intermediate';
  return 'beginner';
}

export function buildCompletedResult(
  assessment: { module: string; skill: string },
  accuracy: number,
  attempts: number,
  validTrials: number,
  completedAt: string = new Date().toISOString(),
): AssessmentResult {
  return {
    module: assessment.module,
    skill: assessment.skill,
    accuracy,
    attempts,
    level: levelFromAccuracy(accuracy),
    source: 'measured',
    status: 'completed',
    validTrials,
    completedAt,
  };
}

export function buildSkippedResult(assessment: { module: string; skill: string }): AssessmentResult {
  return {
    module: assessment.module,
    skill: assessment.skill,
    accuracy: 0,
    attempts: 0,
    level: 'unassessed',
    source: 'estimated',
    status: 'skipped',
    validTrials: 0,
  };
}

function shuffle<T>(items: T[], rng: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
