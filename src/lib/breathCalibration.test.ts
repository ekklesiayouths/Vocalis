import { describe, it, expect } from 'vitest';
import {
  average,
  isSignalSample,
  calibrationSucceeded,
  computeCalibration,
  isInZone,
  zonePercent,
  standardDeviation,
  stabilityScore,
  classifySignal,
  targetForLevel,
  DURATION_TARGETS,
  CLIPPING_THRESHOLD,
  EXCESSIVE_SIGNAL_FRACTION,
  MIN_SIGNAL_SAMPLES,
  HYSTERESIS_MS,
} from './breathCalibration';

describe('breathCalibration', () => {
  describe('average', () => {
    it('returns 0 for an empty list', () => {
      expect(average([])).toBe(0);
    });

    it('computes the mean', () => {
      expect(average([0.01, 0.02, 0.03])).toBeCloseTo(0.02, 10);
    });
  });

  describe('isSignalSample', () => {
    it('rejects samples at the noise floor', () => {
      expect(isSignalSample(0.01, 0.01)).toBe(false);
    });

    it('accepts samples well above the noise floor', () => {
      expect(isSignalSample(0.05, 0.01)).toBe(true);
    });

    it('rejects samples between 1x and 2x the noise floor', () => {
      expect(isSignalSample(0.015, 0.01)).toBe(false);
    });
  });

  describe('calibrationSucceeded', () => {
    it('fails when too few signal samples were captured', () => {
      expect(calibrationSucceeded(new Array(MIN_SIGNAL_SAMPLES - 1).fill(0.05))).toBe(false);
    });

    it('passes when enough signal samples were captured', () => {
      expect(calibrationSucceeded(new Array(MIN_SIGNAL_SAMPLES).fill(0.05))).toBe(true);
    });
  });

  describe('computeCalibration', () => {
    it('zones the relative range between noise floor and signal, not absolute levels', () => {
      const quiet = computeCalibration(new Array(20).fill(0.03), 0.005);
      const loud = computeCalibration(new Array(20).fill(0.30), 0.05);

      expect(quiet.zoneMin).toBeCloseTo(0.005 + 0.025 * 0.25, 10);
      expect(quiet.zoneMax).toBeCloseTo(0.005 + 0.025 * 0.85, 10);
      expect(loud.zoneMin).toBeCloseTo(0.05 + 0.25 * 0.25, 10);
      expect(loud.zoneMax).toBeCloseTo(0.05 + 0.25 * 0.85, 10);

      expect(isInZone(0.005 + 0.025 * 0.5, quiet)).toBe(true);
      expect(isInZone(0.05 + 0.25 * 0.5, loud)).toBe(true);
    });

    it('never produces a negative zone on degenerate input', () => {
      const cal = computeCalibration([0.0], 0.01);
      expect(cal.zoneMin).toBeGreaterThanOrEqual(0.01);
      expect(cal.zoneMax).toBeGreaterThanOrEqual(cal.zoneMin);
    });

    it('includes avgSignal in the result', () => {
      const cal = computeCalibration(new Array(20).fill(0.08), 0.02);
      expect(cal.avgSignal).toBeCloseTo(0.08, 10);
    });
  });

  describe('isInZone', () => {
    const zone = computeCalibration(new Array(20).fill(0.1), 0.0);

    it('accepts the bounds inclusively', () => {
      expect(isInZone(zone.zoneMin, zone)).toBe(true);
      expect(isInZone(zone.zoneMax, zone)).toBe(true);
    });

    it('rejects values outside the zone', () => {
      expect(isInZone(zone.zoneMin - 0.001, zone)).toBe(false);
      expect(isInZone(zone.zoneMax + 0.001, zone)).toBe(false);
    });
  });

  describe('zonePercent', () => {
    const zone = computeCalibration(new Array(20).fill(0.08), 0.0);

    it('maps the noise floor to 0%', () => {
      expect(zonePercent(zone.noiseFloor, zone)).toBe(0);
    });

    it('maps the zone ceiling to 100%', () => {
      expect(zonePercent(zone.zoneMax, zone)).toBe(100);
    });

    it('clamps values below the floor and above the ceiling', () => {
      expect(zonePercent(-1, zone)).toBe(0);
      expect(zonePercent(100, zone)).toBe(100);
    });
  });

  describe('hysteresis constant', () => {
    it('gives singers a 500ms grace period before resetting', () => {
      expect(HYSTERESIS_MS).toBe(500);
    });
  });

  // ─── New: standard deviation ──────────────────────────────────────
  describe('standardDeviation', () => {
    it('returns 0 for fewer than 2 values', () => {
      expect(standardDeviation([])).toBe(0);
      expect(standardDeviation([0.5])).toBe(0);
    });

    it('returns 0 for identical values', () => {
      expect(standardDeviation([0.1, 0.1, 0.1])).toBeCloseTo(0, 10);
    });

    it('computes population standard deviation', () => {
      const std = standardDeviation([0.0, 0.1, 0.2, 0.3]);
      expect(std).toBeCloseTo(0.1118, 3);
    });
  });

  // ─── New: stability score ─────────────────────────────────────────
  describe('stabilityScore', () => {
    it('returns 0 for a silent signal', () => {
      expect(stabilityScore([0, 0, 0])).toBe(0);
    });

    it('returns 100 for a perfectly consistent signal', () => {
      expect(stabilityScore([0.1, 0.1, 0.1, 0.1])).toBe(100);
    });

    it('gives a lower score for a fluctuating signal', () => {
      const consistent = stabilityScore([0.1, 0.1, 0.1, 0.1]);
      const fluctuating = stabilityScore([0.05, 0.1, 0.15, 0.1]);
      expect(consistent).toBeGreaterThan(fluctuating);
    });

    it('clamps to 0–100', () => {
      const wildScore = stabilityScore([0.001, 0.5, 0.001, 0.5]);
      expect(wildScore).toBeGreaterThanOrEqual(0);
      expect(wildScore).toBeLessThanOrEqual(100);
    });
  });

  // ─── New: classifySignal ──────────────────────────────────────────
  describe('classifySignal', () => {
    const zone = computeCalibration(new Array(20).fill(0.10), 0.01);
    // avgSignal = 0.10, noiseFloor = 0.01
    // zoneMin = 0.01 + 0.09 * 0.25 = 0.0325
    // zoneMax = 0.01 + 0.09 * 0.85 = 0.0865

    it('classifies clipping when RMS is at or above the clipping threshold', () => {
      const result = classifySignal(CLIPPING_THRESHOLD, zone, 0.10);
      expect(result.quality).toBe('clipping');
    });

    it('classifies silence when RMS is near the noise floor', () => {
      const result = classifySignal(0.005, zone, 0.10);
      expect(result.quality).toBe('silence');
    });

    it('classifies excessive when RMS is well above the calibrated signal', () => {
      const result = classifySignal(0.10 * EXCESSIVE_SIGNAL_FRACTION + 0.001, zone, 0.10);
      expect(result.quality).toBe('excessive');
    });

    it('classifies in-zone when RMS is within the target zone', () => {
      const midZone = (zone.zoneMin + zone.zoneMax) / 2;
      const result = classifySignal(midZone, zone, 0.10);
      expect(result.quality).toBe('in-zone');
      expect(result.message).toBe('');
    });

    it('classifies inadequate when RMS is audible but below the zone', () => {
      const result = classifySignal(0.02, zone, 0.10);
      expect(result.quality).toBe('inadequate');
    });

    it('never mentions diaphragm, lungs, or airflow in any message', () => {
      const allMessages = [
        classifySignal(CLIPPING_THRESHOLD, zone, 0.10).message,
        classifySignal(0.005, zone, 0.10).message,
        classifySignal(0.10 * EXCESSIVE_SIGNAL_FRACTION + 0.01, zone, 0.10).message,
        classifySignal(0.02, zone, 0.10).message,
      ];
      for (const msg of allMessages) {
        expect(msg.toLowerCase()).not.toContain('diaphragm');
        expect(msg.toLowerCase()).not.toContain('lung');
        expect(msg.toLowerCase()).not.toContain('airflow');
        expect(msg.toLowerCase()).not.toContain('breath health');
      }
    });
  });

  // ─── New: duration targets ────────────────────────────────────────
  describe('DURATION_TARGETS', () => {
    it('has three levels: Beginner, Intermediate, Advanced', () => {
      const labels = DURATION_TARGETS.map((t) => t.label);
      expect(labels).toEqual(['Beginner', 'Intermediate', 'Advanced']);
    });

    it('starts with an achievable beginner target (not 15s)', () => {
      expect(DURATION_TARGETS[0].seconds).toBeLessThan(15);
    });

    it('has progressive targets', () => {
      expect(DURATION_TARGETS[0].seconds).toBeLessThan(DURATION_TARGETS[1].seconds);
      expect(DURATION_TARGETS[1].seconds).toBeLessThan(DURATION_TARGETS[2].seconds);
    });
  });

  describe('targetForLevel', () => {
    it('returns the matching target', () => {
      expect(targetForLevel('Beginner').label).toBe('Beginner');
      expect(targetForLevel('Intermediate').label).toBe('Intermediate');
      expect(targetForLevel('Advanced').label).toBe('Advanced');
    });

    it('falls back to Beginner for unknown levels', () => {
      expect(targetForLevel('Unknown' as any).label).toBe('Beginner');
    });
  });
});
