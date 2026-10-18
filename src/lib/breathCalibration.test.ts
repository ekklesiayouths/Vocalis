import { describe, it, expect } from 'vitest';
import {
  average,
  isSignalSample,
  calibrationSucceeded,
  computeCalibration,
  isInZone,
  zonePercent,
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
      // Quiet mic: floor 0.005, signal 0.03 → range 0.025
      const quiet = computeCalibration(new Array(20).fill(0.03), 0.005);
      // Loud mic: floor 0.05, signal 0.30 → range 0.25
      const loud = computeCalibration(new Array(20).fill(0.30), 0.05);

      // The zone is 25%–85% of the range in both cases
      expect(quiet.zoneMin).toBeCloseTo(0.005 + 0.025 * 0.25, 10);
      expect(quiet.zoneMax).toBeCloseTo(0.005 + 0.025 * 0.85, 10);
      expect(loud.zoneMin).toBeCloseTo(0.05 + 0.25 * 0.25, 10);
      expect(loud.zoneMax).toBeCloseTo(0.05 + 0.25 * 0.85, 10);

      // A user hissing at their own calibrated level lands in-zone on both setups
      expect(isInZone(0.005 + 0.025 * 0.5, quiet)).toBe(true);
      expect(isInZone(0.05 + 0.25 * 0.5, loud)).toBe(true);
    });

    it('never produces a negative zone on degenerate input', () => {
      const cal = computeCalibration([0.0], 0.01);
      expect(cal.zoneMin).toBeGreaterThanOrEqual(0.01);
      expect(cal.zoneMax).toBeGreaterThanOrEqual(cal.zoneMin);
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
});
