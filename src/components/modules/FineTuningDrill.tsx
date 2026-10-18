/**
 * Fine-Tuning Drill — Pitch & Ear Precision (Foundation)
 *
 * Plays a target drone. User sings into mic. Real-time pitch detection
 * compares user's Hz to the target, showing cents deviation. A musical
 * note icon moves up (sharp) or down (flat). Must stay within +/-15 cents
 * for 3 consecutive seconds to earn an "Ear Master" streak.
 *
 * SECURITY: Uses useAudioInput (native Web Audio, no raw audio stored).
 * Score via submitScore RPC. Audio drone via useTonePlayer (cleaned up).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Target, MicOff, RotateCcw, Music } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { useAudioInput } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';

const TARGET_FREQ = 261.63;
const TOLERANCE_CENTS = 15;
const REQUIRED_HOLD_SECONDS = 3;

export function FineTuningDrill() {
  const { playTone, stopAll, cleanup } = useTonePlayer();
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput();
  const [dronePlaying, setDronePlaying] = useState(false);
  const [inTuneSeconds, setInTuneSeconds] = useState(0);
  const [earMasterStreak, setEarMasterStreak] = useState(0);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const holdRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  // Start/stop the continuous drone
  useEffect(() => {
    if (dronePlaying) {
      const ctx = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (ctx) {
        // Re-play the drone tone every 2 seconds to keep it going
        const interval = setInterval(() => {
          playTone({ frequency: TARGET_FREQ, durationMs: 2000, type: 'sine', volume: 0.12 });
        }, 1900);
        playTone({ frequency: TARGET_FREQ, durationMs: 2000, type: 'sine', volume: 0.12 });
        return () => clearInterval(interval);
      }
    }
  }, [dronePlaying, playTone]);

  // Track in-tune hold time
  useEffect(() => {
    if (!isActive) { lastTickRef.current = null; return; }
    const interval = setInterval(() => {
      const now = Date.now();
      if (lastTickRef.current === null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const m = metricsRef.current;
      const inTune = m.frequency !== null && m.clarity > 0.3 && Math.abs(m.cents ?? 0) <= TOLERANCE_CENTS;

      if (inTune) {
        holdRef.current += delta;
        setInTuneSeconds(holdRef.current);
        if (holdRef.current >= REQUIRED_HOLD_SECONDS) {
          setEarMasterStreak((s) => s + 1);
          holdRef.current = 0;
          setInTuneSeconds(0);
        }
      } else {
        holdRef.current = 0;
        setInTuneSeconds(0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive]);

  const handleStartDrone = useCallback(() => {
    setDronePlaying(true);
    start();
  }, [start]);

  const handleStop = useCallback(async () => {
    setDronePlaying(false);
    stopAll();
    stop();

    if (earMasterStreak > 0) {
      setIsSubmitting(true);
      const accuracy = Math.min(100, Math.round((earMasterStreak / 3) * 100));
      const result = await submitScore('Fine-Tuning Drill', accuracy, 60);
      setScoreResult(result);
      setIsSubmitting(false);
    }
  }, [stopAll, stop, earMasterStreak]);

  const handleRestart = useCallback(() => {
    cleanup();
    setDronePlaying(false);
    setInTuneSeconds(0);
    setEarMasterStreak(0);
    setScoreResult(null);
    holdRef.current = 0;
    stop();
  }, [cleanup, stop]);
  const cents = metrics.cents ?? 0;
  const inTune = metrics.frequency !== null && metrics.clarity > 0.3 && Math.abs(cents) <= TOLERANCE_CENTS;
  const noteOffset = Math.max(-60, Math.min(60, cents));
  const holdPercent = Math.min(100, (inTuneSeconds / REQUIRED_HOLD_SECONDS) * 100);

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Target className="h-5 w-5 text-sage-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Fine-Tuning Drill</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        A drone will play at C4 (261 Hz). Sing along and keep the note centered on the line within ±{TOLERANCE_CENTS} cents for {REQUIRED_HOLD_SECONDS}s to earn an Ear Master streak!
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={handleStartDrone} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <>
          {/* Tuning visualizer */}
          <div className="relative w-full max-w-md h-48 rounded-2xl bg-cream-50 border border-cream-400 shadow-paper-sm overflow-hidden staff-bg">
            {/* Center "In Tune" line */}
            <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-sage-DEFAULT" style={{ boxShadow: '0 0 8px rgba(168,201,160,0.4)' }} />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-sage-deep/60 font-medium">In Tune</div>

            {/* Tolerance zone */}
            <div className="absolute left-0 right-0 bg-sage-light/30" style={{ top: 'calc(50% - 12px)', height: '24px' }} />

            {/* Bouncing musical note */}
            <div
              className="absolute left-1/2 -translate-x-1/2 transition-all duration-100"
              style={{ top: `calc(50% + ${noteOffset * 0.5}px - 16px)` }}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                  inTune ? 'bg-sage-light border-sage-DEFAULT shadow-paper-sage' : 'bg-cream-200 border-cream-400'
                }`}
              >
                <Music className={`h-4 w-4 ${inTune ? 'text-sage-deep' : 'text-charcoal-muted'}`} />
              </div>
            </div>

            {/* Sharp/Flat indicators */}
            <span className="absolute right-3 top-3 text-[10px] text-terracotta-deep/60">Sharp ↑</span>
            <span className="absolute right-3 bottom-3 text-[10px] text-mustard-deep/60">Flat ↓</span>
          </div>

          {/* Stats */}
          <div className="flex w-full max-w-md justify-between text-center">
            <div>
              <div className={`text-2xl font-bold ${inTune ? 'text-sage-deep' : 'text-charcoal'}`}>
                {metrics.frequency ? `${cents > 0 ? '+' : ''}${cents}` : '—'}
              </div>
              <div className="text-xs text-charcoal-muted">cents</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-charcoal">{metrics.noteLabel ?? '—'}</div>
              <div className="text-xs text-charcoal-muted">your note</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-mustard-DEFAULT">{earMasterStreak}</div>
              <div className="text-xs text-charcoal-muted">Ear Master</div>
            </div>
          </div>

          {/* Hold progress bar */}
          <div className="w-full max-w-md">
            <div className="flex justify-between text-xs text-charcoal-muted mb-1">
              <span>Hold time</span>
              <span>{inTuneSeconds.toFixed(1)}s / {REQUIRED_HOLD_SECONDS}s</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-cream-300">
              <div className="h-full rounded-full bg-sage-DEFAULT transition-all duration-100" style={{ width: `${holdPercent}%` }} />
            </div>
          </div>

          {/* Drone indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`h-2 w-2 rounded-full ${dronePlaying ? 'bg-sage-DEFAULT animate-pulse' : 'bg-cream-400'}`} />
            <span className="text-charcoal-muted">Drone: {dronePlaying ? 'Playing C4' : 'Off'}</span>
          </div>

          {scoreResult && (
            <div className={`rounded-xl px-4 py-3 text-sm border ${scoreResult.success ? 'bg-sage-light border-sage-DEFAULT text-sage-deep' : 'bg-terracotta-light border-terracotta-DEFAULT text-terracotta-deep'}`}>
              {scoreResult.success ? `Score saved! +${scoreResult.xpEarned} XP earned (${earMasterStreak} streaks)` : `Could not save: ${scoreResult.error}`}
            </div>
          )}
          {isSubmitting && <div className="text-sm text-charcoal-muted">Saving score...</div>}

          <div className="flex gap-3">
            <button onClick={handleRestart} className="btn-secondary">
              <RotateCcw className="h-4 w-4" /> Restart
            </button>
            <button onClick={handleStop} className="btn-terracotta">
              <MicOff className="h-4 w-4" /> Stop & Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}
