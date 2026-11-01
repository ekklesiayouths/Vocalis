import { describe, it, expect } from 'vitest';
import {
  phraseRanges,
  rangeDurationMs,
  scheduleNotes,
  solfaForMelody,
  type SongMelody,
} from '@/lib/songMelody';
import { midiToFrequency } from '@/lib/notes';

// Synthetic fixture for exercising timing and sol-fa logic only. Not song data.
const FIXTURE: SongMelody = {
  key: 'C Major',
  tempoBpm: 60,
  oscillatorType: 'triangle',
  phraseStarts: [0, 2],
  events: [
    { kind: 'note', midi: 60, beats: 1 },
    { kind: 'note', midi: 64, beats: 1 },
    { kind: 'rest', beats: 1 },
    { kind: 'note', midi: 67, beats: 2 },
  ],
};

describe('solfaForMelody', () => {
  it('derives syllables and octave labels from pitch and key', () => {
    const solfa = solfaForMelody(FIXTURE);
    expect(solfa.map((n) => n.syllable)).toEqual(['Doh', 'Mi', 'Soh']);
    expect(solfa.map((n) => n.noteLabel)).toEqual(['C4', 'E4', 'G4']);
    expect(solfa.map((n) => n.eventIndex)).toEqual([0, 1, 3]);
  });

  it('is relative to the key, not to fixed syllables', () => {
    const inG: SongMelody = {
      ...FIXTURE,
      key: 'G Major',
      events: [{ kind: 'note', midi: 62, beats: 1 }],
      phraseStarts: [0],
    };
    expect(solfaForMelody(inG)[0].syllable).toBe('Soh');
  });
});

describe('scheduleNotes', () => {
  it('places notes by their beat positions, including rests', () => {
    const notes = scheduleNotes(FIXTURE, 1);
    expect(notes.map((n) => n.startMs)).toEqual([0, 1000, 3000]);
    expect(notes.map((n) => n.durationMs)).toEqual([1000, 1000, 2000]);
  });

  it('changes durations with speed but never pitch', () => {
    const normal = scheduleNotes(FIXTURE, 1);
    const slow = scheduleNotes(FIXTURE, 0.5);
    expect(slow.map((n) => n.frequency)).toEqual(normal.map((n) => n.frequency));
    expect(slow[1].startMs).toBe(normal[1].startMs * 2);
    expect(slow[0].durationMs).toBe(normal[0].durationMs * 2);
  });

  it('plays a tapped note and a full melody from identical pitch data', () => {
    const full = scheduleNotes(FIXTURE, 1);
    for (const note of full) {
      const [tapped] = scheduleNotes(FIXTURE, 1, { start: note.eventIndex, end: note.eventIndex + 1 });
      expect(tapped.frequency).toBe(note.frequency);
      expect(tapped.midi).toBe(note.midi);
      expect(tapped.startMs).toBe(0);
    }
  });

  it('times a phrase from its own start, keeping its leading rest', () => {
    const [phrase] = phraseRanges(FIXTURE).slice(1);
    const notes = scheduleNotes(FIXTURE, 1, phrase);
    expect(notes.map((n) => n.midi)).toEqual([67]);
    expect(notes[0].startMs).toBe(1000);
    expect(notes[0].frequency).toBe(midiToFrequency(67));
  });
});

describe('phraseRanges and rangeDurationMs', () => {
  it('splits the melody at phrase starts', () => {
    expect(phraseRanges(FIXTURE)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  it('respects note and rest durations for the full melody and each phrase', () => {
    expect(rangeDurationMs(FIXTURE, 1)).toBe(5000);
    expect(rangeDurationMs(FIXTURE, 1, { start: 0, end: 2 })).toBe(2000);
    expect(rangeDurationMs(FIXTURE, 1, { start: 2, end: 4 })).toBe(3000);
  });
});
