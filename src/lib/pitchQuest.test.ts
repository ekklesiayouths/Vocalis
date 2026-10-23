import { describe, it, expect } from 'vitest';
import {
  createLevel,
  centsDiffFromTarget,
  assessPitch,
  updateHold,
  isHoldComplete,
  computeQuestScore,
  computeManualScore,
  DEFAULT_TOLERANCE_CENTS,
  DEFAULT_HOLD_MS,
  HOLD_TOLERANCE_CENTS,
  MIN_CLARITY,
  SILENCE_RMS,
  type HoldState,
} from './pitchQuest';
import { midiToFrequency } from './notes';

describe('pitchQuest', () => {
  // ─── Level generation ────────────────────────────────────────────
  describe('createLevel', () => {
    it('generates a 5-note Do Re Mi Fa Sol sequence in C major', () => {
      const level = createLevel(60, 'C Major');
      expect(level.notes).toHaveLength(5);
      expect(level.notes.map((n) => n.solfege)).toEqual(['Do', 'Re', 'Mi', 'Fa', 'Sol']);
      expect(level.notes.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67]);
    });

    it('uses correct MIDI intervals for the major scale', () => {
      const level = createLevel(62, 'D Major');
      expect(level.notes.map((n) => n.midi)).toEqual([62, 64, 66, 67, 69]);
    });

    it('includes the key name in the level name', () => {
      const level = createLevel(60, 'C Major');
      expect(level.name).toContain('C Major');
    });
  });

  // ─── Cents difference ────────────────────────────────────────────
  describe('centsDiffFromTarget', () => {
    it('returns 0 for an exact match', () => {
      const freq = midiToFrequency(60);
      expect(centsDiffFromTarget(freq, 60)).toBe(0);
    });

    it('returns positive cents for a sharp frequency', () => {
      const targetFreq = midiToFrequency(60);
      const sharpFreq = targetFreq * Math.pow(2, 30 / 1200);
      expect(centsDiffFromTarget(sharpFreq, 60)).toBe(30);
    });

    it('returns negative cents for a flat frequency', () => {
      const targetFreq = midiToFrequency(60);
      const flatFreq = targetFreq * Math.pow(2, -40 / 1200);
      expect(centsDiffFromTarget(flatFreq, 60)).toBe(-40);
    });

    it('returns null for invalid frequency', () => {
      expect(centsDiffFromTarget(0, 60)).toBeNull();
      expect(centsDiffFromTarget(-1, 60)).toBeNull();
      expect(centsDiffFromTarget(NaN, 60)).toBeNull();
    });
  });

  // ─── Pitch assessment ────────────────────────────────────────────
  describe('assessPitch', () => {
    const targetMidi = 60;
    const targetFreq = midiToFrequency(targetMidi);

    it('classifies as silent when RMS is below threshold', () => {
      const result = assessPitch(targetFreq, 0.9, SILENCE_RMS / 2, targetMidi);
      expect(result.zone).toBe('silent');
      expect(result.reliable).toBe(false);
    });

    it('classifies as silent when clarity is too low', () => {
      const result = assessPitch(targetFreq, MIN_CLARITY - 0.01, 0.05, targetMidi);
      expect(result.zone).toBe('silent');
      expect(result.reliable).toBe(false);
    });

    it('classifies as silent when frequency is null', () => {
      const result = assessPitch(null, 0.9, 0.05, targetMidi);
      expect(result.zone).toBe('silent');
      expect(result.reliable).toBe(false);
    });

    it('classifies as on-target when within tolerance', () => {
      const onTargetFreq = targetFreq * Math.pow(2, 20 / 1200); // 20 cents sharp
      const result = assessPitch(onTargetFreq, 0.8, 0.05, targetMidi);
      expect(result.zone).toBe('on-target');
      expect(result.reliable).toBe(true);
      expect(result.centsDiff).toBe(20);
    });

    it('classifies as on-target at exactly the tolerance boundary', () => {
      const boundaryFreq = targetFreq * Math.pow(2, DEFAULT_TOLERANCE_CENTS / 1200);
      const result = assessPitch(boundaryFreq, 0.8, 0.05, targetMidi);
      expect(result.zone).toBe('on-target');
    });

    it('classifies as near-below when between 1x and 2x tolerance flat', () => {
      const nearBelowFreq = targetFreq * Math.pow(2, -75 / 1200);
      const result = assessPitch(nearBelowFreq, 0.8, 0.05, targetMidi);
      expect(result.zone).toBe('near-below');
      expect(result.reliable).toBe(true);
    });

    it('classifies as near-above when between 1x and 2x tolerance sharp', () => {
      const nearAboveFreq = targetFreq * Math.pow(2, 80 / 1200);
      const result = assessPitch(nearAboveFreq, 0.8, 0.05, targetMidi);
      expect(result.zone).toBe('near-above');
      expect(result.reliable).toBe(true);
    });

    it('classifies as below when more than 2x tolerance flat', () => {
      const belowFreq = targetFreq * Math.pow(2, -200 / 1200);
      const result = assessPitch(belowFreq, 0.8, 0.05, targetMidi);
      expect(result.zone).toBe('below');
    });

    it('classifies as above when more than 2x tolerance sharp', () => {
      const aboveFreq = targetFreq * Math.pow(2, 200 / 1200);
      const result = assessPitch(aboveFreq, 0.8, 0.05, targetMidi);
      expect(result.zone).toBe('above');
    });
  });

  // ─── Sustained-note tracking ─────────────────────────────────────
  describe('updateHold', () => {
    it('starts hold timer when first on target', () => {
      const state: HoldState = { holdMs: 0, lastOnTargetTime: null };
      const next = updateHold(state, true, 1000);
      expect(next.holdMs).toBe(0);
      expect(next.lastOnTargetTime).toBe(1000);
    });

    it('accumulates hold time across consecutive on-target readings', () => {
      let state: HoldState = { holdMs: 0, lastOnTargetTime: null };
      state = updateHold(state, true, 1000);
      state = updateHold(state, true, 1100);
      expect(state.holdMs).toBe(100);
      state = updateHold(state, true, 1150);
      expect(state.holdMs).toBe(150);
    });

    it('resets hold when off target', () => {
      let state: HoldState = { holdMs: 200, lastOnTargetTime: 1000 };
      state = updateHold(state, false, 1200);
      expect(state.holdMs).toBe(0);
      expect(state.lastOnTargetTime).toBeNull();
    });
  });

  describe('isHoldComplete', () => {
    it('returns true when hold meets required duration', () => {
      expect(isHoldComplete(DEFAULT_HOLD_MS, DEFAULT_HOLD_MS)).toBe(true);
    });

    it('returns false when hold is below required duration', () => {
      expect(isHoldComplete(DEFAULT_HOLD_MS - 1, DEFAULT_HOLD_MS)).toBe(false);
    });

    it('uses default hold requirement when not specified', () => {
      expect(isHoldComplete(DEFAULT_HOLD_MS)).toBe(true);
      expect(isHoldComplete(DEFAULT_HOLD_MS - 1)).toBe(false);
    });
  });

  // ─── Scoring ─────────────────────────────────────────────────────
  describe('computeQuestScore', () => {
    it('returns zero score when no notes attempted', () => {
      const score = computeQuestScore(0, 0, [], [], 0);
      expect(score.score).toBe(0);
      expect(score.summary).toContain('No notes attempted');
    });

    it('factors in match rate (50% weight)', () => {
      const perfect = computeQuestScore(5, 5, [0, 0, 0, 0, 0], [1000, 1000, 1000, 1000, 1000], 30000);
      const partial = computeQuestScore(5, 2, [0, 0], [1000, 1000], 30000);
      expect(perfect.score).toBeGreaterThan(partial.score);
    });

    it('factors in pitch accuracy (30% weight)', () => {
      const accurate = computeQuestScore(5, 5, [5, 5, 5, 5, 5], [600, 600, 600, 600, 600], 30000);
      const inaccurate = computeQuestScore(5, 5, [60, 60, 60, 60, 60], [600, 600, 600, 600, 600], 30000);
      expect(accurate.score).toBeGreaterThan(inaccurate.score);
    });

    it('factors in sustain consistency (20% weight)', () => {
      const longHold = computeQuestScore(5, 5, [10, 10, 10, 10, 10], [1500, 1500, 1500, 1500, 1500], 30000);
      const shortHold = computeQuestScore(5, 5, [10, 10, 10, 10, 10], [200, 200, 200, 200, 200], 30000);
      expect(longHold.score).toBeGreaterThan(shortHold.score);
    });

    it('never awards a score above 100', () => {
      const perfect = computeQuestScore(5, 5, [0, 0, 0, 0, 0], [5000, 5000, 5000, 5000, 5000], 10000);
      expect(perfect.score).toBeLessThanOrEqual(100);
    });

    it('produces an encouraging summary for low scores', () => {
      const score = computeQuestScore(5, 0, [], [], 60000);
      expect(score.summary).toContain('Every singer starts here');
    });

    it('produces a celebration summary for high scores', () => {
      const score = computeQuestScore(5, 5, [0, 0, 0, 0, 0], [2000, 2000, 2000, 2000, 2000], 30000);
      expect(score.summary).toContain('Outstanding');
    });

    it('tracks avgCentsDeviation and avgHoldMs in the result', () => {
      const score = computeQuestScore(5, 3, [10, 20, 15], [800, 600, 700], 25000);
      expect(score.avgCentsDeviation).toBe(15); // avg of |10|,|20|,|15|
      expect(score.avgHoldMs).toBe(700); // avg of 800, 600, 700
    });
  });

  // ─── Manual mode ─────────────────────────────────────────────────
  describe('computeManualScore', () => {
    it('caps score at 50 — no accuracy data', () => {
      const score = computeManualScore(5, 5);
      expect(score.score).toBe(50);
    });

    it('does not claim to measure accuracy', () => {
      const score = computeManualScore(5, 5);
      expect(score.summary.toLowerCase()).toContain('not measure');
      expect(score.avgCentsDeviation).toBe(0);
    });

    it('reflects partial completion', () => {
      const score = computeManualScore(2, 5);
      expect(score.score).toBe(20); // 2/5 * 50 = 20
    });
  });
});
