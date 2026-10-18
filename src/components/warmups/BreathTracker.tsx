/**
 * Breath tracker — "Straw Phonation / Hiss Test" (SOVT)
 * Warm notebook styling: vertical pressure column with fluid fill.
 *
 * CALIBRATION:
 * - Before the exercise, measures ambient noise floor for 3 seconds.
 * - The target zone is set relative to the user's own calibrated signal level,
 *   not an absolute threshold that depends on microphone gain.
 * - A "calibrate" step asks the user to sustain their normal hiss so the
 *   system can learn their comfortable level.
 *
 * HYSTERESIS:
 * - Brief dips (under 0.5s) outside the zone do not reset the sustained timer.
 * - Only sustained drops (> 0.5s) reset the timer.
 *
 * SECURITY: Uses the shared useAudioInput hook. No raw audio stored.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Wind, Square, Save, Gauge } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';
import { submitAttempt } from '@/lib/progressService';

const COL_HEIGHT = 280;

// Calibration phases
type CalPhase = 'idle' | 'noise-floor' | 'signal' | 'ready';
const NOISE_FLOOR_DURATION_MS = 3000;
const SIGNAL_DURATION_MS = 3000;

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
  const [calPhase, setCalPhase] = useState<CalPhase>('idle');
  const [calProgress, setCalProgress] = useState(0);
  const [calMessage, setCalMessage] = useState('');

  const sustainedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const smoothRef = useRef(0);
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;
  const startTimeRef = useRef<number | null>(null);
  const bestSustainRef = useRef(0);
  const outOfZoneStartRef = useRef<number | null>(null);
  const hysteresisMs = 500;

  // Calibration refs
  const noiseFloorRef = useRef(0);
  const noiseSamplesRef = useRef<number[]>([]);
  const signalSamplesRef = useRef<number[]>([]);
  const calStartRef = useRef<number | null>(null);
  const calibratedMinRef = useRef(0);
  const calibratedMaxRef = useRef(0);
  const calibratedCenterRef = useRef(0);

  // Smoothing loop
  useEffect(() => {
    if (!isActive) { startTimeRef.current = null; return; }
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      smoothRef.current = smoothRef.current * 0.7 + metricsRef.current.rawRms * 0.3;
      setSmoothedVolume(smoothRef.current);
    }, 50);
    return () => clearInterval(interval);
  }, [isActive]);

  // Calibration loop
  useEffect(() => {
    if (!isActive || calPhase === 'idle' || calPhase === 'ready') return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (calStartRef.current === null) calStartRef.current = now;
      const elapsed = now - calStartRef.current;

      if (calPhase === 'noise-floor') {
        noiseSamplesRef.current.push(metricsRef.current.rawRms);
        setCalProgress(Math.min(1, elapsed / NOISE_FLOOR_DURATION_MS));
        if (elapsed >= NOISE_FLOOR_DURATION_MS) {
          const avg = noiseSamplesRef.current.reduce((a, b) => a + b, 0) / noiseSamplesRef.current.length;
          noiseFloorRef.current = avg;
          setCalPhase('signal');
          calStartRef.current = null;
          setCalMessage('Now sustain a comfortable "sss" hiss for 3 seconds.');
        }
      } else if (calPhase === 'signal') {
        if (metricsRef.current.rawRms > noiseFloorRef.current * 2) {
          signalSamplesRef.current.push(metricsRef.current.rawRms);
        }
        setCalProgress(Math.min(1, elapsed / SIGNAL_DURATION_MS));
        if (elapsed >= SIGNAL_DURATION_MS) {
          if (signalSamplesRef.current.length < 10) {
            setCalMessage('Could not detect a clear signal. Please try again in a quieter environment.');
            setCalPhase('idle');
            calStartRef.current = null;
            return;
          }
          const avgSignal = signalSamplesRef.current.reduce((a, b) => a + b, 0) / signalSamplesRef.current.length;
          const range = avgSignal - noiseFloorRef.current;
          calibratedCenterRef.current = noiseFloorRef.current + range * 0.5;
          calibratedMinRef.current = noiseFloorRef.current + range * 0.25;
          calibratedMaxRef.current = noiseFloorRef.current + range * 0.85;
          setCalPhase('ready');
          setCalMessage('Calibration complete! Sustain your hiss and keep the fluid in the target zone.');
          calStartRef.current = null;
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, calPhase]);

  // Sustained timer loop with hysteresis
  useEffect(() => {
    if (!isActive || calPhase !== 'ready') { lastTickRef.current = null; return; }
    const interval = setInterval(() => {
      const now = Date.now();
      if (lastTickRef.current === null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const vol = smoothRef.current;
      const inZone = vol >= calibratedMinRef.current && vol <= calibratedMaxRef.current;

      if (inZone) {
        outOfZoneStartRef.current = null;
        sustainedRef.current += delta;
        const rounded = Math.floor(sustainedRef.current);
        setSustainedSeconds(rounded);
        if (rounded > bestSustainRef.current) {
          bestSustainRef.current = rounded;
          setBestSustain(rounded);
        }
      } else {
        if (outOfZoneStartRef.current === null) {
          outOfZoneStartRef.current = now;
        }
        const outDuration = now - outOfZoneStartRef.current;
        if (outDuration > hysteresisMs) {
          sustainedRef.current = 0;
          setSustainedSeconds(0);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, calPhase]);

  const startCalibration = useCallback(() => {
    noiseSamplesRef.current = [];
    signalSamplesRef.current = [];
    calStartRef.current = null;
    setCalPhase('noise-floor');
    setCalProgress(0);
    setCalMessage('Stay quiet for 3 seconds so we can measure background noise.');
  }, []);

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

  const handleStop = () => {
    stop();
    setCalPhase('idle');
    setCalProgress(0);
    setCalMessage('');
    setSustainedSeconds(0);
    setBestSustain(0);
    sustainedRef.current = 0;
    bestSustainRef.current = 0;
  };

  // Map smoothed RMS to display percentage using calibrated range
  const displayPercent = calPhase === 'ready' && calibratedMaxRef.current > 0
    ? Math.min(100, Math.max(0, ((smoothRef.current - noiseFloorRef.current) / (calibratedMaxRef.current - noiseFloorRef.current)) * 100))
    : Math.min(100, smoothedVolume * 100 * 5); // fallback scaling
  const levelPx = (displayPercent / 100) * COL_HEIGHT;
  const inTargetZone = calPhase === 'ready' &&
    smoothRef.current >= calibratedMinRef.current &&
    smoothRef.current <= calibratedMaxRef.current;

  const targetMinPct = calPhase === 'ready' && calibratedMaxRef.current > 0
    ? ((calibratedMinRef.current - noiseFloorRef.current) / (calibratedMaxRef.current - noiseFloorRef.current)) * 100
    : 25;
  const targetMaxPct = calPhase === 'ready' && calibratedMaxRef.current > 0
    ? 100
    : 75;

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Wind className="h-5 w-5 text-sage-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Breath Tracker</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Sustain a steady hiss or straw phonation. After calibrating, keep the fluid level in the target zone.
        This measures sound consistency, not lung capacity.
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && calPhase === 'idle' && (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-sm text-charcoal-light text-center">
            <p className="mb-3">Before starting, let's calibrate to your microphone and voice level.</p>
            <button onClick={startCalibration} className="btn-primary w-full">
              <Gauge className="h-4 w-4" /> Start Calibration
            </button>
          </div>
          {isActive && (
            <button onClick={handleStop} className="btn-terracotta w-full">
              <Square className="h-4 w-4" /> Stop
            </button>
          )}
        </div>
      )}

      {permission === 'granted' && (calPhase === 'noise-floor' || calPhase === 'signal') && (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="w-full rounded-xl bg-cream-200 border border-cream-400 p-4">
            <p className="text-sm text-charcoal-light text-center mb-3">{calMessage}</p>
            <div className="h-2 rounded-full bg-cream-300 overflow-hidden">
              <div className="h-full bg-sage-DEFAULT transition-all duration-100" style={{ width: `${calProgress * 100}%` }} />
            </div>
            <p className="text-xs text-charcoal-muted text-center mt-2">{Math.round(calProgress * 100)}%</p>
          </div>
        </div>
      )}

      {permission === 'granted' && calPhase === 'ready' && (
        <div className="flex items-stretch gap-6">
          {/* Vertical pressure column */}
          <div className="relative w-20 overflow-hidden rounded-2xl bg-cream-200 border border-cream-400 shadow-paper-sm" style={{ height: COL_HEIGHT }}>
            {/* Target zone band */}
            <div
              className="absolute left-0 right-0 border-y border-dashed border-sage-DEFAULT bg-sage-light/50"
              style={{ bottom: (targetMinPct / 100) * COL_HEIGHT, height: ((targetMaxPct - targetMinPct) / 100) * COL_HEIGHT }}
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
                {inTargetZone ? 'In zone' : `${displayPercent.toFixed(0)}%`}
              </span>
              <div className="text-xs text-charcoal-muted">level</div>
            </div>
          </div>
        </div>
      )}

      {permission === 'granted' && calPhase === 'ready' && (
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <button onClick={handleStopAndSave} className="btn-terracotta w-full" disabled={isSubmitting}>
            <Save className="h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Stop & Save'}
          </button>
          <button onClick={startCalibration} className="btn-secondary w-full text-sm">
            <Gauge className="h-4 w-4" /> Recalibrate
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

      {permission === 'granted' && !isActive && calPhase === 'idle' && (
        <button onClick={start} className="btn-primary w-full max-w-xs">
          <Wind className="h-4 w-4" /> Start
        </button>
      )}
    </div>
  );
}
