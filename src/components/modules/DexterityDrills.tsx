/**
 * Dexterity Drills & Pentatonic Runs — Agility & Runs (Singer/Harmony)
 *
 * Plays a rapid pentatonic scale run (1-2-3-5-6-5-3-2-1). User sings
 * the pattern back. Live pitch detector matches their frequency against
 * the target notes sequentially at speed. Hits light up in mustard gold;
 * misses in dusty rose with a "Slow Down Practice Mode" button.
 *
 * SECURITY: Uses useAudioInput + useTonePlayer (native, cleaned up).
 * Score via submitScore RPC.
 */

import { useCallback, useRef, useState } from 'react';
import { Zap, Volume2, Square, Music, RotateCcw } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { useAudioInput } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { midiToFrequency, frequencyToNote } from '@/lib/notes';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';

const C4 = 60;
const PENTATONIC_DEGREES = [0, 2, 4, 7, 9, 7, 4, 2, 0];
const NOTE_DUR_MS = 280;
const TOLERANCE_CENTS = 50;

type Phase = 'ready' | 'playing' | 'mimicking' | 'result';

interface NoteHit {
  index: number;
  hit: boolean;
}

export function DexterityDrills() {
  const { playSequence, cleanup } = useTonePlayer();
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 100,
    maxFrequency: 600,
  });

  const [phase, setPhase] = useState<Phase>('ready');
  const [hits, setHits] = useState<NoteHit[]>([]);
  const [slowMode, setSlowMode] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const currentNoteRef = useRef(0);
  const hitsRef = useRef<NoteHit[]>([]);

  const targetMidis = PENTATONIC_DEGREES.map((d) => C4 + d);
  const noteCount = targetMidis.length;
  const durationMul = slowMode ? 2 : 1;

  const playPattern = useCallback(() => {
    setHits([]);
    hitsRef.current = [];
    currentNoteRef.current = 0;
    playSequence(
      targetMidis.map((midi) => ({
        frequency: midiToFrequency(midi),
        durationMs: NOTE_DUR_MS * durationMul,
        type: 'triangle',
        volume: 0.2,
      })),
      { gapMs: 60 }
    );

    // Start mimicking phase after pattern finishes
    const totalMs = targetMidis.length * (NOTE_DUR_MS * durationMul + 60) + 300;
    setTimeout(() => {
      setPhase('mimicking');
      currentNoteRef.current = 0;
    }, totalMs);
  }, [playSequence, targetMidis, durationMul]);

  // Check pitch against current target note during mimicking
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startChecking = useCallback(() => {
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    checkIntervalRef.current = setInterval(() => {
      if (currentNoteRef.current >= noteCount) {
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        return;
      }

      if (metrics.frequency && metrics.clarity > 0.3) {
        const targetMidi = targetMidis[currentNoteRef.current];
        const targetFreq = midiToFrequency(targetMidi);
        const userNote = frequencyToNote(metrics.frequency);
        const targetNote = frequencyToNote(targetFreq);

        if (userNote && targetNote && userNote.noteName === targetNote.noteName && Math.abs(userNote.cents - targetNote.cents) < TOLERANCE_CENTS) {
          const newHits = [...hitsRef.current, { index: currentNoteRef.current, hit: true }];
          hitsRef.current = newHits;
          setHits(newHits);
          currentNoteRef.current += 1;
        }
      }
    }, 150);
  }, [metrics, noteCount, targetMidis]);

  // Start checking when entering mimicking phase
  const prevPhaseRef = useRef(phase);
  if (phase === 'mimicking' && prevPhaseRef.current !== 'mimicking') {
    prevPhaseRef.current = phase;
    startChecking();
  }
  if (phase !== 'mimicking') prevPhaseRef.current = phase;

  const handleStart = useCallback(() => {
    setPhase('playing');
    playPattern();
  }, [playPattern]);

  const handleFinish = useCallback(async () => {
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    const hitCount = hitsRef.current.filter((h) => h.hit).length;
    const accuracy = Math.round((hitCount / noteCount) * 100);
    if (isActive) {
      const result = await submitScore('Dexterity Drills', accuracy, 30);
      setScoreResult(result);
    }
    setPhase('result');
  }, [isActive, noteCount]);

  const handleSlowMode = useCallback(() => {
    setSlowMode(true);
    setPhase('playing');
    hitsRef.current = [];
    setHits([]);
    currentNoteRef.current = 0;
    playPattern();
  }, [playPattern]);

  const handleRestart = useCallback(() => {
    cleanup();
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    stop();
    setPhase('ready');
    setHits([]);
    setSlowMode(false);
    setScoreResult(null);
    hitsRef.current = [];
    currentNoteRef.current = 0;
  }, [cleanup, stop]);

  const handleStop = useCallback(() => {
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    stop();
    setPhase('ready');
  }, [stop]);

  const hitCount = hits.filter((h) => h.hit).length;

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Zap className="h-5 w-5 text-mustard-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Dexterity Drills & Pentatonic Runs</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Listen to the {slowMode ? 'slow ' : ''}pentatonic run (1-2-3-5-6-5-3-2-1), then sing it back. Hit each note in sequence to light it up!
      </p>

      {permission !== 'granted' && phase !== 'playing' && (
        <div className="flex flex-col items-center gap-4">
          <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
        </div>
      )}

      {/* Note stepping stones */}
      {(phase === 'playing' || phase === 'mimicking' || phase === 'result') && (
        <div className="flex items-end justify-center gap-2 py-4 flex-wrap max-w-lg">
          {targetMidis.map((midi, i) => {
            const hit = hits.find((h) => h.index === i && h.hit);
            const isCurrent = phase === 'mimicking' && currentNoteRef.current === i;
            const offset = [0, -6, -12, -18, -24, -18, -12, -6, 0][i] ?? 0;
            return (
              <div
                key={i}
                style={{ marginBottom: offset }}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 font-bold text-sm transition-all ${
                  hit
                    ? 'border-mustard-DEFAULT bg-mustard-light text-mustard-deep shadow-paper-mustard'
                    : isCurrent
                      ? 'border-sage-DEFAULT bg-sage-light text-sage-deep animate-pulse'
                      : 'border-cream-400 bg-cream-50 text-charcoal-muted'
                }`}
              >
                {i < 5 ? i + 1 : 10 - i}
              </div>
            );
          })}
        </div>
      )}

      {phase === 'ready' && permission === 'granted' && (
        <button onClick={handleStart} className="btn-primary max-w-xs w-full">
          <Volume2 className="h-5 w-5" /> Play Pattern
        </button>
      )}

      {phase === 'playing' && (
        <div className="text-sm text-charcoal-muted flex items-center gap-2">
          <Music className="h-4 w-4 animate-bounce-note" /> Listening to the pattern...
        </div>
      )}

      {phase === 'mimicking' && (
        <>
          <div className="text-center">
            <div className="text-sm text-charcoal-muted">Now sing it back!</div>
            <div className="text-lg font-bold text-sage-deep mt-1">
              {hitCount} / {noteCount} notes hit
            </div>
            <div className="text-sm text-charcoal-muted mt-1">
              Current: {metrics.noteLabel ?? '—'}
            </div>
          </div>
          {currentNoteRef.current >= noteCount ? (
            <button onClick={handleFinish} className="btn-primary max-w-xs w-full">
              See Results
            </button>
          ) : (
            <button onClick={handleFinish} className="btn-secondary">
              Finish Early
            </button>
          )}
        </>
      )}

      {phase === 'result' && (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="text-center">
            <span className="text-4xl font-bold text-mustard-DEFAULT">{hitCount}/{noteCount}</span>
            <div className="text-sm text-charcoal-muted">notes hit</div>
          </div>
          {scoreResult && (
            <div className={`rounded-xl px-4 py-3 text-sm border ${scoreResult.success ? 'bg-sage-light border-sage-DEFAULT text-sage-deep' : 'bg-terracotta-light border-terracotta-DEFAULT text-terracotta-deep'}`}>
              {scoreResult.success ? `Score saved! +${scoreResult.xpEarned} XP` : `Could not save: ${scoreResult.error}`}
            </div>
          )}
          {hitCount < noteCount && (
            <button onClick={handleSlowMode} className="btn-terracotta">
              <Zap className="h-4 w-4" /> Slow Down Practice Mode
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={handleRestart} className="btn-secondary">
              <RotateCcw className="h-4 w-4" /> Restart
            </button>
            <button onClick={handleStart} className="btn-primary">
              <Volume2 className="h-4 w-4" /> Try Again
            </button>
          </div>
        </div>
      )}

      {isActive && phase !== 'result' && (
        <button onClick={handleStop} className="btn-terracotta max-w-xs w-full">
          <Square className="h-4 w-4" /> Stop
        </button>
      )}
    </div>
  );
}
