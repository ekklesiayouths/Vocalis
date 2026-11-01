import { isReliableReading } from '@/lib/pitchBall';
import { centsFromMidi, type PitchTarget } from '@/lib/warmupTiming';

export interface VoiceReading {
  frequency: number | null;
  clarity: number;
  rms: number;
}

export interface ScoreStats {
  eligibleFrames: number;
  voicedFrames: number;
  inTuneFrames: number;
  sharpFrames: number;
  flatFrames: number;
}

export interface ExerciseResult {
  durationMs: number;
  usesPitch: boolean;
  accuracyPct: number | null;
  coveragePct: number | null;
  tendency: 'sharp' | 'flat' | 'balanced' | null;
  message: string;
}

const MIN_COVERAGE_PCT = 20;
const TENDENCY_SHARE = 0.15;

export const emptyStats: ScoreStats = {
  eligibleFrames: 0,
  voicedFrames: 0,
  inTuneFrames: 0,
  sharpFrames: 0,
  flatFrames: 0,
};

export function addSample(
  stats: ScoreStats,
  target: PitchTarget | null,
  reading: VoiceReading
): ScoreStats {
  if (!target) return stats;
  const next = { ...stats, eligibleFrames: stats.eligibleFrames + 1 };
  if (!isReliableReading(reading.frequency, reading.clarity, reading.rms) || reading.frequency === null) {
    return next;
  }
  const cents = centsFromMidi(reading.frequency, target.midi);
  next.voicedFrames += 1;
  if (Math.abs(cents) <= target.toleranceCents) next.inTuneFrames += 1;
  else if (cents > 0) next.sharpFrames += 1;
  else next.flatFrames += 1;
  return next;
}

export function summarizeResult(
  stats: ScoreStats,
  usesPitch: boolean,
  durationMs: number
): ExerciseResult {
  if (!usesPitch) {
    return {
      durationMs,
      usesPitch,
      accuracyPct: null,
      coveragePct: null,
      tendency: null,
      message: 'Completed. This exercise works on breath and rhythm, so no pitch score is shown.',
    };
  }
  if (stats.eligibleFrames === 0) {
    return {
      durationMs,
      usesPitch,
      accuracyPct: null,
      coveragePct: null,
      tendency: null,
      message: 'No singing segments were scored in this exercise.',
    };
  }

  const coveragePct = Math.round((stats.voicedFrames / stats.eligibleFrames) * 100);
  if (coveragePct < MIN_COVERAGE_PCT) {
    return {
      durationMs,
      usesPitch,
      accuracyPct: null,
      coveragePct,
      tendency: null,
      message:
        'We could not hear enough steady singing to score this. Sing at a comfortable volume, close to the microphone.',
    };
  }

  const accuracyPct = Math.round((stats.inTuneFrames / stats.voicedFrames) * 100);
  const sharpShare = stats.sharpFrames / stats.voicedFrames;
  const flatShare = stats.flatFrames / stats.voicedFrames;
  const tendency =
    sharpShare > TENDENCY_SHARE && stats.sharpFrames > stats.flatFrames
      ? 'sharp'
      : flatShare > TENDENCY_SHARE && stats.flatFrames > stats.sharpFrames
        ? 'flat'
        : 'balanced';
  const tendencyNote = {
    sharp: ' Your pitch drifted sharp more often than flat, so try a lighter, relaxed start to each note.',
    flat: ' Your pitch drifted flat more often than sharp, so support each note with a steady breath.',
    balanced: '',
  }[tendency];

  return {
    durationMs,
    usesPitch,
    accuracyPct,
    coveragePct,
    tendency,
    message: `In tune for ${accuracyPct}% of the notes you sang.${tendencyNote}`,
  };
}
