import { midiToFrequency } from '@/lib/notes';

export type SegmentKind = 'sing' | 'glide' | 'rest' | 'breath-in' | 'breath-out' | 'say';

export interface Segment {
  kind: SegmentKind;
  startMs: number;
  endMs: number;
  label: string;
  midi: number | null;
  midiEnd: number | null;
  reference: boolean;
  listenFromMs: number;
  toleranceCents: number;
}

export interface ExercisePlan {
  totalMs: number;
  segments: Segment[];
}

export interface SegmentSpec {
  kind: SegmentKind;
  durationMs: number;
  label: string;
  midi?: number;
  midiEnd?: number;
  reference?: boolean;
}

export interface PitchTarget {
  midi: number;
  toleranceCents: number;
}

export const REFERENCE_TONE_MS = 400;
const REFERENCE_LEAD_MS = 500;
const SETTLE_MS = 250;
const MIN_SEGMENT_MS = 400;
const NOTE_TOLERANCE_CENTS = 50;
const GLIDE_TOLERANCE_CENTS = 80;

export function buildPlan(cycle: SegmentSpec[], totalMs: number): ExercisePlan {
  const cycleMs = cycle.reduce((sum, spec) => sum + spec.durationMs, 0);
  if (cycleMs <= 0 || totalMs <= 0) return { totalMs: 0, segments: [] };

  const segments: Segment[] = [];
  let cursor = 0;
  while (cursor < totalMs) {
    for (const spec of cycle) {
      if (cursor >= totalMs) break;
      const endMs = Math.min(cursor + spec.durationMs, totalMs);
      if (endMs - cursor < MIN_SEGMENT_MS) {
        cursor = totalMs;
        break;
      }
      segments.push(toSegment(spec, cursor, endMs));
      cursor = endMs;
    }
  }

  const last = segments[segments.length - 1];
  return { totalMs: last ? last.endMs : 0, segments };
}

function toSegment(spec: SegmentSpec, startMs: number, endMs: number): Segment {
  const isPitched = spec.midi !== undefined;
  const reference = isPitched && (spec.reference ?? true);
  const duration = endMs - startMs;
  const lead = reference
    ? Math.min(REFERENCE_LEAD_MS, duration * 0.6)
    : Math.min(SETTLE_MS, duration * 0.2);
  return {
    kind: spec.kind,
    startMs,
    endMs,
    label: spec.label,
    midi: spec.midi ?? null,
    midiEnd: spec.midiEnd ?? null,
    reference,
    listenFromMs: startMs + lead,
    toleranceCents: spec.kind === 'glide' ? GLIDE_TOLERANCE_CENTS : NOTE_TOLERANCE_CENTS,
  };
}

export function segmentIndexAt(segments: Segment[], ms: number): number {
  return segments.findIndex((segment) => ms >= segment.startMs && ms < segment.endMs);
}

export function pitchTargetAt(plan: ExercisePlan, ms: number): PitchTarget | null {
  const segment = plan.segments[segmentIndexAt(plan.segments, ms)];
  if (!segment || segment.midi === null || ms < segment.listenFromMs) return null;
  const progress = (ms - segment.startMs) / (segment.endMs - segment.startMs);
  const midi =
    segment.midiEnd === null ? segment.midi : segment.midi + (segment.midiEnd - segment.midi) * progress;
  return { midi, toleranceCents: segment.toleranceCents };
}

export function centsFromMidi(frequency: number, midi: number): number {
  return 1200 * Math.log2(frequency / midiToFrequency(midi));
}

export function pitchRange(plan: ExercisePlan): { low: number; high: number } | null {
  const pitches = plan.segments.flatMap((segment) =>
    segment.midi === null ? [] : [segment.midi, segment.midiEnd ?? segment.midi]
  );
  if (pitches.length === 0) return null;
  const low = Math.min(...pitches) - 2;
  const high = Math.max(...pitches) + 2;
  return { low, high: Math.max(high, low + 7) };
}
