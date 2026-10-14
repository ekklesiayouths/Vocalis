/**
 * Shared audio playback utility for Web Audio API oscillator-based tones.
 *
 * Uses the app-wide shared AudioContext from AudioContextProvider when
 * available, falling back to a local context if used outside the provider.
 * This prevents exceeding the browser's ~6 AudioContext limit when multiple
 * components play tones simultaneously.
 *
 * SECURITY:
 * - Uses ONLY native browser APIs (AudioContext, OscillatorNode, GainNode).
 * - No external audio files, no third-party packages — zero supply-chain risk.
 * - All audio is synthesized in-browser and never persisted.
 *
 * CLEANUP: Every call returns a cleanup function that disconnects nodes.
 * The useTonePlayer hook automatically cleans up on unmount.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAudioContext } from '@/context/AudioContextProvider';

interface ToneOptions {
  frequency: number;
  durationMs?: number;
  type?: OscillatorType;
  volume?: number;
  startDelayMs?: number;
}

interface SequenceEntry {
  frequency: number;
  durationMs: number;
  type?: OscillatorType;
  volume?: number;
}

interface SequenceOptions {
  gapMs?: number;
}

/**
 * Hook that provides managed tone playback via the shared AudioContext.
 * All oscillators are tracked and disconnected on cleanup.
 */
export function useTonePlayer() {
  const { getContext: getSharedContext } = useAudioContext();
  const activeNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);

  const getContext = useCallback((): AudioContext => {
    const ctx = getSharedContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }, [getSharedContext]);

  const playTone = useCallback(
    (opts: ToneOptions): void => {
      const ctx = getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = opts.type ?? 'sine';
      osc.frequency.value = opts.frequency;

      const vol = opts.volume ?? 0.25;
      const dur = Math.max(opts.durationMs ?? 600, 60);
      const delay = (opts.startDelayMs ?? 0) / 1000;
      const now = ctx.currentTime + delay;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.03);
      gain.gain.setValueAtTime(vol, now + dur / 1000 - 0.05);
      gain.gain.linearRampToValueAtTime(0, now + dur / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + dur / 1000 + 0.01);

      activeNodesRef.current.push({ osc, gain });
      osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch { /* already disconnected */ }
        activeNodesRef.current = activeNodesRef.current.filter((n) => n.osc !== osc);
      };
    },
    [getContext]
  );

  const playSequence = useCallback(
    (entries: SequenceEntry[], opts?: SequenceOptions): void => {
      const gap = opts?.gapMs ?? 100;
      let delay = 0;
      for (const entry of entries) {
        playTone({
          frequency: entry.frequency,
          durationMs: entry.durationMs,
          type: entry.type,
          volume: entry.volume,
          startDelayMs: delay,
        });
        delay += entry.durationMs + gap;
      }
    },
    [playTone]
  );

  const stopAll = useCallback(() => {
    for (const { osc, gain } of activeNodesRef.current) {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      } catch { /* already stopped */ }
    }
    activeNodesRef.current = [];
  }, []);

  useEffect(() => {
    return () => { stopAll(); };
  }, [stopAll]);

  return { playTone, playSequence, stopAll, cleanup: stopAll };
}
