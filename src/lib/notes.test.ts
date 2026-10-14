/**
 * Unit tests for note/frequency conversion utilities.
 *
 * These tests verify the equal-temperament math used throughout the
 * pitch detection pipeline. They are pure-function tests — no audio
 * hardware, no browser APIs, no mocking required.
 */

import { describe, it, expect } from 'vitest';
import { frequencyToNote, midiToFrequency, midiToNoteName, IN_TUNE_THRESHOLD_CENTS } from './notes';

describe('frequencyToNote', () => {
  it('correctly identifies A4 (440 Hz)', () => {
    const info = frequencyToNote(440);
    expect(info).not.toBeNull();
    expect(info!.noteName).toBe('A');
    expect(info!.octave).toBe(4);
    expect(info!.fullLabel).toBe('A4');
    expect(info!.cents).toBe(0);
    expect(info!.tuning).toBe('in-tune');
    expect(info!.referenceFrequency).toBeCloseTo(440, 1);
  });

  it('correctly identifies C4 (261.63 Hz)', () => {
    const info = frequencyToNote(261.63);
    expect(info).not.toBeNull();
    expect(info!.noteName).toBe('C');
    expect(info!.octave).toBe(4);
    expect(info!.fullLabel).toBe('C4');
    expect(info!.tuning).toBe('in-tune');
  });

  it('correctly identifies middle C as C4 not C5', () => {
    // MIDI 60 = C4, frequency = 261.6256
    const freq = midiToFrequency(60);
    const info = frequencyToNote(freq);
    expect(info!.fullLabel).toBe('C4');
  });

  it('detects sharp tuning (slightly above target)', () => {
    // A4 at 445 Hz → ~+20 cents sharp
    const info = frequencyToNote(445);
    expect(info!.noteName).toBe('A');
    expect(info!.cents).toBeGreaterThan(0);
    expect(info!.cents).toBeGreaterThan(IN_TUNE_THRESHOLD_CENTS);
    expect(info!.tuning).toBe('sharp');
  });

  it('detects flat tuning (slightly below target)', () => {
    // A4 at 435 Hz → ~-20 cents flat
    const info = frequencyToNote(435);
    expect(info!.noteName).toBe('A');
    expect(info!.cents).toBeLessThan(0);
    expect(info!.cents).toBeLessThan(-IN_TUNE_THRESHOLD_CENTS);
    expect(info!.tuning).toBe('flat');
  });

  it('reports in-tune within threshold', () => {
    // A4 at 440 + 3 cents ≈ 440.77 Hz — within ±5 cent threshold
    const freq = 440 * Math.pow(2, 3 / 1200);
    const info = frequencyToNote(freq);
    expect(info!.cents).toBe(3);
    expect(info!.tuning).toBe('in-tune');
  });

  it('handles low vocal frequencies (C2 ≈ 65.4 Hz)', () => {
    const freq = midiToFrequency(36); // C2
    const info = frequencyToNote(freq);
    expect(info!.noteName).toBe('C');
    expect(info!.octave).toBe(2);
    expect(info!.tuning).toBe('in-tune');
  });

  it('handles high vocal frequencies (C6 ≈ 1046.5 Hz)', () => {
    const freq = midiToFrequency(84); // C6
    const info = frequencyToNote(freq);
    expect(info!.noteName).toBe('C');
    expect(info!.octave).toBe(6);
    expect(info!.tuning).toBe('in-tune');
  });

  it('handles octave wrapping correctly at note boundaries', () => {
    // B3 = 246.94 Hz, just below C4
    const b3 = frequencyToNote(246.94);
    expect(b3!.noteName).toBe('B');
    expect(b3!.octave).toBe(3);

    // C4 = 261.63 Hz
    const c4 = frequencyToNote(261.63);
    expect(c4!.noteName).toBe('C');
    expect(c4!.octave).toBe(4);
  });

  it('returns null for invalid inputs', () => {
    expect(frequencyToNote(0)).toBeNull();
    expect(frequencyToNote(-1)).toBeNull();
    expect(frequencyToNote(NaN)).toBeNull();
    expect(frequencyToNote(Infinity)).toBeNull();
  });

  it('computes reference frequency as the exact ideal for the nearest note', () => {
    // A4 at 445 Hz: nearest note is A4, reference should be exactly 440
    const info = frequencyToNote(445);
    expect(info!.referenceFrequency).toBeCloseTo(440, 2);
  });
});

describe('midiToFrequency', () => {
  it('returns 440 for MIDI 69 (A4)', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 2);
  });

  it('returns 261.63 for MIDI 60 (C4)', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
  });

  it('doubles frequency per octave (+12 semitones)', () => {
    const base = midiToFrequency(60);
    const octave = midiToFrequency(72);
    expect(octave / base).toBeCloseTo(2, 5);
  });
});

describe('midiToNoteName', () => {
  it('returns C for MIDI 0', () => {
    expect(midiToNoteName(0)).toBe('C');
  });

  it('returns A for MIDI 69', () => {
    expect(midiToNoteName(69)).toBe('A');
  });

  it('returns B for MIDI 59 (negative wrap)', () => {
    // MIDI -1 should wrap to B
    expect(midiToNoteName(-1)).toBe('B');
  });

  it('returns G for MIDI 67', () => {
    expect(midiToNoteName(67)).toBe('G');
  });
});
