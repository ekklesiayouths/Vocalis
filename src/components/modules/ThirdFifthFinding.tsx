/**
 * 3rd/5th Finding & Part Stability — Harmony & Choral Mastery (Harmony)
 *
 * Plays a looping "Choir Lead" melody. User chooses to sing the 3rd above
 * or 5th below. While the lead loops, user sings the harmony interval.
 * Pitch engine grades whether they hold their line without getting pulled
 * into the lead melody.
 *
 * SECURITY: Uses useAudioInput + useTonePlayer (native, cleaned up).
 * Score via submitScore RPC.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Volume2, Square, Music, Check } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { useAudioInput } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { midiToFrequency, frequencyToNote } from '@/lib/notes';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';

const C4 = 60;
const LEAD_MELODY = [C4, C4 + 2, C4 + 4, C4 + 2, C4, C4 - 3, C4, C4 + 7];
const NOTE_DUR = 350;
const TOLERANCE_CENTS = 50;

type Phase = 'ready' | 'choosing' | 'singing' | 'result';

type HarmonyChoice = 'third-above' | 'fifth-below';

export function ThirdFifthFinding() {
  const { playSequence, stopAll, cleanup } = useTonePlayer();
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput();
  const [phase, setPhase] = useState<Phase>('ready');
  const [choice, setChoice] = useState<HarmonyChoice | null>(null);
  const [stableSeconds, setStableSeconds] = useState(0);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

  const targetMidi = choice === 'third-above' ? C4 + 4 : C4 - 7;
  const targetFreq = midiToFrequency(targetMidi);
  const targetNote = frequencyToNote(targetFreq);

  const playLeadLoop = useCallback(() => {
    playSequence(
      LEAD_MELODY.map((midi) => ({
        frequency: midiToFrequency(midi),
        durationMs: NOTE_DUR,
        type: 'triangle',
        volume: 0.15,
      })),
      { gapMs: 50 }
    );
  }, [playSequence]);

  const startLeadLoop = useCallback(() => {
    playLeadLoop();
    const totalMs = LEAD_MELODY.length * (NOTE_DUR + 50);
    loopIntervalRef.current = setInterval(() => playLeadLoop(), totalMs);
  }, [playLeadLoop]);

  const stopLeadLoop = useCallback(() => {
    if (loopIntervalRef.current) { clearInterval(loopIntervalRef.current); loopIntervalRef.current = null; }
    stopAll();
  }, [stopAll]);

  // Track stability while singing
  useEffect(() => {
    if (phase !== 'singing') { lastTickRef.current = null; return; }
    const interval = setInterval(() => {
      const now = Date.now();
      if (lastTickRef.current === null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      if (metrics.frequency && metrics.clarity > 0.3) {
        const userNote = frequencyToNote(metrics.frequency);
        if (userNote && targetNote && userNote.noteName === targetNote.noteName && Math.abs(userNote.cents - targetNote.cents) < TOLERANCE_CENTS) {
          stableRef.current += delta;
          setStableSeconds(stableRef.current);
        } else {
          stableRef.current = Math.max(0, stableRef.current - delta * 0.5);
          setStableSeconds(stableRef.current);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase, metrics, targetNote]);

  const handleChoose = useCallback((c: HarmonyChoice) => {
    setChoice(c);
    setPhase('singing');
    start();
    setTimeout(() => startLeadLoop(), 300);
  }, [start, startLeadLoop]);

  const handleFinish = useCallback(async () => {
    stopLeadLoop();
    stop();
    const accuracy = Math.min(100, Math.round((stableSeconds / 10) * 100));
    setIsSubmitting(true);
    const result = await submitScore('3rd/5th Finding', accuracy, 30);
    setScoreResult(result);
    setIsSubmitting(false);
    setPhase('result');
  }, [stopLeadLoop, stop, stableSeconds]);

  const handleRestart = useCallback(() => {
    cleanup();
    stopLeadLoop();
    stop();
    setPhase('ready');
    setChoice(null);
    setStableSeconds(0);
    setScoreResult(null);
    stableRef.current = 0;
  }, [cleanup, stopLeadLoop, stop]);

  const userNote = metrics.frequency ? frequencyToNote(metrics.frequency) : null;
  const onTarget = userNote && targetNote && userNote.noteName === targetNote.noteName && Math.abs(userNote.cents - targetNote.cents) < TOLERANCE_CENTS;

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-terracotta-deep" />
        <h3 className="text-lg font-semibold text-charcoal">3rd/5th Finding & Part Stability</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        A choir lead melody will loop. Choose a harmony part to sing against it — hold your line without getting pulled into the lead!
      </p>

      {phase === 'ready' && permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {phase === 'ready' && permission === 'granted' && (
        <div className="flex flex-col gap-3 w-full max-w-md">
          <button onClick={() => handleChoose('third-above')} className="card-dashed-hover p-5 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-light border border-sage-DEFAULT">
                <Music className="h-5 w-5 text-sage-deep" />
              </div>
              <div>
                <h4 className="font-semibold text-charcoal">Sing the 3rd Above</h4>
                <p className="text-sm text-charcoal-muted">Harmonize a third higher than the lead</p>
              </div>
            </div>
          </button>
          <button onClick={() => handleChoose('fifth-below')} className="card-dashed-hover p-5 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta-light border border-terracotta-DEFAULT">
                <Music className="h-5 w-5 text-terracotta-deep" />
              </div>
              <div>
                <h4 className="font-semibold text-charcoal">Sing the 5th Below</h4>
                <p className="text-sm text-charcoal-muted">Anchor the chord a fifth below the lead</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {phase === 'singing' && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-sage-DEFAULT animate-pulse" />
            <span className="text-charcoal-muted">Lead melody looping...</span>
            <button onClick={playLeadLoop} className="ml-2 text-sage-deep hover:text-sage-deep/70">
              <Volume2 className="h-4 w-4 inline" /> Replay
            </button>
          </div>

          <div className="flex w-full max-w-md justify-between text-center">
            <div>
              <div className="text-xl font-bold text-charcoal">{targetNote?.fullLabel}</div>
              <div className="text-xs text-charcoal-muted">your target</div>
            </div>
            <div>
              <div className={`text-xl font-bold ${onTarget ? 'text-sage-deep' : 'text-charcoal'}`}>{userNote?.fullLabel ?? '—'}</div>
              <div className="text-xs text-charcoal-muted">you're singing</div>
            </div>
            <div>
              <div className="text-xl font-bold text-mustard-DEFAULT">{stableSeconds.toFixed(1)}s</div>
              <div className="text-xs text-charcoal-muted">stable</div>
            </div>
          </div>

          <div className="w-full max-w-md">
            <div className="flex justify-between text-xs text-charcoal-muted mb-1">
              <span>Stability</span>
              <span>{onTarget ? 'On your line!' : 'Find your note'}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-cream-300">
              <div className={`h-full rounded-full transition-all duration-100 ${onTarget ? 'bg-sage-DEFAULT' : 'bg-terracotta-DEFAULT'}`} style={{ width: `${Math.min(100, (stableSeconds / 10) * 100)}%` }} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleFinish} className="btn-primary">
              <Check className="h-4 w-4" /> Finish
            </button>
            <button onClick={handleRestart} className="btn-terracotta">
              <Square className="h-4 w-4" /> Stop
            </button>
          </div>
        </>
      )}

      {phase === 'result' && (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="text-center">
            <span className="text-4xl font-bold text-mustard-DEFAULT">{stableSeconds.toFixed(1)}s</span>
            <div className="text-sm text-charcoal-muted">of stable harmony</div>
          </div>
          {scoreResult && (
            <div className={`rounded-xl px-4 py-3 text-sm border ${scoreResult.success ? 'bg-sage-light border-sage-DEFAULT text-sage-deep' : 'bg-terracotta-light border-terracotta-DEFAULT text-terracotta-deep'}`}>
              {scoreResult.success ? `Score saved! +${scoreResult.xpEarned} XP` : `Could not save: ${scoreResult.error}`}
            </div>
          )}
          <button onClick={handleRestart} className="btn-primary max-w-xs w-full">
            <Volume2 className="h-4 w-4" /> Try Again
          </button>
        </div>
      )}
    </div>
  );
}
