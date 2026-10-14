/**
 * Siren Elevator — Agility exercise
 * Warm notebook styling: vertical register map (Chest/Mixed/Head) illuminating.
 *
 * SECURITY: Uses the shared useAudioInput hook. No raw audio stored.
 */

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, Save } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';
import { frequencyToNote } from '@/lib/notes';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';
import { submitAttempt } from '@/lib/progressService';

const MIN_HZ = 130;
const MAX_HZ = 523;
const GUIDE_SPEED = 0.0006;
const BAR_HEIGHT = 320;

const REGISTERS = [
  { label: 'Head', minHz: 350, maxHz: 600, color: '#B86B5E', bg: 'bg-terracotta-light/40' },
  { label: 'Mixed', minHz: 220, maxHz: 350, color: '#D4AD2E', bg: 'bg-mustard-light/40' },
  { label: 'Chest', minHz: 80, maxHz: 220, color: '#7BA872', bg: 'bg-sage-light/40' },
];

function freqToY(hz: number): number {
  const logMin = Math.log2(MIN_HZ);
  const logMax = Math.log2(MAX_HZ);
  const logHz = Math.log2(Math.max(MIN_HZ, Math.min(MAX_HZ, hz)));
  const ratio = (logHz - logMin) / (logMax - logMin);
  return BAR_HEIGHT * (1 - ratio);
}

function getRegister(hz: number) {
  return REGISTERS.find((r) => hz >= r.minHz && hz < r.maxHz) ?? REGISTERS[0];
}

export function SirenSlider() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 100,
    maxFrequency: 700,
  });

  const [guideHz, setGuideHz] = useState(261.63);
  const [elapsed, setElapsed] = useState(0);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;
  const matchFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const guideHzRef = useRef(261.63);

  useEffect(() => {
    if (!isActive) { startTimeRef.current = null; return; }
    let raf: number;
    const animate = () => {
      const now = Date.now();
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsedMs = now - startTimeRef.current;
      setElapsed(Math.floor(elapsedMs / 1000));
      const phase = (elapsedMs * GUIDE_SPEED) * Math.PI * 2;
      const logRange = Math.log2(MAX_HZ / MIN_HZ);
      const logMid = Math.log2(MIN_HZ) + logRange / 2;
      const newGuideHz = Math.pow(2, logMid + Math.sin(phase) * (logRange / 2));
      setGuideHz(newGuideHz);
      guideHzRef.current = newGuideHz;

      // Track match accuracy
      const m = metricsRef.current;
      if (m.frequency && m.clarity > 0.3) {
        totalFramesRef.current++;
        const userY = freqToY(m.frequency);
        const gY = freqToY(guideHzRef.current);
        if (Math.abs(userY - gY) < 25) matchFramesRef.current++;
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
      const result = await submitScore('Siren Elevator', accuracy, elapsedSec);
      if (result.success) {
        const ratio = totalFramesRef.current > 0 ? matchFramesRef.current / totalFramesRef.current : 0;
        await submitAttempt('Siren Elevator', accuracy, elapsedSec, result.xpEarned ?? 0, ratio);
      }
      setScoreResult(result);
      setIsSubmitting(false);
    }
  };

  const guideY = freqToY(guideHz);
  const userY = metrics.frequency && metrics.clarity > 0.3 ? freqToY(metrics.frequency) : null;
  const guideNote = frequencyToNote(guideHz);
  const userRegister = metrics.frequency ? getRegister(metrics.frequency) : null;
  const guideRegister = getRegister(guideHz);
  const isMatching = userY !== null && Math.abs(userY - guideY) < 25;

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5 text-mustard-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Siren Elevator</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Follow the glowing guide as it sweeps through Chest, Mixed, and Head registers.
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <div className="flex items-stretch gap-5">
          {/* Register map */}
          <div className="relative w-28 overflow-hidden rounded-2xl bg-cream-200 border border-cream-400 shadow-paper-sm" style={{ height: BAR_HEIGHT }}>
            {REGISTERS.map((reg) => {
              const top = freqToY(reg.maxHz);
              const bottom = freqToY(reg.minHz);
              const isActiveReg = userRegister?.label === reg.label;
              return (
                <div
                  key={reg.label}
                  className={`absolute left-0 right-0 transition-all duration-300 ${isActiveReg ? reg.bg : 'bg-transparent'}`}
                  style={{ top, height: bottom - top, borderBottom: '1px solid rgba(45,44,42,0.06)' }}
                >
                  <span className="absolute left-2 top-2 text-xs font-medium transition-all" style={{ color: isActiveReg ? reg.color : 'rgba(45,44,42,0.2)' }}>
                    {reg.label}
                  </span>
                </div>
              );
            })}

            {/* Guide line */}
            <div className="absolute left-0 right-0 h-0.5 transition-all duration-100" style={{ top: guideY, backgroundColor: guideRegister.color }} />
            <span className="absolute right-1 text-[9px] font-medium transition-all duration-100" style={{ top: Math.max(0, guideY - 14), color: guideRegister.color }}>
              {guideNote?.fullLabel}
            </span>

            {/* User pitch dot */}
            {userY !== null && (
              <div className="absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full transition-all duration-100" style={{
                top: userY - 7,
                backgroundColor: isMatching ? '#7BA872' : (userRegister?.color ?? '#2D2C2A'),
              }} />
            )}

            <span className="absolute left-1 top-1 text-[9px] text-charcoal/20">C5</span>
            <span className="absolute left-1 bottom-1 text-[9px] text-charcoal/20">C3</span>
          </div>

          {/* Stats */}
          <div className="flex flex-col justify-center gap-5">
            <div className="text-center">
              <div className={`text-xl font-bold ${isMatching ? 'text-sage-deep' : 'text-charcoal-muted'}`}>{isMatching ? 'Match!' : '—'}</div>
              <div className="text-xs text-charcoal-muted">status</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-charcoal">{elapsed}s</div>
              <div className="text-xs text-charcoal-muted">elapsed</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-charcoal">{metrics.noteLabel ?? '—'}</div>
              <div className="text-xs text-charcoal-muted">your note</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium" style={{ color: userRegister?.color ?? 'rgba(45,44,42,0.3)' }}>{userRegister?.label ?? '—'}</div>
              <div className="text-xs text-charcoal-muted">register</div>
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
    </div>
  );
}
