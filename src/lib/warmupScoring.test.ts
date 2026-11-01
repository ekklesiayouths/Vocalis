import { describe, expect, it } from 'vitest';
import { addSample, emptyStats, summarizeResult, type ScoreStats } from '@/lib/warmupScoring';
import { midiToFrequency } from '@/lib/notes';

const target = { midi: 69, toleranceCents: 50 };
const voiced = (frequency: number) => ({ frequency, clarity: 0.9, rms: 0.1 });
const SILENT = { frequency: null, clarity: 0, rms: 0 };

describe('addSample', () => {
  it('ignores frames with no pitch target', () => {
    expect(addSample(emptyStats, null, voiced(440))).toEqual(emptyStats);
  });

  it('counts a target frame without voice as eligible but not voiced', () => {
    const next = addSample(emptyStats, target, SILENT);
    expect(next.eligibleFrames).toBe(1);
    expect(next.voicedFrames).toBe(0);
  });

  it('classifies a steady frame as in tune, sharp, or flat by its cents offset', () => {
    const inTune = addSample(emptyStats, target, voiced(midiToFrequency(69) * 2 ** (30 / 1200)));
    const sharp = addSample(emptyStats, target, voiced(midiToFrequency(69) * 2 ** (120 / 1200)));
    const flat = addSample(emptyStats, target, voiced(midiToFrequency(69) * 2 ** (-120 / 1200)));
    expect(inTune).toMatchObject({ voicedFrames: 1, inTuneFrames: 1 });
    expect(sharp).toMatchObject({ voicedFrames: 1, sharpFrames: 1, inTuneFrames: 0 });
    expect(flat).toMatchObject({ voicedFrames: 1, flatFrames: 1, inTuneFrames: 0 });
  });

  it('treats an octave error as off target rather than in tune', () => {
    const next = addSample(emptyStats, target, voiced(midiToFrequency(81)));
    expect(next.inTuneFrames).toBe(0);
    expect(next.sharpFrames).toBe(1);
  });
});

describe('summarizeResult', () => {
  it('shows no pitch score for breath and diction exercises', () => {
    const result = summarizeResult(emptyStats, false, 60000);
    expect(result.accuracyPct).toBeNull();
    expect(result.coveragePct).toBeNull();
    expect(result.message).toMatch(/no pitch score/);
  });

  it('withholds accuracy when too little singing was heard', () => {
    const stats: ScoreStats = { eligibleFrames: 100, voicedFrames: 10, inTuneFrames: 10, sharpFrames: 0, flatFrames: 0 };
    const result = summarizeResult(stats, true, 30000);
    expect(result.accuracyPct).toBeNull();
    expect(result.coveragePct).toBe(10);
  });

  it('reports in-tune share over voiced frames', () => {
    const stats: ScoreStats = { eligibleFrames: 10, voicedFrames: 10, inTuneFrames: 8, sharpFrames: 1, flatFrames: 1 };
    const result = summarizeResult(stats, true, 30000);
    expect(result.accuracyPct).toBe(80);
    expect(result.coveragePct).toBe(100);
    expect(result.tendency).toBe('balanced');
    expect(result.message).toBe('In tune for 80% of the notes you sang.');
  });

  it('names a sharp tendency only when sharp frames clearly dominate', () => {
    const stats: ScoreStats = { eligibleFrames: 10, voicedFrames: 10, inTuneFrames: 5, sharpFrames: 4, flatFrames: 1 };
    const result = summarizeResult(stats, true, 30000);
    expect(result.tendency).toBe('sharp');
    expect(result.message).toContain('sharp');
  });
});
