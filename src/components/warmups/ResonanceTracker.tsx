/**
 * Resonance tracker — "Lip Trill Waveguide"
 * Warm notebook styling: horizontal SVG sine-wave with live pitch cursor.
 *
 * SECURITY: Uses the shared useAudioInput hook. No raw audio stored.
 */

import { useEffect, useRef, useState } from 'react';
import { Waves, Save } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';
import { submitAttempt } from '@/lib/progressService';

const SVG_WIDTH = 500;
const SVG_HEIGHT = 200;
const CENTER_Y = SVG_HEIGHT / 2;
const MIN_HZ = 80;
const MAX_HZ = 600;

function freqToY(hz: number): number {
  const logMin = Math.log2(MIN_HZ);
  const logMax = Math.log2(MAX_HZ);
  const logHz = Math.log2(Math.max(MIN_HZ, Math.min(MAX_HZ, hz)));
  const ratio = (logHz - logMin) / (logMax - logMin);
  return SVG_HEIGHT * (1 - ratio);
}

export function ResonanceTracker() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 80,
    maxFrequency: 600,
  });

  const [time, setTime] = useState(0);
  const [guideHz, setGuideHz] = useState(220);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeRef = useRef(0);
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;
  const startTimeRef = useRef<number | null>(null);
  const matchFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const guideHzRef = useRef(220);

  useEffect(() => {
    if (!isActive) { startTimeRef.current = null; return; }
    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    let raf: number;
    const animate = () => {
      timeRef.current += 0.03;
      setTime(timeRef.current);
      const guideLogHz = Math.log2(180) + Math.sin(timeRef.current * 0.3) * 0.5;
      const newGuideHz = Math.pow(2, guideLogHz);
      setGuideHz(newGuideHz);
      guideHzRef.current = newGuideHz;

      const m = metricsRef.current;
      if (m.frequency && m.clarity > 0.3) {
        totalFramesRef.current++;
        const userYv = freqToY(m.frequency);
        const gY = freqToY(guideHzRef.current);
        if (Math.abs(userYv - gY) < 30) matchFramesRef.current++;
      }

      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isActive]);

  const handleStopAndSave = async () => {
    const elapsedSec = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    stop();
    if (elapsedSec > 0 && totalFramesRef.current > 0) {
      setIsSubmitting(true);
      const accuracy = Math.min(100, Math.round((matchFramesRef.current / totalFramesRef.current) * 100));
      const result = await submitScore('Resonance Tracker', accuracy, elapsedSec);
      if (result.success) {
        const ratio = totalFramesRef.current > 0 ? matchFramesRef.current / totalFramesRef.current : 0;
        await submitAttempt('Resonance Tracker', accuracy, elapsedSec, result.xpEarned ?? 0, ratio);
      }
      setScoreResult(result);
      setIsSubmitting(false);
    }
  };

  const guideY = freqToY(guideHz);
  const generateGuidePath = (): string => {
    const points: string[] = [];
    for (let x = 0; x <= SVG_WIDTH; x += 5) {
      const wave = Math.sin((x / SVG_WIDTH) * Math.PI * 3 + time * 1.5) * 25;
      points.push(`${x},${guideY + wave}`);
    }
    return `M ${points.join(' L ')}`;
  };

  const userY = metrics.frequency && metrics.clarity > 0.3 ? freqToY(metrics.frequency) : null;
  const ambientAmp = 15 + metrics.volume * 30;
  const generateAmbientPath = (offset: number, amp: number): string => {
    const points: string[] = [];
    for (let x = 0; x <= SVG_WIDTH; x += 5) {
      const y = CENTER_Y + Math.sin((x / SVG_WIDTH) * Math.PI * 4 + time * 2 + offset) * amp;
      points.push(`${x},${y}`);
    }
    return `M ${points.join(' L ')}`;
  };

  const matchDistance = userY !== null ? Math.abs(userY - guideY) : null;
  const isOnCurve = matchDistance !== null && matchDistance < 30;

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Waves className="h-5 w-5 text-terracotta-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Lip Trill Waveguide</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Hum or lip trill and follow the glowing wave contour with your pitch cursor.
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-cream-50 border border-cream-400 shadow-paper-sm p-3">
            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="guideGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7BA872" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#7BA872" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#7BA872" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Ambient background waves */}
              <path d={generateAmbientPath(0, ambientAmp)} fill="none" stroke="#E4A598" strokeWidth="1.5" strokeOpacity="0.15" />
              <path d={generateAmbientPath(Math.PI / 2, ambientAmp * 0.7)} fill="none" stroke="#E4A598" strokeWidth="1" strokeOpacity="0.1" />

              {/* Guide wave */}
              <path d={generateGuidePath()} fill="none" stroke="url(#guideGradient)" strokeWidth="3" strokeLinecap="round" />

              {/* User pitch cursor */}
              {userY !== null && (
                <>
                  <circle cx={SVG_WIDTH * 0.5} cy={userY} r="8" fill={isOnCurve ? '#7BA872' : '#E4A598'} opacity="0.3" />
                  <circle cx={SVG_WIDTH * 0.5} cy={userY} r="5" fill={isOnCurve ? '#7BA872' : '#E4A598'} />
                </>
              )}

              <line x1="0" y1={CENTER_Y} x2={SVG_WIDTH} y2={CENTER_Y} stroke="rgba(45,44,42,0.05)" strokeWidth="1" strokeDasharray="4 4" />
            </svg>
          </div>

          <div className="flex w-full max-w-xs justify-between text-sm">
            <span className="text-charcoal-muted">You: {metrics.noteLabel ?? '—'}</span>
            <span className={isOnCurve ? 'text-sage-deep font-medium' : 'text-charcoal-muted'}>
              {isOnCurve ? 'On curve!' : 'Follow the wave'}
            </span>
            <span className="text-charcoal-muted">{(metrics.clarity * 100).toFixed(0)}%</span>
          </div>

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
        </>
      )}
    </div>
  );
}
