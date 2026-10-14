/**
 * Chest/Head/Mixed Blending & Resonators — Vocal Mechanics (Singer)
 *
 * Detects user's pitch and maps to vocal register zones (Chest, Mouth,
 * Mask, Head). As user sings a siren, the corresponding zone illuminates
 * in sage green. Tracks smoothness — shows a gentle tip if they crack.
 *
 * SECURITY: Uses useAudioInput (native, no raw audio stored). No score.
 */

import { useEffect, useRef, useState } from 'react';
import { Waves, Square } from 'lucide-react';
import { useAudioInput } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';

const MIN_HZ = 130;
const MAX_HZ = 523;

const RESONATORS = [
  { label: 'Head', subtitle: 'Upper resonance', minHz: 350, maxHz: 600, color: '#B86B5E', bg: 'bg-terracotta-light/40' },
  { label: 'Mask', subtitle: 'Forward placement', minHz: 280, maxHz: 350, color: '#D4AD2E', bg: 'bg-mustard-light/40' },
  { label: 'Mouth', subtitle: 'Oral resonance', minHz: 200, maxHz: 280, color: '#E8C547', bg: 'bg-mustard-light/30' },
  { label: 'Chest', subtitle: 'Lower resonance', minHz: 80, maxHz: 200, color: '#7BA872', bg: 'bg-sage-light/40' },
];

function getResonator(hz: number) {
  return RESONATORS.find((r) => hz >= r.minHz && hz < r.maxHz) ?? RESONATORS[0];
}

function freqToHeight(hz: number, totalHeight: number): number {
  const logMin = Math.log2(MIN_HZ);
  const logMax = Math.log2(MAX_HZ);
  const logHz = Math.log2(Math.max(MIN_HZ, Math.min(MAX_HZ, hz)));
  const ratio = (logHz - logMin) / (logMax - logMin);
  return totalHeight * (1 - ratio);
}

export function RegisterBlending() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 100,
    maxFrequency: 700,
  });

  const [smoothedFreq, setSmoothedFreq] = useState<number | null>(null);
  const [lastFreq, setLastFreq] = useState<number | null>(null);
  const [crackDetected, setCrackDetected] = useState(false);
  const [transitionCount, setTransitionCount] = useState(0);
  const smoothFreqRef = useRef<number | null>(null);
  const lastResonatorRef = useRef<string | null>(null);
  const crackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive || !metrics.frequency || metrics.clarity < 0.3) {
      smoothFreqRef.current = null;
      setSmoothedFreq(null);
      return;
    }
    const target = metrics.frequency;
    if (smoothFreqRef.current === null) {
      smoothFreqRef.current = target;
    } else {
      smoothFreqRef.current = smoothFreqRef.current * 0.8 + target * 0.2;
    }
    setSmoothedFreq(smoothFreqRef.current);
    setLastFreq(target);

    // Detect register transition
    const currentRes = getResonator(smoothFreqRef.current);
    if (lastResonatorRef.current && lastResonatorRef.current !== currentRes.label) {
      setTransitionCount((c) => c + 1);
    }
    lastResonatorRef.current = currentRes.label;

    // Detect crack: sudden large frequency jump
    if (lastFreq && Math.abs(Math.log2(target / lastFreq)) > 0.15) {
      setCrackDetected(true);
      if (crackTimerRef.current) clearTimeout(crackTimerRef.current);
      crackTimerRef.current = setTimeout(() => setCrackDetected(false), 2000);
    }
  }, [metrics, isActive, lastFreq]);

  const currentResonator = smoothedFreq ? getResonator(smoothedFreq) : null;
  const indicatorY = smoothedFreq ? freqToHeight(smoothedFreq, 320) : null;

  const handleStop = () => {
    stop();
    setCrackDetected(false);
    setTransitionCount(0);
    lastResonatorRef.current = null;
  };

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Waves className="h-5 w-5 text-terracotta-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Register Blending & Resonators</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Sing a slow vocal siren — glide up and down. Watch the resonance zones light up as your voice moves through Chest, Mouth, Mask, and Head.
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <>
          <div className="flex items-stretch gap-5">
            {/* Voice map */}
            <div className="relative w-36 overflow-hidden rounded-2xl bg-cream-200 border-2 border-cream-400 shadow-paper-sm" style={{ height: 320 }}>
              {RESONATORS.map((res, i) => {
                const top = freqToHeight(res.maxHz, 320);
                const bottom = freqToHeight(res.minHz, 320);
                const isActiveRes = currentResonator?.label === res.label;
                return (
                  <div key={res.label} className={`absolute left-0 right-0 transition-all duration-300 ${isActiveRes ? res.bg : 'bg-transparent'}`}
                    style={{ top, height: bottom - top, borderTop: i > 0 ? '1px dashed rgba(45,44,42,0.08)' : 'none' }}>
                    <div className="px-2 pt-2">
                      <span className="block text-sm font-bold transition-colors" style={{ color: isActiveRes ? res.color : 'rgba(45,44,42,0.2)' }}>{res.label}</span>
                      <span className="block text-[9px] transition-colors" style={{ color: isActiveRes ? res.color : 'rgba(45,44,42,0.15)' }}>{res.subtitle}</span>
                    </div>
                  </div>
                );
              })}

              {/* Glowing pitch indicator */}
              {indicatorY !== null && (
                <div className="absolute left-0 right-0 h-1 transition-all duration-100" style={{ top: indicatorY, backgroundColor: currentResonator?.color ?? '#2D2C2A', boxShadow: `0 0 10px ${currentResonator?.color ?? '#2D2C2A'}80` }} />
              )}

              <span className="absolute left-1.5 top-1 text-[9px] text-charcoal/20">High</span>
              <span className="absolute left-1.5 bottom-1 text-[9px] text-charcoal/20">Low</span>
            </div>

            {/* Stats */}
            <div className="flex flex-col justify-center gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-charcoal">{metrics.noteLabel ?? '—'}</div>
                <div className="text-xs text-charcoal-muted">your note</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold" style={{ color: currentResonator?.color ?? 'rgba(45,44,42,0.3)' }}>{currentResonator?.label ?? '—'}</div>
                <div className="text-xs text-charcoal-muted">resonance</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-mustard-DEFAULT">{transitionCount}</div>
                <div className="text-xs text-charcoal-muted">transitions</div>
              </div>
            </div>
          </div>

          {/* Crack detection tip */}
          {crackDetected && (
            <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep text-center max-w-sm animate-fade-in">
              Gentle reminder: that transition felt a bit abrupt. Try lightening your chest voice as you ascend — let it gently blend into mixed voice rather than pushing.
            </div>
          )}

          <button onClick={handleStop} className="btn-terracotta w-full max-w-xs">
            <Square className="h-4 w-4" /> Stop
          </button>
        </>
      )}
    </div>
  );
}
