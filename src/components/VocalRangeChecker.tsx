/**
 * Vocal Range Checker — two-phase interactive wizard.
 *
 * Phase 1: Detects the user's lowest sustainable pitch.
 * Phase 2: Detects the user's highest clean pitch.
 * Then classifies the voice as Soprano, Alto, Tenor, or Bass.
 *
 * SECURITY:
 * - Uses native Web Audio API for pitch detection (max 1500 Hz filter).
 * - All audio processed locally. No data stored or transmitted.
 * - Results written to local UserContext only.
 * - Media stream fully disposed on completion.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, ArrowRight, RotateCcw, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { frequencyToNote, midiToFrequency } from '@/lib/notes';
import { useUser } from '@/context/UserContext';
import { useAudioContext } from '@/context/AudioContextProvider';

type Phase = 'intro' | 'low' | 'high' | 'result';

const MAX_FREQ = 1500; // Vocal safety cap

interface RangeResult {
  lowMidi: number;
  highMidi: number;
  classification: string;
}

function classifyVoice(lowMidi: number, highMidi: number): string {
  // Standard choral ranges (approximate MIDI):
  // Bass: E2(40) – E4(64), Tenor: C3(48) – G4(67),
  // Alto: F3(53) – D5(74), Soprano: C4(60) – G5(79)
  if (lowMidi <= 45 && highMidi <= 64) return 'Bass';
  if (lowMidi <= 48 && highMidi <= 67) return 'Tenor';
  if (lowMidi <= 55 && highMidi <= 74) return 'Alto';
  if (lowMidi >= 55 && highMidi >= 72) return 'Soprano';
  // Fallback by center pitch
  const center = (lowMidi + highMidi) / 2;
  if (center < 50) return 'Bass';
  if (center < 58) return 'Tenor';
  if (center < 65) return 'Alto';
  return 'Soprano';
}

export function VocalRangeChecker({ onComplete, onCancel }: { onComplete?: () => void; onCancel?: () => void }) {
  const { start, stop, isActive, isReceiving, metrics } = useAudioInput({ maxFrequency: MAX_FREQ });
  const { getContext } = useAudioContext();
  const { setProfile } = useUser();
  const [phase, setPhase] = useState<Phase>('intro');
  const [lowestFreq, setLowestFreq] = useState<number | null>(null);
  const [highestFreq, setHighestFreq] = useState<number | null>(null);
  const [stableTimer, setStableTimer] = useState(0);
  const stableFreqRef = useRef<number | null>(null);
  const stableCountRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const highestFreqRef = useRef<number | null>(null);
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;

  // Play a reference tone
  const playReference = useCallback((midi: number) => {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiToFrequency(midi);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.2, ctx.currentTime + 1.5);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 2.1);
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch { /* ignore */ } };
  }, [getContext]);

  // Phase: Low — track lowest stable pitch
  useEffect(() => {
    if (phase !== 'low' || !isActive) return;

    const check = () => {
      const m = metricsRef.current;
      if (m.frequency && m.frequency < MAX_FREQ && m.clarity > 0.5) {
        const freq = m.frequency;
        if (stableFreqRef.current === null) {
          stableFreqRef.current = freq;
          stableCountRef.current = 1;
        } else {
          const diff = Math.abs(freq - stableFreqRef.current) / stableFreqRef.current;
          if (diff < 0.03) {
            stableCountRef.current++;
            if (stableCountRef.current >= 120) { // ~2 seconds at 60fps
              setLowestFreq(stableFreqRef.current);
            }
          } else {
            // Track the lowest stable note
            if (freq < stableFreqRef.current) {
              stableFreqRef.current = freq;
              stableCountRef.current = 1;
            }
          }
        }
        setStableTimer(stableCountRef.current);
      } else {
        stableCountRef.current = 0;
        setStableTimer(0);
      }
      rafRef.current = requestAnimationFrame(check);
    };
    rafRef.current = requestAnimationFrame(check);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, isActive]);

  // Phase: High — track highest clean pitch
  useEffect(() => {
    if (phase !== 'high' || !isActive) return;

    const check = () => {
      const m = metricsRef.current;
      if (m.frequency && m.frequency < MAX_FREQ && m.clarity > 0.5) {
        const freq = m.frequency;
        if (freq > (highestFreqRef.current ?? 0)) {
          highestFreqRef.current = freq;
          setHighestFreq(freq);
        }
      }
      rafRef.current = requestAnimationFrame(check);
    };
    rafRef.current = requestAnimationFrame(check);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, isActive]);

  const handleStartLow = async () => {
    stableFreqRef.current = null;
    stableCountRef.current = 0;
    setStableTimer(0);
    setPhase('low');
    await start();
  };

  const handleConfirmLow = () => {
    stop();
    setPhase('high');
  };

  const handleStartHigh = async () => {
    setHighestFreq(null);
    setPhase('high');
    await start();
  };

  const handleConfirmHigh = () => {
    stop();
    if (lowestFreq && highestFreq) {
      const lowNote = frequencyToNote(lowestFreq);
      const highNote = frequencyToNote(highestFreq);
      if (lowNote && highNote) {
        const lowMidi = Math.round(69 + 12 * Math.log2(lowestFreq / 440));
        const highMidi = Math.round(69 + 12 * Math.log2(highestFreq / 440));
        const classification = classifyVoice(lowMidi, highMidi);
        setProfile((prev) => ({
          ...prev,
          vocalRange: { lowMidi, highMidi, classification },
        }));
      }
    }
    setPhase('result');
  };

  const handleRestart = () => {
    stop();
    setPhase('intro');
    setLowestFreq(null);
    setHighestFreq(null);
    setStableTimer(0);
    stableFreqRef.current = null;
    stableCountRef.current = 0;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  const lowestNoteInfo = lowestFreq ? frequencyToNote(lowestFreq) : null;
  const highestNoteInfo = highestFreq ? frequencyToNote(highestFreq) : null;
  const stableProgress = Math.min((stableTimer / 120) * 100, 100);

  return (
    <div className="card flex flex-col gap-5 p-8 animate-fade-in">
      {/* Vocal Safety Notice */}
      <div className="flex items-start gap-2 rounded-xl bg-terracotta-light/50 border border-terracotta-DEFAULT/50 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-terracotta-deep mt-0.5 shrink-0" />
        <p className="text-xs text-terracotta-deep">
          <span className="font-semibold">Vocal Safety Notice:</span> Do not strain your voice. Stop when notes feel too high or low.
        </p>
      </div>

      {phase === 'intro' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-sage-deep" />
            <h3 className="text-lg font-bold text-charcoal">Discover Your Vocal Range</h3>
          </div>
          <p className="text-sm text-charcoal-muted">
            We'll find your lowest and highest comfortable notes in two quick steps. This helps us personalize your learning and show your range on the piano.
          </p>
          <div className="flex flex-col gap-2 text-sm text-charcoal-light">
            <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage-light text-xs font-bold text-sage-deep">1</span> Find your lowest note — hum down step by step</div>
            <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage-light text-xs font-bold text-sage-deep">2</span> Find your highest note — glide your voice upward</div>
          </div>
          <div className="flex gap-3">
            {onCancel && <button onClick={onCancel} className="btn-secondary text-sm">Skip for now</button>}
            <button onClick={handleStartLow} className="btn-primary flex-1">
              <Mic className="h-4 w-4" /> Start Phase 1
            </button>
          </div>
        </div>
      )}

      {phase === 'low' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-light text-xs font-bold text-sage-deep">1</span>
            <h3 className="font-semibold text-charcoal">Find Your Lowest Note</h3>
          </div>
          <p className="text-sm text-charcoal-muted">
            Hum a low note and try to go lower. Hold each note for 2 seconds. We'll detect your lowest stable pitch.
          </p>
          <button onClick={() => playReference(48)} className="btn-secondary text-sm w-fit">
            Play reference (C3)
          </button>

          {isActive && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {isReceiving ? (
                  <span className="flex items-center gap-1.5 text-sm text-sage-deep"><Check className="h-4 w-4" /> Listening...</span>
                ) : (
                  <span className="text-sm text-charcoal-muted">Hum a low tone...</span>
                )}
              </div>
              {metrics.noteLabel && (
                <div className="rounded-xl bg-cream-200 border border-cream-400 px-4 py-3 text-center">
                  <span className="text-2xl font-bold text-charcoal">{metrics.noteLabel}</span>
                  {metrics.cents !== null && (
                    <span className="ml-2 text-sm text-charcoal-muted">{metrics.cents > 0 ? '+' : ''}{metrics.cents} cents</span>
                  )}
                </div>
              )}
              <div className="w-full bg-cream-200 rounded-full h-2 overflow-hidden">
                <div className="bg-sage-DEFAULT h-full transition-all duration-100" style={{ width: `${stableProgress}%` }} />
              </div>
              {lowestFreq && lowestNoteInfo && (
                <div className="rounded-xl bg-sage-light border border-sage-DEFAULT px-4 py-3 text-center animate-fade-in">
                  <p className="text-xs text-sage-deep">Lowest stable note detected:</p>
                  <span className="text-xl font-bold text-charcoal">{lowestNoteInfo.fullLabel}</span>
                </div>
              )}
              <div className="flex gap-3">
                {onCancel && <button onClick={() => { stop(); onCancel(); }} className="btn-secondary text-sm">Cancel</button>}
                <button onClick={stop} className="btn-secondary text-sm">Pause</button>
                <button onClick={handleConfirmLow} disabled={!lowestFreq} className="btn-primary flex-1 text-sm">
                  <ArrowRight className="h-4 w-4" /> Confirm & Continue
                </button>
              </div>
            </div>
          )}

          {!isActive && (
            <div className="flex gap-3">
              {onCancel && <button onClick={() => { stop(); onCancel(); }} className="btn-secondary text-sm">Cancel</button>}
              <button onClick={handleStartLow} className="btn-primary flex-1">
                <Mic className="h-4 w-4" /> Start Listening
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'high' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-light text-xs font-bold text-sage-deep">2</span>
            <h3 className="font-semibold text-charcoal">Find Your Highest Note</h3>
          </div>
          <p className="text-sm text-charcoal-muted">
            Glide your voice upward smoothly. We'll track your highest clean pitch before vocal cutoff.
          </p>
          <button onClick={() => playReference(72)} className="btn-secondary text-sm w-fit">
            Play reference (C5)
          </button>

          {isActive && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {isReceiving ? (
                  <span className="flex items-center gap-1.5 text-sm text-sage-deep"><Check className="h-4 w-4" /> Listening...</span>
                ) : (
                  <span className="text-sm text-charcoal-muted">Glide your voice up...</span>
                )}
              </div>
              {metrics.noteLabel && (
                <div className="rounded-xl bg-cream-200 border border-cream-400 px-4 py-3 text-center">
                  <span className="text-2xl font-bold text-charcoal">{metrics.noteLabel}</span>
                </div>
              )}
              {highestFreq && highestNoteInfo && (
                <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-center animate-fade-in">
                  <p className="text-xs text-terracotta-deep">Highest note so far:</p>
                  <span className="text-xl font-bold text-charcoal">{highestNoteInfo.fullLabel}</span>
                </div>
              )}
              <div className="flex gap-3">
                {onCancel && <button onClick={() => { stop(); onCancel(); }} className="btn-secondary text-sm">Cancel</button>}
                <button onClick={stop} className="btn-secondary text-sm">Pause</button>
                <button onClick={handleConfirmHigh} disabled={!highestFreq} className="btn-primary flex-1 text-sm">
                  <Check className="h-4 w-4" /> Confirm Range
                </button>
              </div>
            </div>
          )}

          {!isActive && (
            <div className="flex gap-3">
              {onCancel && <button onClick={() => { stop(); onCancel(); }} className="btn-secondary text-sm">Cancel</button>}
              <button onClick={handleStartHigh} className="btn-primary flex-1">
                <Mic className="h-4 w-4" /> Start Gliding Up
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'result' && lowestNoteInfo && highestNoteInfo && (
        <div className="flex flex-col gap-5 text-center">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-3xl bg-sage-DEFAULT shadow-paper animate-bounce-note">
            <Check className="h-8 w-8 text-cream-50" />
          </div>
          <h3 className="text-xl font-bold text-charcoal">Your Vocal Range</h3>
          <div className="flex justify-center gap-6">
            <div className="rounded-xl bg-cream-200 border border-cream-400 px-6 py-4">
              <p className="text-xs text-charcoal-muted">Lowest</p>
              <p className="text-2xl font-bold text-charcoal">{lowestNoteInfo.fullLabel}</p>
            </div>
            <div className="rounded-xl bg-cream-200 border border-cream-400 px-6 py-4">
              <p className="text-xs text-charcoal-muted">Highest</p>
              <p className="text-2xl font-bold text-charcoal">{highestNoteInfo.fullLabel}</p>
            </div>
          </div>
          <div className="rounded-xl bg-sage-light border border-sage-DEFAULT px-6 py-4">
            <p className="text-sm text-sage-deep">Your voice type:</p>
            <p className="text-3xl font-bold text-charcoal mt-1">
              {(() => {
                const lowMidi = Math.round(69 + 12 * Math.log2(lowestFreq! / 440));
                const highMidi = Math.round(69 + 12 * Math.log2(highestFreq! / 440));
                return classifyVoice(lowMidi, highMidi);
              })()}
            </p>
          </div>
          <p className="text-xs text-charcoal-muted">
            Your range is now visible on the Virtual Piano — highlighted keys show your comfortable zone.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleRestart} className="btn-secondary text-sm">
              <RotateCcw className="h-4 w-4" /> Redo
            </button>
            {onComplete && (
              <button onClick={onComplete} className="btn-primary text-sm">
                <Check className="h-4 w-4" /> Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
