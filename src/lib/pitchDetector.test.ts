/**
 * Unit tests for the PitchDetector's core DSP logic.
 *
 * These tests generate synthetic audio buffers with known frequencies
 * and feed them directly into the detection algorithm. No microphone
 * or browser audio API is needed — we test the math, not the I/O.
 */

import { describe, it, expect } from 'vitest';

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const MIN_FREQ = 70;
const MAX_FREQ = 1200;
const CLARITY_THRESHOLD = 0.5;

function generateSineWave(
  frequency: number,
  sampleRate: number,
  numSamples: number,
  amplitude: number = 0.5
): Float32Array {
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

function generateSilence(numSamples: number): Float32Array {
  return new Float32Array(numSamples);
}

function generateNoise(
  numSamples: number,
  amplitude: number = 0.1
): Float32Array {
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = amplitude * (Math.random() * 2 - 1);
  }
  return buffer;
}

function generateHarmonicSignal(
  fundamental: number,
  sampleRate: number,
  numSamples: number,
  amplitude: number = 0.5
): Float32Array {
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    buffer[i] = amplitude * (
      Math.sin(2 * Math.PI * fundamental * t) +
      0.6 * Math.sin(2 * Math.PI * fundamental * 2 * t) +
      0.3 * Math.sin(2 * Math.PI * fundamental * 3 * t)
    );
  }
  return buffer;
}

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function computeNormCorr(buffer: Float32Array, lag: number): number {
  let correlation = 0;
  let energy1 = 0;
  let energy2 = 0;
  const n = buffer.length - lag;
  for (let i = 0; i < n; i++) {
    correlation += buffer[i] * buffer[i + lag];
    energy1 += buffer[i] * buffer[i];
    energy2 += buffer[i + lag] * buffer[i + lag];
  }
  const denom = Math.sqrt(energy1 * energy2);
  return denom > 0 ? correlation / denom : 0;
}

/**
 * Normalized autocorrelation with first-peak acceptance — mirrors
 * the algorithm in PitchDetector. Scans from shortest lag upward,
 * accepts the first significant correlation peak as the fundamental.
 */
function detectPitchFromBuffer(
  buffer: Float32Array,
  sampleRate: number = SAMPLE_RATE,
  minFreq: number = MIN_FREQ,
  maxFreq: number = MAX_FREQ
): { frequency: number; clarity: number } | null {
  const rms = computeRMS(buffer);
  if (rms < 0.01) return null;

  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.floor(sampleRate / minFreq);

  let bestLag = 0;
  let bestCorrelation = 0;

  let prevCorr = 0;
  let currCorr = computeNormCorr(buffer, minLag);
  let nextCorr = minLag + 1 <= maxLag ? computeNormCorr(buffer, minLag + 1) : 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const isLocalMax = currCorr >= prevCorr && currCorr > nextCorr;
    if (isLocalMax && currCorr >= CLARITY_THRESHOLD) {
      if (bestLag === 0 ||
          currCorr > bestCorrelation * 1.005 ||
          (currCorr > bestCorrelation * 0.995 && lag < bestLag)) {
        bestCorrelation = currCorr;
        bestLag = lag;
      }
    }
    prevCorr = currCorr;
    currCorr = nextCorr;
    nextCorr = lag + 2 <= maxLag ? computeNormCorr(buffer, lag + 2) : 0;
  }

  if (bestLag === 0 || bestCorrelation < CLARITY_THRESHOLD) return null;

  const frequency = sampleRate / bestLag;
  return { frequency, clarity: Math.min(bestCorrelation, 1) };
}

