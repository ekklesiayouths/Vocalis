import type { ExerciseId } from '@/lib/warmupCatalog';

export type RoutineId = 'wake-up' | 'choir-ready' | 'pitch-agility' | 'gentle-reset';

export interface RoutineStep {
  exerciseId: ExerciseId;
  durationSec: number;
}

export interface RoutineDef {
  id: RoutineId;
  title: string;
  minutes: number;
  description: string;
  steps: RoutineStep[];
}

export const ROUTINES: RoutineDef[] = [
  {
    id: 'wake-up',
    title: 'Quick Vocal Wake-up',
    minutes: 5,
    description: 'Breath, a gentle hum, a lip trill, and a short scale to wake the voice.',
    steps: [
      { exerciseId: 'breath-pacer', durationSec: 60 },
      { exerciseId: 'humming-ladder', durationSec: 90 },
      { exerciseId: 'lip-trill', durationSec: 60 },
      { exerciseId: 'five-note-climb', durationSec: 90 },
    ],
  },
  {
    id: 'choir-ready',
    title: 'Choir Rehearsal Ready',
    minutes: 10,
    description: 'A full warm-up for rehearsal: breath, resonance, pitch, and diction.',
    steps: [
      { exerciseId: 'breath-pacer', durationSec: 90 },
      { exerciseId: 'humming-ladder', durationSec: 90 },
      { exerciseId: 'lip-trill', durationSec: 60 },
      { exerciseId: 'vowel-flow', durationSec: 90 },
      { exerciseId: 'five-note-climb', durationSec: 120 },
      { exerciseId: 'arpeggio', durationSec: 90 },
      { exerciseId: 'diction-dash', durationSec: 60 },
    ],
  },
  {
    id: 'pitch-agility',
    title: 'Pitch & Agility',
    minutes: 8,
    description: 'Focused work on pitch accuracy, register movement, and quick intervals.',
    steps: [
      { exerciseId: 'five-note-climb', durationSec: 120 },
      { exerciseId: 'arpeggio', durationSec: 120 },
      { exerciseId: 'register-glide', durationSec: 120 },
      { exerciseId: 'lip-trill', durationSec: 60 },
      { exerciseId: 'humming-ladder', durationSec: 60 },
    ],
  },
  {
    id: 'gentle-reset',
    title: 'Gentle Reset',
    minutes: 4,
    description: 'A calm finish to release tension after singing or speaking.',
    steps: [
      { exerciseId: 'breath-pacer', durationSec: 120 },
      { exerciseId: 'vowel-flow', durationSec: 60 },
      { exerciseId: 'humming-ladder', durationSec: 60 },
    ],
  },
];

export function getRoutine(id: RoutineId): RoutineDef {
  const routine = ROUTINES.find((entry) => entry.id === id);
  if (!routine) throw new Error(`Unknown routine: ${id}`);
  return routine;
}

export function routineTotalSec(routine: RoutineDef): number {
  return routine.steps.reduce((sum, step) => sum + step.durationSec, 0);
}
