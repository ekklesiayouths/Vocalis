/**
 * Breath tracker — "Straw Phonation / Hiss Test" (SOVT)
 * Warm notebook styling: vertical pressure column with fluid fill.
 *
 * SECURITY: Uses the shared useAudioInput hook. No raw audio stored.
 */

import { useEffect, useRef, useState } from 'react';
import { Wind, Square, Save } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';
import { submitAttempt } from '@/lib/progressService';

const COL_HEIGHT = 280;
const TARGET_MIN = 40;
const TARGET_MAX = 75;

export function BreathTracker() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 50,
    maxFrequency: 400,
  });

  const [sustainedSeconds, setSustainedSeconds] = useState(0);
  const [bestSustain, setBestSustain] = useState(0);
  const [smoothedVolume, setSmoothedVolume] = useState(0);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sustainedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const smoothRef = useRef(0);
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;
  const startTimeRef = useRef<number | null>(null);
  const bestSustainRef = useRef(0);

  useEffect(() => {
    if (!isActive) { startTimeRef.current = null; return; }
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      smoothRef.current = smoothRef.current * 0.7 + metricsRef.current.volume * 0.3;
      setSmoothedVolume(smoothRef.current);
    }, 50);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) { lastTickRef.current = null; return; }
    const interval = setInterval(() => {
      const now = Date.now();
      if (lastTickRef.current === null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (metricsRef.current.volume > 0.15) {
        sustainedRef.current += delta;
        const rounded = Math.floor(sustainedRef.current);
        setSustainedSeconds(rounded);
        if (rounded > bestSustainRef.current) {
          bestSustainRef.current = rounded;
          setBestSustain(rounded);
        }
      } else {
        sustainedRef.current = 0;
        setSustainedSeconds(0);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive]);

  const handleStopAndSave = async () => {
    const elapsed = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    stop();
    if (bestSustainRef.current > 0 && elapsed > 0) {
      setIsSubmitting(true);
      const accuracy = Math.min(100, Math.round((bestSustainRef.current / 20) * 100));
      const result = await submitScore('Breath Tracker', accuracy, elapsed);
      if (result.success) {
        await submitAttempt('Breath Tracker', accuracy, elapsed, result.xpEarned ?? 0, undefined, { bestSustain: bestSustainRef.current });
      }
      setScoreResult(result);
      setIsSubmitting(false);
    }
  };

  const levelPercent = Math.min(100, smoothedVolume * 100);
  const levelPx = (levelPercent / 100) * COL_HEIGHT;
  const inTargetZone = levelPercent >= TARGET_MIN && levelPercent <= TARGET_MAX;

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Wind className="h-5 w-5 text-sage-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Breath Tracker</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Sustain a steady hiss or straw phonation. Keep the fluid level in the target zone.
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <div className="flex items-stretch gap-6">
          {/* Vertical pressure column */}
          <div className="relative w-20 overflow-hidden rounded-2xl bg-cream-200 border border-cream-400 shadow-paper-sm" style={{ height: COL_HEIGHT }}>
            {/* Target zone band */}
            <div
              className="absolute left-0 right-0 border-y border-dashed border-sage-DEFAULT bg-sage-light/50"
              style={{ bottom: (TARGET_MIN / 100) * COL_HEIGHT, height: ((TARGET_MAX - TARGET_MIN) / 100) * COL_HEIGHT }}
            >
              <span className="absolute right-1 top-1 text-[9px] text-sage-deep/60">target</span>
            </div>

            {/* Fluid fill */}
            <div
              className="absolute bottom-0 left-0 right-0 transition-all duration-100 ease-out"
              style={{
                height: levelPx,
                background: inTargetZone
                  ? 'linear-gradient(to top, rgba(123,168,114,0.5), rgba(168,201,160,0.3))'
                  : 'linear-gradient(to top, rgba(228,165,152,0.4), rgba(228,165,152,0.2))',
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: inTargetZone ? '#7BA872' : '#E4A598', opacity: 0.8 }} />
            </div>

            {/* Tick marks */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <div key={pct} className="absolute left-0 h-px w-2 bg-charcoal/10" style={{ bottom: (pct / 100) * COL_HEIGHT }} />
            ))}
          </div>

          {/* Stats */}
          <div className="flex flex-col justify-center gap-5">
            <div className="text-center">
              <span className={`text-4xl font-bold ${inTargetZone ? 'text-sage-deep' : 'text-charcoal'}`}>
                {sustainedSeconds}s
              </span>
              <div className="text-xs text-charcoal-muted">sustained</div>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-charcoal">{bestSustain}s</span>
              <div className="text-xs text-charcoal-muted">best</div>
            </div>
            <div className="text-center">
              <span className={`text-lg font-bold ${inTargetZone ? 'text-sage-deep' : 'text-charcoal-muted'}`}>
                {inTargetZone ? 'In zone' : `${levelPercent.toFixed(0)}%`}
              </span>
              <div className="text-xs text-charcoal-muted">pressure</div>
            </div>
          </div>
        </div>
      )}

      {permission === 'granted' && (
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <button onClick={handleStopAndSave} className="btn-terracotta w-full" disabled={isSubmitting}>
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

      {permission === 'granted' && !isActive && (
        <button onClick={start} className="btn-primary w-full max-w-xs">
          <Wind className="h-4 w-4" /> Resume
        </button>
      )}
    </div>
  );
}
