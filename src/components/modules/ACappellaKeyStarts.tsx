/**
 * A Cappella Key Starts & SATB Arranging — Music Director Suite (Advanced)
 *
 * Provides a digital drone pitch and a virtual keyboard styled like cozy
 * paper cutouts. User learns to find and give starting pitches.
 * Includes SATB part reference buttons that play each section's starting note.
 *
 * SECURITY: Uses useTonePlayer (native, cleaned up). No mic needed for
 * keyboard/drone practice. Score via submitScore RPC.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, Volume2, Square, Music } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { midiToFrequency, midiToNoteName } from '@/lib/notes';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';

const KEYBOARD_NOTES = [
  { midi: 55, label: 'G3', type: 'white' as const },
  { midi: 57, label: 'A3', type: 'white' as const },
  { midi: 59, label: 'B3', type: 'white' as const },
  { midi: 60, label: 'C4', type: 'white' as const },
  { midi: 61, label: 'C#4', type: 'black' as const },
  { midi: 62, label: 'D4', type: 'white' as const },
  { midi: 63, label: 'D#4', type: 'black' as const },
  { midi: 64, label: 'E4', type: 'white' as const },
  { midi: 65, label: 'F4', type: 'white' as const },
  { midi: 66, label: 'F#4', type: 'black' as const },
  { midi: 67, label: 'G4', type: 'white' as const },
  { midi: 68, label: 'G#4', type: 'black' as const },
  { midi: 69, label: 'A4', type: 'white' as const },
  { midi: 70, label: 'A#4', type: 'black' as const },
  { midi: 71, label: 'B4', type: 'white' as const },
  { midi: 72, label: 'C5', type: 'white' as const },
];

const SATB_PARTS = [
  { label: 'Bass', midi: 43, color: 'bg-sage-light border-sage-DEFAULT text-sage-deep' },
  { label: 'Tenor', midi: 55, color: 'bg-mustard-light border-mustard-DEFAULT text-mustard-deep' },
  { label: 'Alto', midi: 60, color: 'bg-terracotta-light border-terracotta-DEFAULT text-terracotta-deep' },
  { label: 'Soprano', midi: 67, color: 'bg-cream-200 border-cream-400 text-charcoal' },
];

export function ACappellaKeyStarts() {
  const { playTone, stopAll, cleanup } = useTonePlayer();
  const [droneMidi, setDroneMidi] = useState<number | null>(null);
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const droneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track real practice activity: notes explored and SATB pitches previewed
  const uniqueNotesRef = useRef<Set<number>>(new Set());
  const satbPreviewedRef = useRef<Set<string>>(new Set());

  // Clear the drone interval on unmount so audio stops when leaving the page
  useEffect(() => {
    return () => {
      if (droneIntervalRef.current) {
        clearInterval(droneIntervalRef.current);
        droneIntervalRef.current = null;
      }
    };
  }, []);

  const playNote = useCallback((midi: number) => {
    playTone({ frequency: midiToFrequency(midi), durationMs: 600, type: 'triangle', volume: 0.2 });
    setLastPlayed(midiToNoteName(midi) + Math.floor(midi / 12 - 1));
    uniqueNotesRef.current.add(midi);
  }, [playTone, setLastPlayed]);

  const previewSATB = useCallback((label: string, midi: number) => {
    playNote(midi);
    satbPreviewedRef.current.add(label);
  }, [playNote]);

  const startDrone = useCallback((midi: number) => {
    stopAll();
    if (droneIntervalRef.current) clearInterval(droneIntervalRef.current);
    setDroneMidi(midi);
    playTone({ frequency: midiToFrequency(midi), durationMs: 2000, type: 'sine', volume: 0.1 });
    uniqueNotesRef.current.add(midi);
    droneIntervalRef.current = setInterval(() => {
      playTone({ frequency: midiToFrequency(midi), durationMs: 2000, type: 'sine', volume: 0.1 });
    }, 1900);
  }, [playTone, stopAll]);

  const stopDrone = useCallback(() => {
    stopAll();
    if (droneIntervalRef.current) { clearInterval(droneIntervalRef.current); droneIntervalRef.current = null; }
    setDroneMidi(null);
  }, [stopAll]);

  const handleSave = useCallback(async () => {
    stopDrone();
    setIsSubmitting(true);
    // Score reflects actual practice: SATB previews (up to 60%) + note exploration (up to 40%)
    const satbScore = Math.min(60, satbPreviewedRef.current.size * 15);
    const exploreScore = Math.min(40, uniqueNotesRef.current.size * 4);
    const accuracy = Math.min(100, satbScore + exploreScore);
    const result = await submitScore('A Cappella Key Starts', accuracy, 30);
    setScoreResult(result);
    setIsSubmitting(false);
  }, [stopDrone]);

  const handleRestart = useCallback(() => {
    cleanup();
    stopDrone();
    setLastPlayed(null);
    setScoreResult(null);
  }, [cleanup, stopDrone]);

  const whiteKeys = KEYBOARD_NOTES.filter((n) => n.type === 'white');
  const blackKeys = KEYBOARD_NOTES.filter((n) => n.type === 'black');

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Crown className="h-5 w-5 text-mustard-deep" />
        <h3 className="text-lg font-semibold text-charcoal">A Cappella Key Starts & SATB Arranging</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Practice giving starting pitches! Tap a key to hear it, or hold a drone for your choir. Use the SATB buttons to preview each section's starting note.
      </p>

      {/* SATB Part buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        {SATB_PARTS.map((part) => (
          <button
            key={part.label}
            onClick={() => previewSATB(part.label, part.midi)}
            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 font-medium shadow-paper-sm transition-all active:translate-y-0.5 active:shadow-none ${part.color}`}
          >
            <Music className="h-4 w-4" /> {part.label}
          </button>
        ))}
      </div>

      {/* Last played indicator */}
      {lastPlayed && (
        <div className="text-center">
          <span className="text-2xl font-bold text-charcoal">{lastPlayed}</span>
          <div className="text-xs text-charcoal-muted">last note played</div>
        </div>
      )}

      {/* Virtual keyboard */}
      <div className="relative w-full max-w-lg">
        {/* White keys */}
        <div className="flex gap-1">
          {whiteKeys.map((note) => (
            <button
              key={note.midi}
              onClick={() => playNote(note.midi)}
              onContextMenu={(e) => { e.preventDefault(); startDrone(note.midi); }}
              onDoubleClick={() => startDrone(note.midi)}
              aria-label={`Play ${note.label}. Double-tap or right-click to hold as drone.`}
              className={`flex-1 h-28 rounded-b-lg border-2 border-cream-400 bg-cream-50 flex items-end justify-center pb-2 text-[10px] text-charcoal-muted transition-all hover:bg-cream-200 active:bg-cream-300 ${droneMidi === note.midi ? 'bg-sage-light ring-2 ring-sage-DEFAULT' : ''}`}
            >
              {note.label}
            </button>
          ))}
        </div>
        {/* Black keys */}
        <div className="absolute top-0 left-0 right-0 flex pointer-events-none">
          {whiteKeys.map((_, i) => {
            const blackKey = KEYBOARD_NOTES.find((n) => n.type === 'black' && n.midi === whiteKeys[i].midi + 1);
            return (
              <div key={i} className="flex-1 flex justify-end -mr-3">
                {blackKey && (
                  <button
                    onClick={() => playNote(blackKey.midi)}
                    onContextMenu={(e) => { e.preventDefault(); startDrone(blackKey.midi); }}
                    onDoubleClick={() => startDrone(blackKey.midi)}
                    aria-label={`Play ${blackKey.label}. Double-tap or right-click to hold as drone.`}
                    className={`pointer-events-auto w-2/3 h-16 rounded-b-md border border-charcoal/30 bg-charcoal flex items-end justify-center pb-1 text-[8px] text-cream-50 transition-all hover:bg-charcoal-light active:bg-charcoal ${droneMidi === blackKey.midi ? 'bg-sage-deep ring-2 ring-sage-DEFAULT' : ''}`}
                  >
                    {blackKey.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-charcoal-muted text-center">
        Tip: Double-tap (or right-click) a key to hold it as a drone. Use “Stop Drone” to release it.
      </p>

      {/* Drone controls */}
      <div className="flex items-center gap-3">
        {droneMidi !== null && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-sage-DEFAULT animate-pulse" />
              <span className="text-charcoal-muted">Drone: {midiToNoteName(droneMidi)}{Math.floor(droneMidi / 12 - 1)}</span>
            </div>
            <button onClick={stopDrone} className="btn-terracotta">
              <Square className="h-4 w-4" /> Stop Drone
            </button>
          </>
        )}
        {droneMidi === null && lastPlayed && (
          <button onClick={handleSave} className="btn-primary" disabled={isSubmitting}>
            <Volume2 className="h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save Practice Session'}
          </button>
        )}
      </div>

      {scoreResult && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${scoreResult.success ? 'bg-sage-light border-sage-DEFAULT text-sage-deep' : 'bg-terracotta-light border-terracotta-DEFAULT text-terracotta-deep'}`}>
          {scoreResult.success ? `Session saved! +${scoreResult.xpEarned} XP` : `Could not save: ${scoreResult.error}`}
        </div>
      )}

      {scoreResult && (
        <button onClick={handleRestart} className="btn-secondary">
          Reset
        </button>
      )}
    </div>
  );
}
