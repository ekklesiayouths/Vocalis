/**
 * Virtual Piano Keyboard — collapsible bottom drawer.
 *
 * Features:
 * - 2-octave range: C3 to C5 (15 white keys, 10 black keys)
 * - Native Web Audio API oscillators (zero npm packages)
 * - Physical keyboard mapping (Z–M for octave 1, A–K for octave 2)
 * - Lock Tone toggle for continuous drone
 * - Vocal range visualization sync
 * - Horizontally scrollable on mobile
 *
 * SECURITY: Uses ONLY native browser APIs. No audio data stored.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Piano, Lock, ChevronDown } from 'lucide-react';
import { useAudioContext } from '@/context/AudioContextProvider';
import { useUser } from '@/context/UserContext';
import { midiToFrequency } from '@/lib/notes';

interface WhiteKey {
  midi: number;
  note: string;
  solfa: string;
  keyboardKey: string;
}

interface BlackKey {
  midi: number;
  note: string;
  solfa: string;
  keyboardKey: string;
  /** Index of the white key this black key sits between (left side) */
  whiteIndex: number;
}

// 2-octave layout: C3(48) to C5(72)
// Octave 1: C3 D3 E3 F3 G3 A3 B3  (white keys 0-6)
// Octave 2: C4 D4 E4 F4 G4 A4 B4 C5 (white keys 7-14)
const WHITE_KEYS: WhiteKey[] = [
  { midi: 48, note: 'C3', solfa: 'Doh', keyboardKey: 'z' },
  { midi: 50, note: 'D3', solfa: 'Re',  keyboardKey: 'x' },
  { midi: 52, note: 'E3', solfa: 'Mi',  keyboardKey: 'c' },
  { midi: 53, note: 'F3', solfa: 'Fa',  keyboardKey: 'v' },
  { midi: 55, note: 'G3', solfa: 'Soh', keyboardKey: 'b' },
  { midi: 57, note: 'A3', solfa: 'La',  keyboardKey: 'n' },
  { midi: 59, note: 'B3', solfa: 'Ti',  keyboardKey: 'm' },
  { midi: 60, note: 'C4', solfa: 'Doh', keyboardKey: 'a' },
  { midi: 62, note: 'D4', solfa: 'Re',  keyboardKey: 's' },
  { midi: 64, note: 'E4', solfa: 'Mi',  keyboardKey: 'd' },
  { midi: 65, note: 'F4', solfa: 'Fa',  keyboardKey: 'f' },
  { midi: 67, note: 'G4', solfa: 'Soh', keyboardKey: 'g' },
  { midi: 69, note: 'A4', solfa: 'La',  keyboardKey: 'h' },
  { midi: 71, note: 'B4', solfa: 'Ti',  keyboardKey: 'j' },
  { midi: 72, note: 'C5', solfa: 'Doh', keyboardKey: 'k' },
];

// Black keys: positioned between specific white key indices
// C# sits between C and D (whiteIndex 0), D# between D and E (1), etc.
const BLACK_KEYS: BlackKey[] = [
  // Octave 1
  { midi: 49, note: 'C#3', solfa: 'Dih', keyboardKey: 's', whiteIndex: 0 },
  { midi: 51, note: 'D#3', solfa: 'Rih', keyboardKey: 'd', whiteIndex: 1 },
  { midi: 54, note: 'F#3', solfa: 'Fih', keyboardKey: 'g', whiteIndex: 3 },
  { midi: 56, note: 'G#3', solfa: 'Sih', keyboardKey: 'h', whiteIndex: 4 },
  { midi: 58, note: 'A#3', solfa: 'Lih', keyboardKey: 'j', whiteIndex: 5 },
  // Octave 2
  { midi: 61, note: 'C#4', solfa: 'Dih', keyboardKey: 'w', whiteIndex: 7 },
  { midi: 63, note: 'D#4', solfa: 'Rih', keyboardKey: 'e', whiteIndex: 8 },
  { midi: 66, note: 'F#4', solfa: 'Fih', keyboardKey: 't', whiteIndex: 10 },
  { midi: 68, note: 'G#4', solfa: 'Sih', keyboardKey: 'y', whiteIndex: 11 },
  { midi: 70, note: 'A#4', solfa: 'Lih', keyboardKey: 'u', whiteIndex: 12 },
];

// All keys combined for keyboard lookup
const ALL_KEYS = [...WHITE_KEYS, ...BLACK_KEYS];

