/**
 * Playback and sol-fa display for a verified song melody.
 *
 * Tapped notes, phrases and the full melody all go through scheduleNotes, so
 * they play identical pitches from the same melody data.
 *
 * SECURITY: Audio via useTonePlayer. No external calls.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, ShieldCheck } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import {
  PLAYBACK_SPEEDS,
  phraseRanges,
  rangeDurationMs,
  scheduleNotes,
  solfaForMelody,
  type EventRange,
  type PlaybackSpeed,
  type SongMelody,
} from '@/lib/songMelody';

interface VerifiedMelodyPanelProps {
  melody: SongMelody;
  source: string;
  verifiedBy: string;
}

export function VerifiedMelodyPanel({ melody, source, verifiedBy }: VerifiedMelodyPanelProps) {
  const { playTone, stopAll } = useTonePlayer();
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [activeEvent, setActiveEvent] = useState<number | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const solfa = useMemo(() => solfaForMelody(melody), [melody]);
  const phrases = useMemo(() => phraseRanges(melody), [melody]);
  const solfaByEvent = useMemo(
    () => new Map(solfa.map((note) => [note.eventIndex, note])),
    [solfa],
  );

  const stopPlayback = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    stopAll();
    setActiveEvent(null);
    setActiveLabel(null);
  }, [stopAll]);

  useEffect(() => stopPlayback, [stopPlayback]);

  const playRange = useCallback((range: EventRange, label: string) => {
    if (activeLabel === label) {
      stopPlayback();
      return;
    }
    stopPlayback();
    setActiveLabel(label);

    for (const note of scheduleNotes(melody, speed, range)) {
      playTone({
        frequency: note.frequency,
        durationMs: note.durationMs,
        type: melody.oscillatorType,
        volume: 0.2,
        startDelayMs: note.startMs,
      });
      timersRef.current.push(setTimeout(() => setActiveEvent(note.eventIndex), note.startMs));
    }
    timersRef.current.push(setTimeout(() => {
      setActiveEvent(null);
      setActiveLabel(null);
      timersRef.current = [];
    }, rangeDurationMs(melody, speed, range)));
  }, [activeLabel, melody, playTone, speed, stopPlayback]);

  const fullRange: EventRange = { start: 0, end: melody.events.length };
  const isPlayingFull = activeLabel === 'full';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-sage-light px-2.5 py-1 text-[11px] font-medium text-sage-deep">
          <ShieldCheck className="h-3 w-3" /> Verified
        </span>
        <span className="text-[11px] text-charcoal-muted">
          {melody.key} · {melody.tempoBpm} BPM · Source: {source} · Verified by {verifiedBy}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => playRange(fullRange, 'full')}
          className="flex items-center gap-1.5 rounded-xl bg-sage-light border border-sage-DEFAULT px-3 py-1.5 text-xs font-medium text-sage-deep transition-all hover:bg-sage-DEFAULT hover:text-cream-50 active:translate-y-0.5"
        >
          {isPlayingFull ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {isPlayingFull ? 'Stop' : 'Play full melody'}
        </button>
        <div role="group" aria-label="Playback speed" className="flex rounded-xl border border-cream-400 bg-cream-50 p-0.5">
          {PLAYBACK_SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={speed === option}
              onClick={() => setSpeed(option)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                speed === option ? 'bg-sage-DEFAULT text-cream-50' : 'text-charcoal-muted hover:bg-cream-100'
              }`}
            >
              {option}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {phrases.map((range, i) => {
          const label = `phrase-${i}`;
          return (
            <button
              key={label}
              type="button"
              onClick={() => playRange(range, label)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                activeLabel === label
                  ? 'border-sage-DEFAULT bg-sage-DEFAULT text-cream-50'
                  : 'border-cream-400 bg-cream-50 text-sage-deep hover:bg-sage-light'
              }`}
            >
              Phrase {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-1.5 rounded-xl border border-cream-400/50 bg-cream-100 p-3">
        {melody.events.map((event, i) => {
          const note = solfaByEvent.get(i);
          if (!note) {
            return (
              <span key={i} className="px-2.5 py-1.5 text-xs text-charcoal-muted" aria-label="rest">
                —
              </span>
            );
          }
          const label = `note-${i}`;
          return (
            <button
              key={i}
              type="button"
              onClick={() => playRange({ start: i, end: i + 1 }, label)}
              aria-label={`${note.syllable} ${note.noteLabel}`}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all active:translate-y-0.5 ${
                activeEvent === i
                  ? 'bg-sage-DEFAULT text-cream-50 shadow-paper-sm'
                  : 'border border-cream-400 bg-cream-50 text-sage-deep hover:bg-sage-light'
              }`}
            >
              <span>{note.syllable}</span>
              <span className={`text-[10px] ${activeEvent === i ? 'text-cream-50' : 'text-charcoal-muted'}`}>{note.noteLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