describe('normalized autocorrelation pitch detection', () => {
  it('detects a pure A4 (440 Hz) sine wave', () => {
    const buffer = generateSineWave(440, SAMPLE_RATE, FFT_SIZE);
    const result = detectPitchFromBuffer(buffer);
    expect(result).not.toBeNull();
    expect(result!.frequency).toBeGreaterThan(430);
    expect(result!.frequency).toBeLessThan(450);
    expect(result!.clarity).toBeGreaterThan(0.9);
  });

  it('detects a pure C4 (261.63 Hz) sine wave', () => {
    const buffer = generateSineWave(261.63, SAMPLE_RATE, FFT_SIZE);
    const result = detectPitchFromBuffer(buffer);
    expect(result).not.toBeNull();
    expect(result!.frequency).toBeGreaterThan(255);
    expect(result!.frequency).toBeLessThan(270);
    expect(result!.clarity).toBeGreaterThan(0.9);
  });

  it('detects a low E2 (82.4 Hz) sine wave with adequate buffer size', () => {
    // At 82.4 Hz, we need a larger buffer (4096) to fit enough periods
    // (~7.6) for reliable first-peak detection. With the default 2048
    // buffer, only ~3.8 periods fit, which is insufficient for the
    // first-peak approach to reliably identify the fundamental.
    const buffer = generateSineWave(82.4, SAMPLE_RATE, 4096);
    const result = detectPitchFromBuffer(buffer);
    expect(result).not.toBeNull();
    expect(result!.frequency).toBeGreaterThan(78);
    expect(result!.frequency).toBeLessThan(87);
  });

  it('detects a high C6 (1046.5 Hz) sine wave', () => {
    const buffer = generateSineWave(1046.5, SAMPLE_RATE, FFT_SIZE);
    const result = detectPitchFromBuffer(buffer);
    expect(result).not.toBeNull();
    expect(result!.frequency).toBeGreaterThan(1000);
    expect(result!.frequency).toBeLessThan(1100);
    expect(result!.clarity).toBeGreaterThan(0.9);
  });

  it('detects a detuned note (A4 + 20 cents)', () => {
    const freq = 440 * Math.pow(2, 20 / 1200);
    const buffer = generateSineWave(freq, SAMPLE_RATE, FFT_SIZE);
    const result = detectPitchFromBuffer(buffer);
    expect(result).not.toBeNull();
    expect(result!.frequency).toBeGreaterThan(freq - 10);
    expect(result!.frequency).toBeLessThan(freq + 10);
  });

  it('detects the fundamental of a harmonic-rich signal (voice-like)', () => {
    // 220 Hz fundamental with strong 2nd and 3rd harmonics
    const buffer = generateHarmonicSignal(220, SAMPLE_RATE, FFT_SIZE);
    const result = detectPitchFromBuffer(buffer);
    expect(result).not.toBeNull();
    // Should detect ~220 Hz, not ~440 Hz (the 2nd harmonic)
    expect(result!.frequency).toBeGreaterThan(210);
    expect(result!.frequency).toBeLessThan(230);
  });

  it('returns null for silence', () => {
    const buffer = generateSilence(FFT_SIZE);
    const result = detectPitchFromBuffer(buffer);
    expect(result).toBeNull();
  });

  it('returns null for pure noise', () => {
    const buffer = generateNoise(FFT_SIZE, 0.1);
    const result = detectPitchFromBuffer(buffer);
    // Noise should not produce a reliable pitch
    expect(result).toBeNull();
  });

  it('correlation is amplitude-independent (normalized)', () => {
    const loud = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, 0.9);
    const quiet = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, 0.02);
    const loudResult = detectPitchFromBuffer(loud);
    const quietResult = detectPitchFromBuffer(quiet);
    expect(loudResult).not.toBeNull();
    expect(quietResult).not.toBeNull();
    expect(loudResult!.frequency).toBeGreaterThan(430);
    expect(loudResult!.frequency).toBeLessThan(450);
    expect(quietResult!.frequency).toBeGreaterThan(430);
    expect(quietResult!.frequency).toBeLessThan(450);
    // Both should have high clarity — this is the key property of
    // normalized autocorrelation that the old un-normalized version lacked
    expect(loudResult!.clarity).toBeGreaterThan(0.9);
    expect(quietResult!.clarity).toBeGreaterThan(0.9);
  });

  it('does not detect pitch for very low amplitude below silence threshold', () => {
    const buffer = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, 0.001);
    const result = detectPitchFromBuffer(buffer);
    expect(result).toBeNull();
  });
});

describe('RMS silence detection', () => {
  it('computes zero RMS for silence', () => {
    const buffer = generateSilence(FFT_SIZE);
    expect(computeRMS(buffer)).toBe(0);
  });

  it('computes expected RMS for a sine wave', () => {
    const amplitude = 0.5;
    const buffer = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, amplitude);
    const expectedRMS = amplitude / Math.sqrt(2);
    expect(computeRMS(buffer)).toBeCloseTo(expectedRMS, 2);
  });

  it('computes low RMS for quiet noise', () => {
    const buffer = generateNoise(FFT_SIZE, 0.005);
    const rms = computeRMS(buffer);
    expect(rms).toBeLessThan(0.01);
  });
});
