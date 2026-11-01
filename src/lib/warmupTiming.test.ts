import { describe, expect, it } from 'vitest';
import {
  REFERENCE_TONE_MS,
  buildPlan,
  centsFromMidi,
  pitchRange,
  pitchTargetAt,
  segmentIndexAt,
  type SegmentSpec,
} from '@/lib/warmupTiming';
import { midiToFrequency } from '@/lib/notes';

const note = (durationMs: number, midi: number, extra: Partial<SegmentSpec> = {}): SegmentSpec => ({
  kind: 'sing',
  durationMs,
  label: 'la',
  midi,
  ...extra,
});

describe('buildPlan', () => {
  it('repeats the cycle back to back and ends at the requested length', () => {
    const plan = buildPlan([note(1000, 60)], 2500);
    expect(plan.segments.map((s) => [s.startMs, s.endMs])).toEqual([
      [0, 1000],
      [1000, 2000],
      [2000, 2500],
    ]);
    expect(plan.totalMs).toBe(2500);
  });

  it('drops a tail shorter than the minimum segment length', () => {
    const plan = buildPlan([note(1000, 60)], 2300);
    expect(plan.segments).toHaveLength(2);
    expect(plan.totalMs).toBe(2000);
  });

  it('returns an empty plan for an empty cycle or zero length', () => {
    expect(buildPlan([], 5000)).toEqual({ totalMs: 0, segments: [] });
    expect(buildPlan([note(1000, 60)], 0)).toEqual({ totalMs: 0, segments: [] });
  });

  it('only marks pitched segments as reference tones, with a delayed listen start', () => {
    const plan = buildPlan([note(1000, 60), { kind: 'breath-in', durationMs: 4000, label: 'in' }], 5000);
    const [pitched, breath] = plan.segments;
    expect(pitched.reference).toBe(true);
    expect(pitched.listenFromMs).toBe(500);
    expect(breath.reference).toBe(false);
    expect(breath.midi).toBeNull();
  });

  it('shortens the reference lead on short notes but keeps it after the tone', () => {
    const plan = buildPlan([note(700, 60)], 700);
    const lead = plan.segments[0].listenFromMs - plan.segments[0].startMs;
    expect(lead).toBe(420);
    expect(lead).toBeGreaterThanOrEqual(REFERENCE_TONE_MS);
  });

  it('keeps unreferenced pitched segments listening almost immediately', () => {
    const plan = buildPlan([note(1000, 62, { reference: false })], 1000);
    expect(plan.segments[0].listenFromMs).toBe(200);
  });
});

describe('segment lookup', () => {
  it('returns the segment index that contains a time, or -1 outside the plan', () => {
    const plan = buildPlan([note(1000, 60)], 2000);
    expect(segmentIndexAt(plan.segments, 0)).toBe(0);
    expect(segmentIndexAt(plan.segments, 1500)).toBe(1);
    expect(segmentIndexAt(plan.segments, 2000)).toBe(-1);
  });
});

describe('pitchTargetAt', () => {
  it('gives no target before the listen window opens, so the reference tone is not scored', () => {
    const plan = buildPlan([note(1000, 60)], 1000);
    expect(pitchTargetAt(plan, 300)).toBeNull();
    expect(pitchTargetAt(plan, 600)).toEqual({ midi: 60, toleranceCents: 50 });
  });

  it('interpolates glide targets across the segment', () => {
    const plan = buildPlan([{ kind: 'glide', durationMs: 1000, label: 'up', midi: 60, midiEnd: 67 }], 1000);
    expect(pitchTargetAt(plan, 750)?.midi).toBeCloseTo(65.25, 5);
    expect(pitchTargetAt(plan, 750)?.toleranceCents).toBe(80);
  });

  it('never gives a pitch target for unpitched speech or breath segments', () => {
    const plan = buildPlan([{ kind: 'say', durationMs: 2000, label: 'Toy boat' }], 2000);
    expect(pitchTargetAt(plan, 1500)).toBeNull();
  });
});

describe('pitch helpers', () => {
  it('measures cents from a target note', () => {
    expect(centsFromMidi(midiToFrequency(69), 69)).toBeCloseTo(0, 6);
    expect(centsFromMidi(midiToFrequency(69) * 2 ** (100 / 1200), 69)).toBeCloseTo(100, 6);
  });

  it('pads the pitch range and keeps at least seven semitones visible', () => {
    const plan = buildPlan([note(1000, 60), note(1000, 61)], 2000);
    expect(pitchRange(plan)).toEqual({ low: 58, high: 65 });
  });

  it('returns no range for a plan with no pitched segments', () => {
    expect(pitchRange(buildPlan([{ kind: 'rest', durationMs: 1000, label: '' }], 1000))).toBeNull();
  });
});
