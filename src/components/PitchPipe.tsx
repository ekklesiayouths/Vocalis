/**
 * Pitch Pipe — a simple utility for Music Directors to play starting keys.
 *
 * Plays steady drone tones for C, G, F, and Bb using native Web Audio API.
 * Can be opened as a drawer inside the Choir Space or from the header.
 *
 * SECURITY: Uses ONLY native browser APIs. No audio data stored.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Music, X } from 'lucide-react';
import { useAudioContext } from '@/context/AudioContextProvider';
import { midiToFrequency } from '@/lib/notes';

const PITCH_KEYS = [
  { midi: 60, label: 'C', desc: 'C4 — 261.63 Hz' },
  { midi: 67, label: 'G', desc: 'G4 — 392.00 Hz' },
  { midi: 65, label: 'F', desc: 'F4 — 349.23 Hz' },
  { midi: 58, label: 'Bb', desc: 'Bb3 — 233.08 Hz' },
];

interface PitchPipeProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PitchPipe({ isOpen, onClose }: PitchPipeProps) {
  const { getContext } = useAudioContext();
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const oscRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  const stopTone = useCallback(() => {
    if (oscRef.current) {
      const ctx = getContext();
      try {
        oscRef.current.gain.gain.cancelScheduledValues(ctx.currentTime);
        oscRef.current.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        oscRef.current.osc.stop(ctx.currentTime + 0.15);
        oscRef.current.osc.disconnect();
        oscRef.current.gain.disconnect();
      } catch { /* ignore */ }
      oscRef.current = null;
    }
    setActiveKey(null);
  }, [getContext]);

  const playTone = useCallback((midi: number) => {
    const ctx = getContext();
    // Stop existing tone
    if (oscRef.current) {
      try {
        oscRef.current.osc.stop();
        oscRef.current.osc.disconnect();
        oscRef.current.gain.disconnect();
      } catch { /* ignore */ }
      oscRef.current = null;
    }

    if (activeKey === midi) {
      setActiveKey(null);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midiToFrequency(midi);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    oscRef.current = { osc, gain };
    setActiveKey(midi);
  }, [getContext, activeKey]);

  useEffect(() => {
    return () => { stopTone(); };
  }, [stopTone]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-fade-in">
      <div className="mx-auto max-w-md bg-cream-100 border-t-2 border-cream-400 shadow-paper-lg rounded-t-3xl px-4 pb-6 pt-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-sage-deep" />
            <h3 className="font-semibold text-charcoal">Pitch Pipe</h3>
          </div>
          <button onClick={onClose} className="text-charcoal-muted hover:text-charcoal transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {PITCH_KEYS.map((key) => (
            <button
              key={key.midi}
              onClick={() => playTone(key.midi)}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-4 transition-all ${
                activeKey === key.midi
                  ? 'bg-sage-light border-sage-DEFAULT shadow-paper-sm scale-105'
                  : 'bg-cream-50 border-cream-400 hover:border-sage-DEFAULT/50 hover:bg-cream-100'
              }`}
            >
              <span className="text-2xl font-bold text-charcoal">{key.label}</span>
              <span className="text-[9px] text-charcoal-muted">{key.desc}</span>
            </button>
          ))}
        </div>
        {activeKey !== null && (
          <button onClick={stopTone} className="btn-secondary w-full mt-4 text-sm">
            Stop Tone
          </button>
        )}
        <p className="mt-3 text-center text-xs text-charcoal-muted">
          Tap a key to play a steady drone. Tap again to stop.
        </p>
      </div>
    </div>
  );
}