// White key width in rem (matches CSS below)
const WHITE_KEY_W = 2.75; // w-11 = 2.75rem
const BLACK_KEY_W = 1.75; // w-7 = 1.75rem

interface VirtualPianoProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function VirtualPiano({ isOpen, onToggle }: VirtualPianoProps) {
  const { getContext } = useAudioContext();
  const { profile } = useUser();
  const [lockMode, setLockMode] = useState(false);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const lockedOscRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const activeOscsRef = useRef<Map<number, { osc: OscillatorNode; gain: GainNode }>>(new Map());

  const userLowMidi = profile.vocalRange?.lowMidi;
  const userHighMidi = profile.vocalRange?.highMidi;

  const stopNote = useCallback((midi: number) => {
    const nodes = activeOscsRef.current.get(midi);
    if (nodes) {
      try {
        const ctx = getContext();
        nodes.gain.gain.cancelScheduledValues(ctx.currentTime);
        nodes.gain.gain.setValueAtTime(0, ctx.currentTime);
        nodes.osc.stop(ctx.currentTime + 0.05);
        nodes.osc.disconnect();
        nodes.gain.disconnect();
      } catch { /* already stopped */ }
      activeOscsRef.current.delete(midi);
    }
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  }, [getContext]);

  const playNote = useCallback((midi: number) => {
    const ctx = getContext();
    const freq = midiToFrequency(midi);

    if (lockMode) {
      if (lockedOscRef.current) {
        try {
          lockedOscRef.current.osc.stop();
          lockedOscRef.current.osc.disconnect();
          lockedOscRef.current.gain.disconnect();
        } catch { /* ignore */ }
        lockedOscRef.current = null;
      }
      activeOscsRef.current.forEach((_, m) => stopNote(m));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      lockedOscRef.current = { osc, gain };
      setActiveNotes(new Set([midi]));
      return;
    }

    if (activeOscsRef.current.has(midi)) {
      stopNote(midi);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    activeOscsRef.current.set(midi, { osc, gain });
    setActiveNotes((prev) => new Set(prev).add(midi));

    setTimeout(() => {
      if (!lockMode && activeOscsRef.current.has(midi)) {
        stopNote(midi);
      }
    }, 1500);
  }, [getContext, lockMode, stopNote]);

  // Keyboard mapping
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      const pianoKey = ALL_KEYS.find((k) => k.keyboardKey === key);
      if (pianoKey) {
        e.preventDefault();
        playNote(pianoKey.midi);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const pianoKey = ALL_KEYS.find((k) => k.keyboardKey === key);
      if (pianoKey && !lockMode) {
        stopNote(pianoKey.midi);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, playNote, stopNote, lockMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeOscsRef.current.forEach((_, midi) => stopNote(midi));
      if (lockedOscRef.current) {
        try {
          lockedOscRef.current.osc.stop();
          lockedOscRef.current.osc.disconnect();
          lockedOscRef.current.gain.disconnect();
        } catch { /* ignore */ }
        lockedOscRef.current = null;
      }
    };
  }, [stopNote]);

  const toggleLock = () => {
    if (lockMode && lockedOscRef.current) {
      try {
        lockedOscRef.current.osc.stop();
        lockedOscRef.current.osc.disconnect();
        lockedOscRef.current.gain.disconnect();
      } catch { /* ignore */ }
      lockedOscRef.current = null;
      setActiveNotes(new Set());
    }
    setLockMode(!lockMode);
  };

  const isInRange = (midi: number): boolean => {
    if (userLowMidi === undefined || userHighMidi === undefined) return false;
    return midi >= userLowMidi && midi <= userHighMidi;
  };

  const isBoundary = (midi: number): 'low' | 'high' | null => {
    if (midi === userLowMidi) return 'low';
    if (midi === userHighMidi) return 'high';
    return null;
  };

  if (!isOpen) return null;

