import { buildPlan, type ExercisePlan, type SegmentSpec } from '@/lib/warmupTiming';

export type ExerciseId =
  | 'breath-pacer'
  | 'humming-ladder'
  | 'lip-trill'
  | 'vowel-flow'
  | 'five-note-climb'
  | 'arpeggio'
  | 'register-glide'
  | 'diction-dash';

export type ExerciseCategory = 'breath' | 'resonance' | 'agility' | 'pitch';

export type ExerciseVisual = 'ribbon' | 'pacer' | 'words';

export type TempoId = 'slow' | 'medium' | 'quick';

export interface TempoLevel {
  id: TempoId;
  label: string;
  factor: number;
}

export const TEMPO_LEVELS: TempoLevel[] = [
  { id: 'slow', label: 'Slow', factor: 1.25 },
  { id: 'medium', label: 'Medium', factor: 1 },
  { id: 'quick', label: 'Quick', factor: 0.8 },
];

export const DEFAULT_TEMPO: TempoId = 'slow';

export interface ExerciseMeta {
  id: ExerciseId;
  title: string;
  category: ExerciseCategory;
  summary: string;
  instructions: string[];
  usesMic: boolean;
  usesPitch: boolean;
  visual: ExerciseVisual;
  defaultDurationSec: number;
  build: (factor: number, totalMs: number) => ExercisePlan;
}

const C4 = 60;
const D4 = 62;
const E4 = 64;
const F4 = 65;
const G4 = 67;
const C5 = 72;
const A3 = 57;
const A4 = 69;

const scaled = (baseMs: number, factor: number) => Math.round(baseMs * factor);

const DO_RE_MI = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'Fa', 'Mi', 'Re'];

