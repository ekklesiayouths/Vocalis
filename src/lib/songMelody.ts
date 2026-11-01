/**
 * Structured melody data for the Song Learning Library.
 *
 * A melody is a list of note and rest events with durations in beats. Sol-fa
 * and playback timing are derived from these events, so the displayed syllables,
 * tapped-note playback and full-melody playback always read the same pitches.
 *
 * SECURITY: Pure computation, no I/O.
 */

import { midiToNoteLabel, deriveSolfa } from '@/lib/solfaUtils';
import { midiToFrequency } from '@/lib/notes';

export type MelodyEvent =
  | { kind: 'note'; midi: number; beats: number }
  | { kind: 'rest'; beats: number };

export interface SongMelody {
  /** Key used for movable-do sol-fa, e.g. "G Major" */
  key: string;
  tempoBpm: number;
  events: MelodyEvent[];
  /** Event indexes where a phrase begins. The first entry must be 0. */
  phraseStarts: number[];
  oscillatorType: OscillatorType;
}

export type SongVerification =
  | { status: 'needs_review'; reviewNote: string; melody: null }
  | { status: 'verified'; source: string; verifiedBy: string; melody: SongMelody };

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface EventRange {
  start: number;
  end: number;
}

export interface ScheduledNote {
  eventIndex: number;
  midi: number;
  frequency: number;
  startMs: number;
  durationMs: number;
}

export interface SolfaNote {
  eventIndex: number;
  syllable: string;
  noteLabel: string;
  midi: number;
}

function eventStartBeats(events: MelodyEvent[]): number[] {
  const starts: number[] = [];
  let beat = 0;
  for (const event of events) {
    starts.push(beat);
    beat += event.beats;
  }
  return starts;
}

/**
 * Schedule every sounding note in a range of events. Times are relative to the
 * start of the range. Speed changes durations only, never pitch.
 */
export function scheduleNotes(
  melody: SongMelody,
  speed: number,
  range: EventRange = { start: 0, end: melody.events.length },
): ScheduledNote[] {
  const beatMs = 60000 / (melody.tempoBpm * speed);
  const starts = eventStartBeats(melody.events);
  const origin = starts[range.start] ?? 0;
  const scheduled: ScheduledNote[] = [];

  for (let i = range.start; i < range.end && i < melody.events.length; i++) {
    const event = melody.events[i];
    if (event.kind !== 'note') continue;
    scheduled.push({
      eventIndex: i,
      midi: event.midi,
      frequency: midiToFrequency(event.midi),
      startMs: (starts[i] - origin) * beatMs,
      durationMs: event.beats * beatMs,
    });
  }
  return scheduled;
}

export function rangeDurationMs(
  melody: SongMelody,
  speed: number,
  range: EventRange = { start: 0, end: melody.events.length },
): number {
  const beats = melody.events
    .slice(range.start, range.end)
    .reduce((sum, event) => sum + event.beats, 0);
  return beats * (60000 / (melody.tempoBpm * speed));
}

/** Sol-fa and octave for each sounding note, derived from its pitch and the key. */
export function solfaForMelody(melody: SongMelody): SolfaNote[] {
  const noteEvents = melody.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter((entry): entry is { event: Extract<MelodyEvent, { kind: 'note' }>; eventIndex: number } =>
      entry.event.kind === 'note');
  const syllables = deriveSolfa(noteEvents.map((entry) => entry.event.midi), melody.key);

  return noteEvents.map((entry, i) => ({
    eventIndex: entry.eventIndex,
    syllable: syllables[i],
    noteLabel: midiToNoteLabel(entry.event.midi),
    midi: entry.event.midi,
  }));
}

/** Phrase ranges in event indexes. Each range ends where the next phrase begins. */
export function phraseRanges(melody: SongMelody): EventRange[] {
  return melody.phraseStarts.map((start, i) => ({
    start,
    end: melody.phraseStarts[i + 1] ?? melody.events.length,
  }));
}
