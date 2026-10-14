/**
 * AudioContextProvider — persistent, app-wide audio context manager.
 *
 * Provides a shared AudioContext for all audio features (piano, pitch pipe,
 * tone player) and a visual warning system for flat-zero audio input.
 *
 * SECURITY: Uses ONLY native Web Audio API. No third-party packages.
 * No audio data is stored or transmitted.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface AudioContextValue {
  /** Get the shared AudioContext, creating/resuming if needed */
  getContext: () => AudioContext;
  /** Whether the audio input is returning flat zeros (hardware issue) */
  audioWarning: boolean;
  /** Dismiss the audio warning */
  dismissWarning: () => void;
  /** Show the audio warning */
  showWarning: () => void;
}

const AudioContextCtx = createContext<AudioContextValue | null>(null);

export function AudioContextProvider({ children }: { children: ReactNode }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const [audioWarning, setAudioWarning] = useState(false);

  const getContext = useCallback((): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      const AudioCtxClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AudioCtxClass();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const showWarning = useCallback(() => setAudioWarning(true), []);
  const dismissWarning = useCallback(() => setAudioWarning(false), []);

  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  return (
    <AudioContextCtx.Provider value={{ getContext, audioWarning, showWarning, dismissWarning }}>
      {children}
      {audioWarning && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 rounded-xl bg-mustard-light border border-mustard-DEFAULT px-5 py-3 shadow-paper-lg">
            <span className="text-2xl">🎤</span>
            <div>
              <p className="text-sm font-medium text-charcoal">Adjusting audio input...</p>
              <p className="text-xs text-charcoal-muted">Try humming a clear tone!</p>
            </div>
            <button onClick={dismissWarning} className="ml-2 text-charcoal-muted hover:text-charcoal">
              ✕
            </button>
          </div>
        </div>
      )}
    </AudioContextCtx.Provider>
  );
}

export function useAudioContext(): AudioContextValue {
  const ctx = useContext(AudioContextCtx);
  if (!ctx) throw new Error('useAudioContext must be used within AudioContextProvider');
  return ctx;
}
