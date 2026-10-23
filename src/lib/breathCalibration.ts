/**
 * Shared calibration, signal classification, and hysteresis math for
 * breath-control drills.
 *
 * The target zone is derived from the user's own measured signal, not an
 * absolute threshold, so the drill works at any microphone gain.
 *
 * The microphone detects AUDIBLE SOUND CONSISTENCY — not airflow, lung
 * capacity, diaphragm engagement, or respiratory health. All feedback and
 * terminology reflects that limitation.
 */

// ─── Calibration timing ────────────────────────────────────────────────
export const NOISE_FLOOR_DURATION_MS = 3000;
export const SIGNAL_DURATION_MS = 3000;
/** Samples above this multiple of the noise floor count as signal. */
export const SIGNAL_FLOOR_MULTIPLE = 2;
/** Minimum above-noise samples required for calibration to succeed. */
export const MIN_SIGNAL_SAMPLES = 10;

// ─── Target zone bounds ────────────────────────────────────────────────
/** Target zone bounds as a fraction of the (signal − noise floor) range. */
export const ZONE_LOW_FRACTION = 0.25;
export const ZONE_HIGH_FRACTION = 0.85;
/** Dips shorter than this outside the zone do not reset the sustain timer. */
export const HYSTERESIS_MS = 500;

// ─── Clipping detection ────────────────────────────────────────────────
/** RMS at or above which the mic input is likely clipping (0–1 scale). */
export const CLIPPING_THRESHOLD = 0.98;
/** Fraction of the calibrated signal average above which we warn about pushing too hard. */
export const EXCESSIVE_SIGNAL_FRACTION = 1.6;

// ─── Duration targets by difficulty (seconds of sustained audible sound) ──
export interface DurationTarget {
  label: string;
  seconds: number;
  description: string;
}

export const DURATION_TARGETS: DurationTarget[] = [
  { label: 'Beginner', seconds: 8, description: 'Steady sound for 8 seconds — a great starting goal.' },
  { label: 'Intermediate', seconds: 15, description: 'Steady sound for 15 seconds — solid breath control.' },
  { label: 'Advanced', seconds: 25, description: 'Steady sound for 25 seconds — excellent consistency.' },
];

export function targetForLevel(level: 'Beginner' | 'Intermediate' | 'Advanced'): DurationTarget {
  return DURATION_TARGETS.find((t) => t.label === level) ?? DURATION_TARGETS[0];
}

// ─── Signal quality classification ─────────────────────────────────────
export type SignalQuality =
  | 'silence'        // below noise floor — no audible sound
  | 'inadequate'     // audible but below the calibrated zone
  | 'in-zone'        // within the target zone
  | 'excessive'      // much louder than calibrated — may be forcing
  | 'clipping';      // at or near maximum — mic is overloaded

export interface SignalClassification {
  quality: SignalQuality;
  /** Human-readable explanation of what the mic detected, without anatomical claims. */
  message: string;
}

export function classifySignal(
  rawRms: number,
  zone: CalibrationResult,
  avgSignal: number
): SignalClassification {
  if (rawRms >= CLIPPING_THRESHOLD) {
    return {
      quality: 'clipping',
      message: 'The microphone is overloaded. Move slightly back or soften your hiss — the sound is too loud for the mic to read cleanly.',
    };
  }
  if (rawRms < zone.noiseFloor * 1.2) {
    return {
      quality: 'silence',
      message: 'No audible sound detected. Start a gentle "sss" hiss and the tracker will pick it up.',
    };
  }
  if (rawRms > avgSignal * EXCESSIVE_SIGNAL_FRACTION) {
    return {
      quality: 'excessive',
      message: 'That is much louder than your calibrated level. Try a gentler, more even hiss — the goal is consistency, not maximum effort.',
    };
  }
  if (rawRms >= zone.zoneMin && rawRms <= zone.zoneMax) {
    return {
      quality: 'in-zone',
      message: '',
    };
  }
  return {
    quality: 'inadequate',
    message: 'The sound is quieter than your calibrated level. Aim for the same comfortable hiss you used during calibration.',
  };
}

// ─── Calibration result ────────────────────────────────────────────────
export interface CalibrationResult {
  noiseFloor: number;
  zoneMin: number;
  zoneMax: number;
  /** The average signal level measured during calibration. */
  avgSignal: number;
}

// ─── Pure math functions ───────────────────────────────────────────────
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Standard deviation — used as a simple stability indicator. */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Coefficient of variation (stddev / mean). A lower number means a more
 * consistent signal — the hiss volume stayed closer to a steady level.
 * Returns 0 for a degenerate (near-silent) signal.
 */
export function stabilityScore(values: number[]): number {
  const mean = average(values);
  if (mean <= 0.0001) return 0;
  const cv = standardDeviation(values) / mean;
  // Convert CV to a 0–100 score: CV of 0 → 100, CV of 0.5+ → near 0.
  return Math.max(0, Math.min(100, (1 - cv / 0.5) * 100));
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
    avgSignal,
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
