/**
 * Shared calibration + hysteresis math for breath-control drills.
 *
 * The target zone is derived from the user's own measured signal, not an
 * absolute threshold, so the drill passes at any microphone gain.
 */

export const NOISE_FLOOR_DURATION_MS = 3000;
export const SIGNAL_DURATION_MS = 3000;
/** Samples above this multiple of the noise floor count as signal. */
export const SIGNAL_FLOOR_MULTIPLE = 2;
/** Minimum above-noise samples required for calibration to succeed. */
export const MIN_SIGNAL_SAMPLES = 10;
/** Target zone bounds as a fraction of the (signal − noise floor) range. */
export const ZONE_LOW_FRACTION = 0.25;
export const ZONE_HIGH_FRACTION = 0.85;
/** Dips shorter than this outside the zone do not reset the sustain timer. */
export const HYSTERESIS_MS = 500;

export interface CalibrationResult {
  noiseFloor: number;
  zoneMin: number;
  zoneMax: number;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function isSignalSample(rawRms: number, noiseFloor: number): boolean {
  return rawRms > noiseFloor * SIGNAL_FLOOR_MULTIPLE;
}

export function calibrationSucceeded(signalSamples: number[]): boolean {
  return signalSamples.length >= MIN_SIGNAL_SAMPLES;
}

export function computeCalibration(signalSamples: number[], noiseFloor: number): CalibrationResult {
  const avgSignal = average(signalSamples);
  const range = Math.max(0, avgSignal - noiseFloor);
  return {
    noiseFloor,
    zoneMin: noiseFloor + range * ZONE_LOW_FRACTION,
    zoneMax: noiseFloor + range * ZONE_HIGH_FRACTION,
  };
}

export function isInZone(smoothed: number, zone: CalibrationResult): boolean {
  return smoothed >= zone.zoneMin && smoothed <= zone.zoneMax;
}

export function zonePercent(value: number, zone: CalibrationResult): number {
  const span = zone.zoneMax - zone.noiseFloor;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((value - zone.noiseFloor) / span) * 100));
}
