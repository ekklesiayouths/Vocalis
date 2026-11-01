import { describe, expect, it } from 'vitest';
import {
  GATE_PASS_POINTS,
  INITIAL_TRACK,
  JUMP_CONFIRM_FRAMES,
  LIVES_START,
  OCTAVE_JUMP_SEMITONES,
  SILENCE_RESET_FRAMES,
  clamp01,
  clampGapY,
  createVoiceRange,
  freqToMidi,
  gateHeightFor,
  isNoteOnTarget,
  isReliableReading,
  isSteadySample,
  judgeGate,
  levelFor,
  midiToY,
  smoothY,
  speedFor,
  trackPitch,
  yToMidi,
  type TrackState,
  type VoiceRange,
} from '@/lib/pitchBall';
import { midiToFrequency } from '@/lib/notes';

const RANGE: VoiceRange = { lowMidi: 48, highMidi: 72 };

function feed(state: TrackState, midis: (number | null)[]): TrackState {
  return midis.reduce<TrackState>((s, m) => trackPitch(s, m), state);
}

describe('pitch to height mapping', () => {
  it('maps the low note to the bottom and the high note to the top', () => {
    expect(midiToY(RANGE.lowMidi, RANGE)).toBe(1);
    expect(midiToY(RANGE.highMidi, RANGE)).toBe(0);
    expect(midiToY(60, RANGE)).toBeCloseTo(0.5, 5);
  });

  it('clamps notes outside the calibrated range inside the playable area', () => {
    expect(midiToY(20, RANGE)).toBe(1);
    expect(midiToY(100, RANGE)).toBe(0);
  });

  it('round-trips through yToMidi', () => {
    for (const midi of [48, 55.5, 60, 66.25, 72]) {
      expect(yToMidi(midiToY(midi, RANGE), RANGE)).toBeCloseTo(midi, 5);
    }
  });

  it('clamps out-of-bounds y values before converting', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(yToMidi(-1, RANGE)).toBe(RANGE.highMidi);
    expect(yToMidi(2, RANGE)).toBe(RANGE.lowMidi);
  });

  it('eases toward the target without overshooting', () => {
    const once = smoothY(0, 1, 16);
    expect(once).toBeGreaterThan(0);
    expect(once).toBeLessThan(1);
    expect(smoothY(0.4, 0.9, 0)).toBe(0.4);
    let y = 0;
    for (let i = 0; i < 500; i++) y = smoothY(y, 1, 16);
    expect(y).toBeCloseTo(1, 3);
    expect(y).toBeLessThanOrEqual(1);
  });
});

