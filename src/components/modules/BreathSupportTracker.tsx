/**
 * Breath Support Tracker — Vocal Mechanics (Beginner)
 *
 * Mic-based sustained phonation test ("Hiss Test"). Tracks amplitude
 * over time. A floating musical note stays in a sage "optimal pressure zone"
 * only if airflow volume remains stable.
 *
 * CALIBRATION:
 * - Measures noise floor and the user's comfortable signal level before starting.
 * - Target zone is relative to the user's calibrated level, not an absolute threshold.
 *
 * HYSTERESIS:
 * - Brief dips (under 0.5s) outside the zone do not reset the sustained timer.
 *
 * SECURITY: Uses useAudioInput (native, no raw audio stored). No score.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Wind, Square, Gauge } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';

const TUBE_HEIGHT = 300;

type CalPhase = 'idle' | 'noise-floor' | 'signal' | 'ready';

import {
  NOISE_FLOOR_DURATION_MS, SIGNAL_DURATION_MS, HYSTERESIS_MS,
  average, isSignalSample, calibrationSucceeded, computeCalibration,
  isInZone, zonePercent, type CalibrationResult,
} from '@/lib/breathCalibration';

export function BreathSupportTracker() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 50,
    maxFrequency: 300,
  });

  const [smoothedVol, setSmoothedVol] = useState(0);
  const [sustainedSec, setSustainedSec] = useState(0);
  const [bestSustained, setBestSustained] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [calPhase, setCalPhase] = useState<CalPhase>('idle');
  const [calProgress, setCalProgress] = useState(0);
  const [calMessage, setCalMessage] = useState('');

  const smoothRef = useRef(0);
  const sustainedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const dropDetectedRef = useRef(false);
  const outOfZoneStartRef = useRef<number | null>(null);
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;

  // Calibration refs
  const noiseFloorRef = useRef(0);
  const noiseSamplesRef = useRef<number[]>([]);
  const signalSamplesRef = useRef<number[]>([]);
  const calStartRef = useRef<number | null>(null);
  const calibratedMinRef = useRef(0);
  const calibratedMaxRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      smoothRef.current = smoothRef.current * 0.75 + metricsRef.current.rawRms * 0.25;
      setSmoothedVol(smoothRef.current);
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
          noiseFloorRef.current = average(noiseSamplesRef.current);
          setCalPhase('signal');
          calStartRef.current = null;
          setCalMessage('Now sustain a comfortable "sss" hiss for 3 seconds.');
        }
      } else if (calPhase === 'signal') {
        if (isSignalSample(metricsRef.current.rawRms, noiseFloorRef.current)) {
          signalSamplesRef.current.push(metricsRef.current.rawRms);
        }
        setCalProgress(Math.min(1, elapsed / SIGNAL_DURATION_MS));
        if (elapsed >= SIGNAL_DURATION_MS) {
          if (!calibrationSucceeded(signalSamplesRef.current)) {
            setCalMessage('Could not detect a clear signal. Please try again.');
            setCalPhase('idle');
            calStartRef.current = null;
            return;
          }
          const cal = computeCalibration(signalSamplesRef.current, noiseFloorRef.current);
          calibratedMinRef.current = cal.zoneMin;
          calibratedMaxRef.current = cal.zoneMax;
          setCalPhase('ready');
          setCalMessage('Calibrated! Sustain your hiss and keep the note in the sage zone.');
          calStartRef.current = null;
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, calPhase]);

  // Sustained timer with hysteresis
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
        setSustainedSec(rounded);
        setBestSustained((prev) => rounded > prev ? rounded : prev);
        dropDetectedRef.current = false;
        setShowTip(false);
      } else {
        if (outOfZoneStartRef.current === null) {
          outOfZoneStartRef.current = now;
        }
        const outDuration = now - outOfZoneStartRef.current;
        if (outDuration > HYSTERESIS_MS) {
          if (sustainedRef.current > 1 && !dropDetectedRef.current) {
            dropDetectedRef.current = true;
            setShowTip(true);
          }
          sustainedRef.current = 0;
          setSustainedSec(0);
        }
      }
    }, 1000);
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

  const activeZone: CalibrationResult = {
    noiseFloor: noiseFloorRef.current,
    zoneMin: calibratedMinRef.current,
    zoneMax: calibratedMaxRef.current,
  };
  const displayPercent = calPhase === 'ready' && calibratedMaxRef.current > 0
    ? zonePercent(smoothRef.current, activeZone)
    : Math.min(100, smoothedVol * 100 * 5);
  const noteY = TUBE_HEIGHT - (displayPercent / 100) * TUBE_HEIGHT;
  const inZone = calPhase === 'ready' && isInZone(smoothRef.current, activeZone);

  const targetMinPct = calPhase === 'ready' && calibratedMaxRef.current > 0
    ? zonePercent(calibratedMinRef.current, activeZone)
    : 25;
  const targetMaxPct = calPhase === 'ready' && calibratedMaxRef.current > 0
    ? 100
    : 75;

  const handleStop = () => {
    stop();
    setShowTip(false);
    setCalPhase('idle');
    setCalProgress(0);
    setCalMessage('');
    setSustainedSec(0);
    setBestSustained(0);
    sustainedRef.current = 0;
  };

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Wind className="h-5 w-5 text-terracotta-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Breath Support Tracker</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Sustain a steady "Sssss" exhale. After calibrating, keep the floating note in the sage zone.
        This measures sound consistency, not lung capacity.
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && calPhase === 'idle' && (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-sm text-charcoal-light text-center">
            <p className="mb-3">Let's calibrate to your microphone and comfortable voice level first.</p>
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
        <>
          <div className="flex items-stretch gap-6">
            {/* Vertical paper tube */}
            <div className="relative w-24 overflow-hidden rounded-3xl bg-cream-200 border-2 border-cream-400 shadow-paper-sm" style={{ height: TUBE_HEIGHT }}>
              {/* Optimal pressure zone */}
              <div
                className="absolute left-0 right-0 border-y-2 border-dashed border-sage-DEFAULT bg-sage-light/40"
                style={{ bottom: (targetMinPct / 100) * TUBE_HEIGHT, height: ((targetMaxPct - targetMinPct) / 100) * TUBE_HEIGHT }}
              >
                <span className="absolute right-1 top-1 text-[9px] text-sage-deep/60 font-medium">optimal</span>
              </div>

              {/* Fluid fill */}
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-100 ease-out"
                style={{
                  height: (displayPercent / 100) * TUBE_HEIGHT,
                  background: inZone
                    ? 'linear-gradient(to top, rgba(123,168,114,0.4), rgba(168,201,160,0.2))'
                    : 'linear-gradient(to top, rgba(228,165,152,0.3), rgba(228,165,152,0.15))',
                }}
              />

              {/* Floating musical note */}
              <div
                className="absolute left-1/2 -translate-x-1/2 transition-all duration-100"
                style={{ bottom: Math.max(8, noteY - 16) }}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${inZone ? 'bg-sage-light border-sage-DEFAULT shadow-paper-sage' : 'bg-cream-50 border-cream-400'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={inZone ? '#5E8A56' : '#8A8780'}>
                    <circle cx="6" cy="18" r="4" /><rect x="9" y="3" width="2" height="15" /><path d="M11 3 Q18 5 18 10 Q11 8 11 10" fill="none" stroke={inZone ? '#5E8A56' : '#8A8780'} strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col justify-center gap-5">
              <div className="text-center">
                <span className={`text-4xl font-bold ${inZone ? 'text-sage-deep' : 'text-charcoal'}`}>{sustainedSec}s</span>
                <div className="text-xs text-charcoal-muted">in zone</div>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-charcoal">{bestSustained}s</span>
                <div className="text-xs text-charcoal-muted">best</div>
              </div>
              <div className="text-center">
                <span className={`text-lg font-bold ${inZone ? 'text-sage-deep' : 'text-charcoal-muted'}`}>
                  {inZone ? 'Steady!' : `${displayPercent.toFixed(0)}%`}
                </span>
                <div className="text-xs text-charcoal-muted">level</div>
              </div>
            </div>
          </div>

          {/* Friendly tip on instability */}
          {showTip && (
            <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep text-center max-w-sm animate-fade-in">
              Your airflow dropped! Try engaging your diaphragm more — imagine breathing out through a tiny straw slowly and steadily.
            </div>
          )}

          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button onClick={handleStop} className="btn-terracotta w-full">
              <Square className="h-4 w-4" /> Stop
            </button>
            <button onClick={startCalibration} className="btn-secondary text-sm w-full">
              <Gauge className="h-4 w-4" /> Recalibrate
            </button>
          </div>
        </>
      )}
    </div>
  );
}
