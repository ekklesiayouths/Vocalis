/**
 * Breath Support Tracker — Vocal Mechanics (Beginner)
 *
 * Mic-based sustained phonation test ("Hiss Test"). Tracks amplitude
 * over time. A floating musical note stays in a sage "optimal pressure zone"
 * only if airflow volume remains stable.
 *
 * SECURITY: Uses useAudioInput (native, no raw audio stored). No score.
 */

import { useEffect, useRef, useState } from 'react';
import { Wind, Square } from 'lucide-react';
import { useAudioInput } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';

const TUBE_HEIGHT = 300;
const TARGET_MIN = 35;
const TARGET_MAX = 65;

export function BreathSupportTracker() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 50,
    maxFrequency: 300,
  });

  const [smoothedVol, setSmoothedVol] = useState(0);
  const [sustainedSec, setSustainedSec] = useState(0);
  const [bestSustained, setBestSustained] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const smoothRef = useRef(0);
  const sustainedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const dropDetectedRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      smoothRef.current = smoothRef.current * 0.75 + metrics.volume * 0.25;
      setSmoothedVol(smoothRef.current);
    }, 50);
    return () => clearInterval(interval);
  }, [isActive, metrics.volume]);

  useEffect(() => {
    if (!isActive) { lastTickRef.current = null; return; }
    const interval = setInterval(() => {
      const now = Date.now();
      if (lastTickRef.current === null) lastTickRef.current = now;
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      // Read the latest smoothed volume from ref, not state
      const volPercent = smoothRef.current * 100;
      const inZone = volPercent >= TARGET_MIN && volPercent <= TARGET_MAX;
      if (inZone) {
        sustainedRef.current += delta;
        const rounded = Math.floor(sustainedRef.current);
        setSustainedSec(rounded);
        setBestSustained((prev) => rounded > prev ? rounded : prev);
        dropDetectedRef.current = false;
        setShowTip(false);
      } else {
        if (sustainedRef.current > 1 && !dropDetectedRef.current) {
          dropDetectedRef.current = true;
          setShowTip(true);
        }
        sustainedRef.current = 0;
        setSustainedSec(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const levelPercent = Math.min(100, smoothedVol * 100);
  const noteY = TUBE_HEIGHT - (levelPercent / 100) * TUBE_HEIGHT;
  const inZone = levelPercent >= TARGET_MIN && levelPercent <= TARGET_MAX;

  const handleStop = () => { stop(); setShowTip(false); };

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Wind className="h-5 w-5 text-terracotta-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Breath Support Tracker</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Sustain a steady "Sssss" exhale. Keep the floating note in the sage pressure zone. Steady diaphragm = steady airflow!
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <>
          <div className="flex items-stretch gap-6">
            {/* Vertical paper tube */}
            <div className="relative w-24 overflow-hidden rounded-3xl bg-cream-200 border-2 border-cream-400 shadow-paper-sm" style={{ height: TUBE_HEIGHT }}>
              {/* Optimal pressure zone */}
              <div
                className="absolute left-0 right-0 border-y-2 border-dashed border-sage-DEFAULT bg-sage-light/40"
                style={{ bottom: (TARGET_MIN / 100) * TUBE_HEIGHT, height: ((TARGET_MAX - TARGET_MIN) / 100) * TUBE_HEIGHT }}
              >
                <span className="absolute right-1 top-1 text-[9px] text-sage-deep/60 font-medium">optimal</span>
              </div>

              {/* Fluid fill */}
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-100 ease-out"
                style={{
                  height: (levelPercent / 100) * TUBE_HEIGHT,
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
                  {inZone ? 'Steady!' : `${levelPercent.toFixed(0)}%`}
                </span>
                <div className="text-xs text-charcoal-muted">pressure</div>
              </div>
            </div>
          </div>

          {/* Friendly tip on instability */}
          {showTip && (
            <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep text-center max-w-sm animate-fade-in">
              Your airflow dropped! Try engaging your diaphragm more — imagine breathing out through a tiny straw slowly and steadily.
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