  // Calculate black key left offset: center over the gap between two white keys
  // left = (whiteIndex + 1) * WHITE_KEY_W - BLACK_KEY_W / 2
  const blackKeyLeft = (whiteIndex: number): number =>
    (whiteIndex + 1) * WHITE_KEY_W - BLACK_KEY_W / 2;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-fade-in">
      <div className="mx-auto max-w-5xl bg-cream-100 border-t-2 border-cream-400 shadow-paper-lg rounded-t-3xl px-4 pb-6 pt-3">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Piano className="h-5 w-5 text-charcoal" />
            <h3 className="font-semibold text-charcoal">Virtual Piano</h3>
            <span className="text-xs text-charcoal-muted hidden sm:inline">C3 – C5 · Keys Z–M & A–K</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLock}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                lockMode
                  ? 'bg-mustard text-charcoal shadow-paper-sm'
                  : 'bg-cream-200 border border-cream-400 text-charcoal-muted hover:text-charcoal'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              {lockMode ? 'Lock ON' : 'Lock Tone'}
            </button>
            <button
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-cream-200 border border-cream-400 text-charcoal-muted hover:text-charcoal transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Piano keyboard — 2-octave scrollable layout */}
        <div className="relative flex justify-start items-start overflow-x-auto pb-4 pt-10 px-2 bg-transparent select-none scrollbar-thin">
          {/* White keys row */}
          <div className="relative flex shrink-0">
            {WHITE_KEYS.map((key) => {
              const boundary = isBoundary(key.midi);
              const inRange = isInRange(key.midi);
              return (
                <button
                  key={key.midi}
                  onMouseDown={() => playNote(key.midi)}
                  onMouseUp={() => { if (!lockMode) stopNote(key.midi); }}
                  onMouseLeave={() => { if (!lockMode && activeNotes.has(key.midi)) stopNote(key.midi); }}
                  onTouchStart={(e) => { e.preventDefault(); playNote(key.midi); }}
                  onTouchEnd={(e) => { e.preventDefault(); if (!lockMode) stopNote(key.midi); }}
                  className={`relative shrink-0 rounded-b-xl border border-cream-400 shadow-[2px_2px_0px_0px_rgba(45,44,42,0.15)] transition-all duration-75 ${
                    activeNotes.has(key.midi)
                      ? 'bg-sage-light translate-y-0.5 shadow-none'
                      : 'bg-cream-50 hover:bg-cream-100'
                  } ${inRange ? 'ring-2 ring-sage-DEFAULT/40' : ''}`}
                  style={{ width: `${WHITE_KEY_W}rem`, height: '10rem' }}
                >
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-medium text-charcoal-muted">{key.note}</span>
                  <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-sage-deep">{key.solfa}</span>
                  {boundary === 'low' && (
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-medium text-sage-deep bg-sage-light border border-sage-DEFAULT rounded px-1 py-0.5">Lowest</span>
                  )}
                  {boundary === 'high' && (
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-medium text-terracotta-deep bg-terracotta-light border border-terracotta-DEFAULT rounded px-1 py-0.5">Highest</span>
                  )}
                </button>
              );
            })}

            {/* Black keys — absolutely positioned over white key gaps */}
            {BLACK_KEYS.map((key) => (
              <button
                key={key.midi}
                onMouseDown={() => playNote(key.midi)}
                onMouseUp={() => { if (!lockMode) stopNote(key.midi); }}
                onMouseLeave={() => { if (!lockMode && activeNotes.has(key.midi)) stopNote(key.midi); }}
                onTouchStart={(e) => { e.preventDefault(); playNote(key.midi); }}
                onTouchEnd={(e) => { e.preventDefault(); if (!lockMode) stopNote(key.midi); }}
                className={`absolute top-0 z-10 rounded-b-lg border border-charcoal/30 shadow-[2px_2px_0px_0px_rgba(45,44,42,0.2)] transition-all duration-75 ${
                  activeNotes.has(key.midi)
                    ? 'bg-charcoal translate-y-0.5 shadow-none'
                    : 'bg-stone-800 hover:bg-stone-700'
                }`}
                style={{
                  width: `${BLACK_KEY_W}rem`,
                  height: '6rem',
                  left: `${blackKeyLeft(key.whiteIndex)}rem`,
                }}
              >
                <span className="block mt-1 text-[8px] text-cream-100/70 text-center">{key.note}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Octave labels */}
        <div className="flex justify-between px-2 mt-1 text-[10px] text-charcoal-muted/60">
          <span>Octave 1 (C3–B3)</span>
          <span>Octave 2 (C4–C5)</span>
        </div>

        {lockMode && (
          <p className="mt-2 text-center text-xs text-mustard-deep animate-fade-in">
            Lock mode active — tap a key to start a continuous drone. Tap again to change note.
          </p>
        )}
      </div>
    </div>
  );
}