describe('voice range', () => {
  it('rejects a range narrower than a fifth', () => {
    expect(createVoiceRange(60, 64)).toBeNull();
    expect(createVoiceRange(60, 66)).toBeNull();
  });

  it('accepts a range of at least seven semitones', () => {
    expect(createVoiceRange(60, 67)).toEqual({ lowMidi: 60, highMidi: 67 });
  });

  it('rejects non-finite input', () => {
    expect(createVoiceRange(Number.NaN, 72)).toBeNull();
    expect(createVoiceRange(48, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('reading validity', () => {
  it('rejects silence, noise, and unclear pitches', () => {
    expect(isReliableReading(null, 0.9, 0.2)).toBe(false);
    expect(isReliableReading(220, 0.2, 0.2)).toBe(false);
    expect(isReliableReading(220, 0.9, 0.001)).toBe(false);
    expect(isReliableReading(0, 0.9, 0.2)).toBe(false);
  });

  it('accepts a clear, loud reading', () => {
    expect(isReliableReading(220, 0.9, 0.2)).toBe(true);
  });
});

describe('trackPitch', () => {
  it('follows steady pitch changes', () => {
    const state = feed(INITIAL_TRACK, [60, 61, 62]);
    expect(state.acceptedMidi).toBe(62);
  });

  it('keeps the last pitch through brief silence', () => {
    const state = feed(INITIAL_TRACK, [60, null, null, null]);
    expect(state.acceptedMidi).toBe(60);
    expect(state.silentFrames).toBe(3);
  });

  it('releases the pitch after sustained silence', () => {
    const silent = Array<null>(SILENCE_RESET_FRAMES).fill(null);
    const state = feed(INITIAL_TRACK, [60, ...silent]);
    expect(state.acceptedMidi).toBeNull();
  });

  it('ignores a brief octave jump', () => {
    const state = feed(INITIAL_TRACK, [60, 72, 72, 72]);
    expect(state.acceptedMidi).toBe(60);
  });

  it('accepts an octave jump only after it persists', () => {
    const jumps = Array<number>(JUMP_CONFIRM_FRAMES).fill(72);
    const almost = feed(INITIAL_TRACK, [60, ...jumps.slice(0, -1)]);
    expect(almost.acceptedMidi).toBe(60);
    const confirmed = feed(INITIAL_TRACK, [60, ...jumps]);
    expect(confirmed.acceptedMidi).toBe(72);
  });

  it('treats a jump under the threshold as normal movement', () => {
    const state = feed(INITIAL_TRACK, [60, 60 + OCTAVE_JUMP_SEMITONES]);
    expect(state.acceptedMidi).toBe(60 + OCTAVE_JUMP_SEMITONES);
  });

  it('resets the candidate when a reliable reading returns to the accepted pitch', () => {
    const state = feed(INITIAL_TRACK, [60, 72, 72, 60]);
    expect(state.acceptedMidi).toBe(60);
    expect(state.candidateMidi).toBeNull();
  });
});

describe('isNoteOnTarget', () => {
  const target = 69;
  const freqAt = (cents: number) => midiToFrequency(target) * Math.pow(2, cents / 1200);

  it('accepts the exact note', () => {
    expect(isNoteOnTarget(midiToFrequency(target), 0.9, 0.2, target)).toBe(true);
  });

  it('accepts a note within 50 cents', () => {
    expect(isNoteOnTarget(freqAt(45), 0.9, 0.2, target)).toBe(true);
    expect(isNoteOnTarget(freqAt(-45), 0.9, 0.2, target)).toBe(true);
  });

  it('rejects a note more than 50 cents away', () => {
    expect(isNoteOnTarget(freqAt(70), 0.9, 0.2, target)).toBe(false);
    expect(isNoteOnTarget(freqAt(-70), 0.9, 0.2, target)).toBe(false);
  });

  it('rejects the right note sung an octave too high or low', () => {
    expect(isNoteOnTarget(midiToFrequency(target + 12), 0.9, 0.2, target)).toBe(false);
    expect(isNoteOnTarget(midiToFrequency(target - 12), 0.9, 0.2, target)).toBe(false);
  });

  it('rejects unreliable readings even at the right pitch', () => {
    expect(isNoteOnTarget(midiToFrequency(target), 0.1, 0.2, target)).toBe(false);
    expect(isNoteOnTarget(midiToFrequency(target), 0.9, 0, target)).toBe(false);
    expect(isNoteOnTarget(null, 0.9, 0.2, target)).toBe(false);
  });

  it('maps frequency to the nearest MIDI note', () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 6);
  });
});

describe('gate judgement and progression', () => {
  const gate = { gapY: 0.5, gapH: 0.3 };

  it('passes when the ball fits inside the opening', () => {
    expect(judgeGate(0.5, gate)).toBe(true);
    expect(judgeGate(0.5 + 0.1, gate)).toBe(true);
  });

  it('fails when the ball touches the wooden frame', () => {
    expect(judgeGate(0.5 + 0.15, gate)).toBe(false);
    expect(judgeGate(0.05, gate)).toBe(false);
  });

  it('keeps gates on screen by clamping the opening', () => {
    const h = gateHeightFor(1);
    const top = clampGapY(-1, h);
    const bottom = clampGapY(2, h);
    expect(top).toBeGreaterThan(0);
    expect(bottom).toBeLessThan(1);
  });

  it('shrinks openings and speeds the road up as levels rise', () => {
    expect(gateHeightFor(10)).toBeLessThan(gateHeightFor(1));
    expect(gateHeightFor(100)).toBeGreaterThanOrEqual(0.2);
    expect(speedFor(5)).toBeGreaterThan(speedFor(1));
    expect(speedFor(50)).toBe(speedFor(10));
  });

  it('raises the level every five gates', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(4)).toBe(1);
    expect(levelFor(5)).toBe(2);
    expect(levelFor(10)).toBe(3);
  });

  it('keeps the scoring and lives constants consistent', () => {
    expect(GATE_PASS_POINTS).toBeGreaterThan(0);
    expect(LIVES_START).toBe(3);
  });
});

describe('calibration sample checks', () => {
  it('accepts a steady note', () => {
    const steady = Array<number>(30).fill(60).map((m, i) => m + (i % 2) * 0.1);
    expect(isSteadySample(steady)).toBe(true);
  });

  it('rejects a wavering or too-short sample', () => {
    expect(isSteadySample([60, 61, 62, 60, 61, 62, 60, 61, 62, 60])).toBe(false);
    expect(isSteadySample([60, 60, 60])).toBe(false);
    expect(isSteadySample([])).toBe(false);
  });
});
