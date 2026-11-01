import { describe, expect, it } from 'vitest';
import { EXERCISES, TEMPO_LEVELS, getExercise, type ExerciseId } from '@/lib/warmupCatalog';
import { ROUTINES, getRoutine, routineTotalSec } from '@/lib/warmupRoutines';

const TARGET_MS = 60000;

describe('exercise catalog', () => {
  it('defines the eight new exercises with unique ids', () => {
    const ids = EXERCISES.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(8);
    expect(ids.sort()).toEqual(
      [
        'arpeggio',
        'breath-pacer',
        'diction-dash',
        'five-note-climb',
        'humming-ladder',
        'lip-trill',
        'register-glide',
        'vowel-flow',
      ].sort()
    );
  });

  it('covers each of the four warm-up categories', () => {
    for (const category of ['breath', 'resonance', 'agility', 'pitch'] as const) {
      expect(EXERCISES.some((exercise) => exercise.category === category)).toBe(true);
    }
  });

  it('only scores pitch for exercises that listen to the microphone', () => {
    for (const exercise of EXERCISES) {
      if (exercise.usesPitch) expect(exercise.usesMic).toBe(true);
    }
    expect(getExercise('breath-pacer').usesPitch).toBe(false);
    expect(getExercise('diction-dash').usesPitch).toBe(false);
    expect(getExercise('diction-dash').usesMic).toBe(false);
  });

  it.each(EXERCISES.map((exercise) => [exercise.id]))('builds a plan for %s at every tempo', (id) => {
    for (const tempo of TEMPO_LEVELS) {
      const plan = getExercise(id as ExerciseId).build(tempo.factor, TARGET_MS);
      expect(plan.segments.length).toBeGreaterThan(0);
      expect(plan.totalMs).toBeLessThanOrEqual(TARGET_MS);
      expect(plan.totalMs).toBeGreaterThan(TARGET_MS - 6000);
    }
  });

  it('keeps pitched targets in a comfortable singing range for beginners', () => {
    for (const exercise of EXERCISES.filter((entry) => entry.usesPitch)) {
      const plan = exercise.build(1, TARGET_MS);
      for (const segment of plan.segments) {
        if (segment.midi === null) continue;
        expect(segment.midi).toBeGreaterThanOrEqual(55);
        expect(segment.midi).toBeLessThanOrEqual(72);
      }
    }
  });

  it('gives unpitched exercises no pitch targets', () => {
    for (const exercise of EXERCISES.filter((entry) => !entry.usesPitch)) {
      const plan = exercise.build(1, TARGET_MS);
      expect(plan.segments.every((segment) => segment.midi === null)).toBe(true);
    }
  });

  it('makes slower tempos produce longer segments', () => {
    const exercise = getExercise('five-note-climb');
    const slow = exercise.build(TEMPO_LEVELS[0].factor, TARGET_MS).segments[0];
    const quick = exercise.build(TEMPO_LEVELS[2].factor, TARGET_MS).segments[0];
    expect(slow.endMs - slow.startMs).toBeGreaterThan(quick.endMs - quick.startMs);
  });
});

describe('guided routines', () => {
  it('uses unique ids that map to real exercises', () => {
    expect(new Set(ROUTINES.map((routine) => routine.id)).size).toBe(4);
    for (const routine of ROUTINES) {
      for (const step of routine.steps) {
        expect(() => getExercise(step.exerciseId)).not.toThrow();
        expect(step.durationSec).toBeGreaterThan(0);
      }
    }
  });

  it.each([
    ['wake-up', 5],
    ['choir-ready', 10],
    ['pitch-agility', 8],
    ['gentle-reset', 4],
  ] as const)('%s adds up to about %i minutes', (id, minutes) => {
    const routine = getRoutine(id);
    expect(routine.minutes).toBe(minutes);
    expect(routineTotalSec(routine)).toBe(minutes * 60);
  });
});