const EXERCISES: ExerciseMeta[] = [
  {
    id: 'breath-pacer',
    title: 'Breath Pacer',
    category: 'breath',
    summary: 'Slow inhale and exhale guided by an expanding circle.',
    instructions: [
      'Sit or stand tall with relaxed shoulders.',
      'Follow the circle: it grows as you breathe in and shrinks as you breathe out.',
      'Breathe through your nose on the in-breath and let the out-breath flow long and easy.',
    ],
    usesMic: false,
    usesPitch: false,
    visual: 'pacer',
    defaultDurationSec: 60,
    build: (factor, totalMs) =>
      buildPlan(
        [
          { kind: 'breath-in', durationMs: scaled(4000, factor), label: 'Breathe in' },
          { kind: 'breath-out', durationMs: scaled(6000, factor), label: 'Breathe out' },
        ],
        totalMs
      ),
  },
  {
    id: 'humming-ladder',
    title: 'Gentle Humming Ladder',
    category: 'resonance',
    summary: 'Hum a soft, stepwise ladder with your lips closed.',
    instructions: [
      'Close your lips gently and hum "mmm" with a light, buzzy feeling in the lips.',
      'Each block shows a note. Hum it, matching the height of the block.',
      'Keep the hum quiet and comfortable. Stop if your throat feels tight.',
    ],
    usesMic: true,
    usesPitch: true,
    visual: 'ribbon',
    defaultDurationSec: 90,
    build: (factor, totalMs) =>
      buildPlan(
        [C4, D4, E4, F4, E4, D4, C4].map((midi) => ({
          kind: 'sing' as const,
          durationMs: scaled(1300, factor),
          label: 'Hum',
          midi,
        })),
        totalMs
      ),
  },
  {
    id: 'lip-trill',
    title: 'Lip Trill Rollercoaster',
    category: 'resonance',
    summary: 'Glide up and down a fifth on a relaxed lip trill.',
    instructions: [
      'Relax your lips and blow air through them so they flutter, like a motorboat.',
      'Keep the trill going while the rollercoaster climbs and falls.',
      'Let the sound follow the line. Keep the air steady and the jaw loose.',
    ],
    usesMic: true,
    usesPitch: true,
    visual: 'ribbon',
    defaultDurationSec: 60,
    build: (factor, totalMs) =>
      buildPlan(
        [
          { kind: 'glide', durationMs: scaled(2400, factor), label: 'Trill up', midi: C4, midiEnd: G4 },
          { kind: 'glide', durationMs: scaled(2400, factor), label: 'Trill down', midi: G4, midiEnd: C4 },
        ],
        totalMs
      ),
  },
  {
    id: 'vowel-flow',
    title: 'Vowel Flow',
    category: 'resonance',
    summary: 'Sustain one pitch while moving through five vowels.',
    instructions: [
      'Start on the note shown, with a relaxed open throat.',
      'Move through each vowel without breaking the sound: ah, eh, ee, oh, oo.',
      'This checks pitch steadiness only. Keep the note level as the vowels change.',
    ],
    usesMic: true,
    usesPitch: true,
    visual: 'ribbon',
    defaultDurationSec: 60,
    build: (factor, totalMs) =>
      buildPlan(
        ['ah', 'eh', 'ee', 'oh', 'oo'].map((vowel, index) => ({
          kind: 'sing' as const,
          durationMs: scaled(2400, factor),
          label: vowel,
          midi: D4,
          reference: index === 0,
        })),
        totalMs
      ),
  },
  {
    id: 'five-note-climb',
    title: 'Five-Note Scale Climb',
    category: 'pitch',
    summary: 'Sing a five-note scale up and back down, one note at a time.',
    instructions: [
      'Listen to the reference tone, then sing the syllable on the matching block.',
      'Climb up the five notes, then return down the scale.',
      'Aim for a clear, settled note on each block rather than a sudden slide.',
    ],
    usesMic: true,
    usesPitch: true,
    visual: 'ribbon',
    defaultDurationSec: 120,
    build: (factor, totalMs) =>
      buildPlan(
        [C4, D4, E4, F4, G4, F4, E4, D4].map((midi, index) => ({
          kind: 'sing' as const,
          durationMs: scaled(1100, factor),
          label: DO_RE_MI[index],
          midi,
        })),
        totalMs
      ),
  },
  {
    id: 'arpeggio',
    title: 'Arpeggio Adventure',
    category: 'agility',
    summary: 'Hop through a major chord and back, note by note.',
    instructions: [
      'Listen to each reference tone, then sing the syllable as the block arrives.',
      'The chord climbs from the first note to the octave, then returns.',
      'Keep each jump clean and the tone steady before you move on.',
    ],
    usesMic: true,
    usesPitch: true,
    visual: 'ribbon',
    defaultDurationSec: 90,
    build: (factor, totalMs) =>
      buildPlan(
        [
          { midi: C4, label: 'Do' },
          { midi: E4, label: 'Mi' },
          { midi: G4, label: 'Sol' },
          { midi: C5, label: 'Do' },
          { midi: G4, label: 'Sol' },
          { midi: E4, label: 'Mi' },
        ].map(({ midi, label }) => ({
          kind: 'sing' as const,
          durationMs: scaled(1000, factor),
          label,
          midi,
        })),
        totalMs
      ),
  },
  {
    id: 'register-glide',
    title: 'Register Glide',
    category: 'agility',
    summary: 'Slide smoothly from low to high and back without a break.',
    instructions: [
      'Start low with a light, easy sound on "oo" or "ng".',
      'Glide up and over the middle of your voice with no audible break or step.',
      'Descend back down with the same smooth, connected sound.',
    ],
    usesMic: true,
    usesPitch: true,
    visual: 'ribbon',
    defaultDurationSec: 120,
    build: (factor, totalMs) =>
      buildPlan(
        [
          { kind: 'glide', durationMs: scaled(4000, factor), label: 'Glide up', midi: A3, midiEnd: A4 },
          { kind: 'glide', durationMs: scaled(4000, factor), label: 'Glide down', midi: A4, midiEnd: A3 },
        ],
        totalMs
      ),
  },
  {
    id: 'diction-dash',
    title: 'Diction Dash',
    category: 'agility',
    summary: 'Speak quick, clear phrases in rhythm. No pitch is scored.',
    instructions: [
      'Read each phrase out loud on the beat of the bar. Speak, do not sing.',
      'Crisp consonants matter more than speed. Keep every syllable clear.',
      'Only timing is shown here, so the tempo guides you rather than a score.',
    ],
    usesMic: false,
    usesPitch: false,
    visual: 'words',
    defaultDurationSec: 60,
    build: (factor, totalMs) =>
      buildPlan(
        [
          'Red leather, yellow leather.',
          'Unique New York.',
          'Peter Piper picked a peck of pickled peppers.',
          'Toy boat, toy boat, toy boat.',
        ].map(
          (phrase): SegmentSpec => ({
            kind: 'say',
            durationMs: scaled(2600, factor),
            label: phrase,
          })
        ),
        totalMs
      ),
  },
];

export function getExercise(id: ExerciseId): ExerciseMeta {
  const exercise = EXERCISES.find((entry) => entry.id === id);
  if (!exercise) throw new Error(`Unknown exercise: ${id}`);
  return exercise;
}

export function exercisesForCategory(category: ExerciseCategory): ExerciseMeta[] {
  return EXERCISES.filter((exercise) => exercise.category === category);
}

export function getTempo(id: TempoId): TempoLevel {
  return TEMPO_LEVELS.find((level) => level.id === id) ?? TEMPO_LEVELS[0];
}

export { EXERCISES };
