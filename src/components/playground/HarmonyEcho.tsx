/**
 * Harmony Echo — record user's vocal phrase, play it back with synthesized harmony.
 *
 * The app plays a simple vocal phrase (a short melody). The user sings it back.
 * The app records their pitch over time, then plays it back overlaid with a
 * synthesized parallel harmony layer (a third above) to reward execution.
 *
 * SECURITY: Uses useAudioInput for pitch detection (native, no raw audio stored).
 * Uses useTonePlayer for playback (native Web Audio, cleaned up on unmount).
 * The "recording" is a sequence of detected frequencies — not raw audio data.
 * No audio data is stored or transmitted.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Volume2, Mic, Square, Play, RotateCcw } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { midiToFrequency } from '@/lib/notes';

type Phase = 'ready' | 'listening' | 'recording' | 'playback' | 'done';

const PHRASE_MIDIS = [60, 62, 64, 62, 60];
const NOTE_DUR = 400;
const RECORD_DURATION = PHRASE_MIDIS.length * (NOTE_DUR + 100);
const HARMONY_OFFSET = 4; // Major 3rd above

interface RecordedNote {
  frequency: number;
  timestamp: number;
}

export function HarmonyEcho() {
  const { playSequence, playTone, stopAll, cleanup } = useTonePlayer();
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput();
  const [phase, setPhase] = useState<Phase>('ready');
  const [recordedNotes, setRecordedNotes] = useState<RecordedNote[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);
  const notesRef = useRef<RecordedNote[]>([]);
  const listeningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest metrics in a ref so the recording effect doesn't depend on
  // the metrics object (which changes every frame and would reset the interval).
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;

  const playPhrase = useCallback(() => {
    playSequence(
      PHRASE_MIDIS.map((midi) => ({
        frequency: midiToFrequency(midi),
        durationMs: NOTE_DUR,
        type: 'triangle',
        volume: 0.2,
      })),
      { gapMs: 100 }
    );
  }, [playSequence]);

  const handleStart = useCallback(() => {
    setPhase('listening');
    playPhrase();
    const totalMs = PHRASE_MIDIS.length * (NOTE_DUR + 100) + 300;
    if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
    listeningTimeoutRef.current = setTimeout(() => {
      setPhase('recording');
      recordStartRef.current = Date.now();
      notesRef.current = [];
      setRecordedNotes([]);
      start();
    }, totalMs);
  }, [playPhrase, start]);

  // Record pitch during recording phase — depends only on [phase]
  useEffect(() => {
    if (phase !== 'recording') return;

    recordIntervalRef.current = setInterval(() => {
      const m = metricsRef.current;
      if (m.frequency && m.clarity > 0.3) {
        notesRef.current.push({
          frequency: m.frequency,
          timestamp: Date.now() - recordStartRef.current,
        });
      }
    }, 50);

    const timeout = setTimeout(() => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      stop();
      setRecordedNotes(notesRef.current);
      setPhase('playback');
    }, RECORD_DURATION);

    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      clearTimeout(timeout);
    };
  }, [phase, stop]);

  const handlePlayback = useCallback(() => {
    if (recordedNotes.length === 0) return;
    stopAll();

    // Play back the user's recorded melody
    recordedNotes.forEach((note) => {
      playTone({
        frequency: note.frequency,
        durationMs: 80,
        type: 'sine',
        volume: 0.2,
        startDelayMs: note.timestamp,
      });
    });

    // Play harmony layer (a third above) in parallel
    recordedNotes.forEach((note) => {
      const harmonyFreq = note.frequency * Math.pow(2, HARMONY_OFFSET / 12);
      playTone({
        frequency: harmonyFreq,
        durationMs: 80,
        type: 'triangle',
        volume: 0.12,
        startDelayMs: note.timestamp,
      });
    });

    setPhase('done');
  }, [recordedNotes, playTone, stopAll]);

  const handleRestart = useCallback(() => {
    cleanup();
    stop();
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
    setPhase('ready');
    setRecordedNotes([]);
    notesRef.current = [];
  }, [cleanup, stop]);

  const handleStop = useCallback(() => {
    stop();
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
    setPhase('ready');
  }, [stop]);

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <AudioLines className="h-5 w-5 text-mustard-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Harmony Echo</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Listen to the phrase, sing it back, and hear yourself with a harmony layer added on top!
      </p>

      {permission !== 'granted' && phase === 'ready' && (
        <div className="flex flex-col items-center gap-4">
          <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
        </div>
      )}

      {phase === 'ready' && permission === 'granted' && (
        <button onClick={handleStart} className="btn-primary max-w-xs w-full">
          <Volume2 className="h-5 w-5" /> Play Phrase & Sing
        </button>
      )}

      {phase === 'listening' && (
        <div className="flex flex-col items-center gap-3">
          <Volume2 className="h-8 w-8 text-sage-deep animate-pulse" />
          <p className="text-sm text-charcoal-muted">Listen carefully... then sing it back!</p>
        </div>
      )}

      {phase === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <Mic className="h-8 w-8 text-terracotta-deep animate-pulse" />
          <p className="text-sm text-charcoal-muted">Sing the phrase now! Recording...</p>
          <div className="text-lg font-bold text-charcoal">{metrics.noteLabel ?? '—'}</div>
        </div>
      )}

      {phase === 'playback' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-charcoal-muted">
            {recordedNotes.length > 0
              ? `Recorded ${recordedNotes.length} pitch points! Ready to hear it with harmony?`
              : 'No pitch detected. Try singing louder next time!'}
          </p>
          {recordedNotes.length > 0 && (
            <button onClick={handlePlayback} className="btn-mustard max-w-xs w-full">
              <Play className="h-5 w-5" /> Play With Harmony
            </button>
          )}
          <button onClick={handleRestart} className="btn-secondary">
            <RotateCcw className="h-4 w-4" /> Try Again
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-light border border-sage-DEFAULT shadow-paper-sage animate-bounce-note">
            <AudioLines className="h-7 w-7 text-sage-deep" />
          </div>
          <p className="text-sm text-charcoal-muted">That is you singing with a harmony layer a third above!</p>
          <div className="flex gap-3">
            <button onClick={handlePlayback} className="btn-mustard">
              <Play className="h-4 w-4" /> Replay
            </button>
            <button onClick={handleRestart} className="btn-primary">
              <RotateCcw className="h-4 w-4" /> Try Again
            </button>
          </div>
        </div>
      )}

      {isActive && phase !== 'done' && phase !== 'playback' && (
        <button onClick={handleStop} className="btn-terracotta max-w-xs w-full">
          <Square className="h-4 w-4" /> Stop
        </button>
      )}
    </div>
  );
}
