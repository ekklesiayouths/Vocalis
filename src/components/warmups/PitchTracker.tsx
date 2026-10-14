/**
 * Pitch tracker warm-up — warm notebook styling.
 * Shows detected note, cents deviation gauge (sharp/flat/in-tune).
 * Features a bouncing musical note icon that tracks the user's pitch.
 *
 * SECURITY: Uses the shared useAudioInput hook. No raw audio stored.
 */

import { useEffect, useRef, useState } from 'react';
import { MicOff, Activity, Music, Save } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { IN_TUNE_THRESHOLD_CENTS } from '@/lib/notes';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';
import { submitAttempt } from '@/lib/progressService';

export function PitchTracker() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput();

  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;
  const inTuneFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (startTimeRef.current !== null) {
        // Session was running, now stopping
      }
      return;
    }
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    let raf: number;
    const track = () => {
      const m = metricsRef.current;
      if (m.frequency && m.clarity > 0.4) {
        totalFramesRef.current++;
        if (m.tuning === 'in-tune') inTuneFramesRef.current++;
      }
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    return () => cancelAnimationFrame(raf);
  }, [isActive]);

  const handleStopAndSave = async () => {
    const elapsedSec = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    stop();
    if (elapsedSec > 0 && totalFramesRef.current > 0) {
      setIsSubmitting(true);
      const accuracy = Math.min(100, Math.round((inTuneFramesRef.current / totalFramesRef.current) * 100));
      const result = await submitScore('Pitch Tracker', accuracy, elapsedSec);
      if (result.success) {
        const ratio = totalFramesRef.current > 0 ? inTuneFramesRef.current / totalFramesRef.current : 0;
        await submitAttempt('Pitch Tracker', accuracy, elapsedSec, result.xpEarned ?? 0, ratio);
      }
      setScoreResult(result);
      setIsSubmitting(false);
    }
  };

  const cents = metrics.cents ?? 0;
  const tuning = metrics.tuning ?? 'in-tune';
  const needleRotation = Math.max(-50, Math.min(50, (cents / 50) * 50));

  const tuningColor =
    tuning === 'in-tune' ? '#7BA872' : tuning === 'sharp' ? '#E4A598' : '#D4AD2E';
  const tuningLabel =
    tuning === 'in-tune' ? 'In tune' : `${Math.abs(cents)} cents ${tuning}`;
  const tuningTextClass =
    tuning === 'in-tune' ? 'text-sage-deep' : tuning === 'sharp' ? 'text-terracotta-deep' : 'text-mustard-deep';

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-charcoal" />
        <h3 className="text-lg font-semibold text-charcoal">Vocal Pitch Tracker</h3>
      </div>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          {/* Bouncing note icon + note display */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-200 border border-cream-400 shadow-paper-sm"
              style={{ animation: metrics.frequency ? 'bounceNote 1.5s ease-in-out infinite' : 'none' }}
            >
              <Music className="h-8 w-8" style={{ color: tuningColor }} />
            </div>
            <span className="text-5xl font-bold text-charcoal">
              {metrics.noteLabel ?? '--'}
            </span>
          </div>

          {/* Needle gauge */}
          <div className="relative h-24 w-full max-w-xs">
            <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-charcoal/10" />
            <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-charcoal/10" />
            <div className="absolute right-0 top-1/2 h-0.5 w-1/4 -translate-y-1/2 bg-terracotta-DEFAULT/30" />
            <div className="absolute left-0 top-1/2 h-0.5 w-1/4 -translate-y-1/2 bg-terracotta-DEFAULT/30" />
            <div className="absolute left-1/2 top-1/2 h-1 w-12 -translate-x-1/2 -translate-y-1/2 rounded bg-sage-DEFAULT/40" />
            <div
              className="absolute left-1/2 top-1/2 h-16 w-1 origin-bottom -translate-x-1/2 transition-transform duration-100"
              style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)`, backgroundColor: tuningColor }}
            />
          </div>

          <div className="flex w-full justify-between text-sm">
            <span className="text-charcoal-muted">{metrics.frequency ? `${metrics.frequency.toFixed(1)} Hz` : '—'}</span>
            <span className={`font-medium ${tuningTextClass}`}>{metrics.noteLabel ? tuningLabel : '—'}</span>
            <span className="text-charcoal-muted">Clarity: {(metrics.clarity * 100).toFixed(0)}%</span>
          </div>

          <p className="text-center text-xs text-charcoal-muted">In-tune zone: within {IN_TUNE_THRESHOLD_CENTS} cents</p>

          <button onClick={handleStopAndSave} className="btn-terracotta w-full max-w-xs" disabled={isSubmitting}>
            <Save className="h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Stop & Save'}
          </button>
          {scoreResult && (
            <div className={`text-sm text-center ${scoreResult.success ? 'text-sage-deep' : 'text-terracotta-deep'}`}>
              {scoreResult.success
                ? `Saved! +${scoreResult.xpEarned} XP, ${scoreResult.accuracy}% accuracy`
                : scoreResult.error ?? 'Failed to save score'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
