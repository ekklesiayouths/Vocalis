/**
 * Breath Support Tracker — Vocal Mechanics (Beginner)
 *
 * A mic-based sustained phonation test ("Hiss Test"). Tracks audible sound
 * amplitude over time — a floating musical note stays in a sage "target zone"
 * when the hiss volume remains consistent.
 *
 * WHAT THIS MEASURES (honestly):
 * - Sustained audible sound duration and relative volume consistency.
 * - It does NOT measure airflow, lung capacity, diaphragm engagement, or
 *   respiratory health. A microphone only hears sound, not breath.
 *
 * CALIBRATION:
 * 1. Noise floor: 3s of silence to measure background noise.
 * 2. Signal: 3s of comfortable "sss" hiss to establish the user's level.
 * The target zone is relative to the user's own calibrated signal.
 *
 * DIFFICULTY TARGETS:
 * - Beginner: 8s, Intermediate: 15s, Advanced: 25s.
 * - No minimum duration is required to "pass" — progress is personal.
 *
 * SIGNAL QUALITY:
 * - Classifies the live signal as silence, inadequate, in-zone, excessive, or
 *   clipping, and shows actionable feedback for each state.
 *
 * HYSTERESIS:
 * - Brief dips (under 500ms) outside the zone do not reset the sustained timer.
 *
 * RESOURCE CLEANUP:
 * - All intervals, refs, and audio resources are cleaned up on stop/unmount.
 *
 * SECURITY: Uses useAudioInput (native, no raw audio stored). No score.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Wind, Square, Gauge, Trophy, Activity } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import {
  NOISE_FLOOR_DURATION_MS, SIGNAL_DURATION_MS, HYSTERESIS_MS,
  average, isSignalSample, calibrationSucceeded, computeCalibration,
  isInZone, zonePercent, classifySignal, stabilityScore,
  DURATION_TARGETS, targetForLevel,
  type CalibrationResult, type SignalQuality, type DurationTarget,
} from '@/lib/breathCalibration';

const TUBE_HEIGHT = 300;

type CalPhase = 'idle' | 'noise-floor' | 'signal' | 'ready';
type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export function BreathSupportTracker() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 50,
    maxFrequency: 300,
  });

  const [smoothedVol, setSmoothedVol] = useState(0);
  const [sustainedSec, setSustainedSec] = useState(0);
  const [bestSustained, setBestSustained] = useState(0);
  const [calPhase, setCalPhase] = useState<CalPhase>('idle');
  const [calProgress, setCalProgress] = useState(0);
  const [calMessage, setCalMessage] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Beginner');
  const [signalQuality, setSignalQuality] = useState<SignalQuality>('silence');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [achievedTarget, setAchievedTarget] = useState(false);

  const smoothRef = useRef(0);
  const sustainedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const outOfZoneStartRef = useRef<number | null>(null);
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;

  // Calibration refs
  const noiseFloorRef = useRef(0);
  const noiseSamplesRef = useRef<number[]>([]);
  const signalSamplesRef = useRef<number[]>([]);
  const calStartRef = useRef<number | null>(null);
  const calibrationRef = useRef<CalibrationResult | null>(null);

  // Track which targets have been achieved this session
  const bestThisSessionRef = useRef(0);

  // Smoothing loop — stable sampling at 50ms, independent of metrics changes
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
            setCalMessage('Could not detect a clear, consistent hiss. Make sure your microphone is nearby and try again.');
            setCalPhase('idle');
            calStartRef.current = null;
            return;
          }
          const cal = computeCalibration(signalSamplesRef.current, noiseFloorRef.current);
          calibrationRef.current = cal;
          setCalPhase('ready');
          setCalMessage('');
          calStartRef.current = null;
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, calPhase]);

  // Sustained timer with hysteresis — 100ms tick for accurate elapsed timing
  useEffect(() => {
    if (!isActive || calPhase !== 'ready') { lastTickRef.current = null; return; }
    const interval = setInterval(() => {
      const now = Date.now();
      if (lastTickRef.current === null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const vol = smoothRef.current;
      const cal = calibrationRef.current;
      if (!cal) return;

      const inZone = isInZone(vol, cal);
      const classification = classifySignal(metricsRef.current.rawRms, cal, cal.avgSignal);
      setSignalQuality(classification.quality);

      if (inZone) {
        outOfZoneStartRef.current = null;
        sustainedRef.current += delta;
        const rounded = Math.floor(sustainedRef.current);
        setSustainedSec(rounded);
        setBestSustained((prev) => rounded > prev ? rounded : prev);
        bestThisSessionRef.current = Math.max(bestThisSessionRef.current, rounded);
        setFeedbackMsg('');
        // Check if current target achieved
        const target = targetForLevel(difficulty);
        if (rounded >= target.seconds && !achievedTarget) {
          setAchievedTarget(true);
        }
      } else {
        if (outOfZoneStartRef.current === null) {
          outOfZoneStartRef.current = now;
        }
        const outDuration = now - outOfZoneStartRef.current;
        if (outDuration > HYSTERESIS_MS) {
          // Show actionable feedback based on signal quality
          if (classification.message) {
            setFeedbackMsg(classification.message);
          }
          sustainedRef.current = 0;
          setSustainedSec(0);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, calPhase, difficulty, achievedTarget]);

  const startCalibration = useCallback(() => {
    noiseSamplesRef.current = [];
    signalSamplesRef.current = [];
    calStartRef.current = null;
    calibrationRef.current = null;
    sustainedRef.current = 0;
    bestThisSessionRef.current = 0;
    setSustainedSec(0);
    setBestSustained(0);
    setAchievedTarget(false);
    setFeedbackMsg('');
    setSignalQuality('silence');
    setCalPhase('noise-floor');
    setCalProgress(0);
    setCalMessage('Stay quiet for 3 seconds so we can measure background noise.');
  }, []);

  const handleStop = useCallback(() => {
    stop();
    setCalPhase('idle');
    setCalProgress(0);
    setCalMessage('');
    setSustainedSec(0);
    setBestSustained(0);
    setAchievedTarget(false);
    setFeedbackMsg('');
    setSignalQuality('silence');
    sustainedRef.current = 0;
    bestThisSessionRef.current = 0;
    smoothRef.current = 0;
    setSmoothedVol(0);
    calibrationRef.current = null;
    noiseSamplesRef.current = [];
    signalSamplesRef.current = [];
  }, [stop]);

  const handleDifficultyChange = useCallback((level: DifficultyLevel) => {
    setDifficulty(level);
    setAchievedTarget(bestThisSessionRef.current >= targetForLevel(level).seconds);
  }, []);

  const cal = calibrationRef.current;
  const activeZone: CalibrationResult | null = cal;
  const displayPercent = calPhase === 'ready' && cal
    ? zonePercent(smoothRef.current, cal)
    : Math.min(100, smoothedVol * 100 * 5);
  const noteY = TUBE_HEIGHT - (displayPercent / 100) * TUBE_HEIGHT;
  const inZone = calPhase === 'ready' && cal ? isInZone(smoothRef.current, cal) : false;

  const targetMinPct = calPhase === 'ready' && cal
    ? zonePercent(cal.zoneMin, cal)
    : 25;
  const targetMaxPct = calPhase === 'ready' && cal
    ? 100
    : 75;

  const currentTarget = targetForLevel(difficulty);

  // Live signal indicator color based on quality
  const signalIndicatorColor: Record<SignalQuality, string> = {
    silence: 'bg-cream-400',
    inadequate: 'bg-terracotta-DEFAULT',
    'in-zone': 'bg-sage-DEFAULT',
    excessive: 'bg-mustard-DEFAULT',
    clipping: 'bg-red-500',
  };

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Wind className="h-5 w-5 text-terracotta-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Breath Support Tracker</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Sustain a steady "Sssss" exhale. After calibrating, keep the floating note in the sage zone.
        This measures how steadily you can sustain an audible sound — not lung capacity or breath health.
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && calPhase === 'idle' && (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-sm text-charcoal-light text-center">
            <p className="mb-3">Let's calibrate to your microphone and comfortable voice level first. This takes about 6 seconds.</p>
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
            {/* Live signal indicator during calibration */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-xs text-charcoal-muted">Live signal:</span>
              <div className={`h-2.5 w-2.5 rounded-full transition-colors ${signalIndicatorColor[signalQuality]}`} />
              <span className="text-xs text-charcoal-muted">
                {signalQuality === 'silence' ? 'quiet' : signalQuality === 'in-zone' ? 'good' : 'active'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-cream-300 overflow-hidden">
              <div className="h-full bg-sage-DEFAULT transition-all duration-100" style={{ width: `${calProgress * 100}%` }} />
            </div>
            <p className="text-xs text-charcoal-muted text-center mt-2">{Math.round(calProgress * 100)}%</p>
          </div>
        </div>
      )}

      {permission === 'granted' && calPhase === 'ready' && (
        <>
          {/* Difficulty selector */}
          <div className="flex items-center gap-2">
            {DURATION_TARGETS.map((t) => (
              <button
                key={t.label}
                onClick={() => handleDifficultyChange(t.label as DifficultyLevel)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  difficulty === t.label
                    ? 'bg-sage-DEFAULT text-cream-50 shadow-paper-sm'
                    : 'bg-cream-200 text-charcoal-muted border border-cream-400 hover:bg-sage-light'
                }`}
              >
                {t.label} · {t.seconds}s
              </button>
            ))}
          </div>

          <div className="flex items-stretch gap-6">
            {/* Vertical paper tube */}
            <div className="relative w-24 overflow-hidden rounded-3xl bg-cream-200 border-2 border-cream-400 shadow-paper-sm" style={{ height: TUBE_HEIGHT }}>
              {/* Optimal pressure zone */}
              <div
                className="absolute left-0 right-0 border-y-2 border-dashed border-sage-DEFAULT bg-sage-light/40"
                style={{ bottom: (targetMinPct / 100) * TUBE_HEIGHT, height: ((targetMaxPct - targetMinPct) / 100) * TUBE_HEIGHT }}
              >
                <span className="absolute right-1 top-1 text-[9px] text-sage-deep/60 font-medium">target</span>
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

          {/* Live signal quality indicator */}
          <div className="flex items-center gap-2 text-xs">
            <Activity className="h-3.5 w-3.5 text-charcoal-muted" />
            <div className={`h-2 w-2 rounded-full ${signalIndicatorColor[signalQuality]}`} />
            <span className="text-charcoal-muted">
              {signalQuality === 'silence' && 'No sound detected'}
              {signalQuality === 'inadequate' && 'Sound is too quiet'}
              {signalQuality === 'in-zone' && 'Consistent level'}
              {signalQuality === 'excessive' && 'Much louder than calibrated'}
              {signalQuality === 'clipping' && 'Mic overloaded — too loud'}
            </span>
          </div>

          {/* Target achievement */}
          {achievedTarget && (
            <div className="rounded-xl bg-sage-light border border-sage-DEFAULT px-4 py-3 text-sm text-sage-deep text-center max-w-sm animate-fade-in flex items-center justify-center gap-2">
              <Trophy className="h-4 w-4" />
              {difficulty} target reached — {currentTarget.seconds}s of steady sound!
            </div>
          )}

          {/* Actionable feedback — no anatomical claims */}
          {feedbackMsg && !achievedTarget && (
            <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep text-center max-w-sm animate-fade-in">
              {feedbackMsg}
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
