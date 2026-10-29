import { useCallback, useEffect, useRef } from 'react';
import { useAudioInput } from '@/hooks/useAudioInput';
import type { PitchSample } from '@/lib/vocalBlueprint';

/**
 * Wraps useAudioInput and records per-frame readings only while a capture is
 * open. Only derived pitch readings are kept; no raw audio is stored.
 */
export function useVoiceSampler() {
  const audio = useAudioInput();
  const captureRef = useRef<PitchSample[] | null>(null);

  useEffect(() => {
    const buffer = captureRef.current;
    if (!buffer || !audio.isActive) return;
    buffer.push({
      t: performance.now(),
      frequency: audio.metrics.frequency,
      clarity: audio.metrics.clarity,
      rms: audio.metrics.rawRms,
    });
  }, [audio.metrics, audio.isActive]);

  const beginCapture = useCallback(() => {
    captureRef.current = [];
  }, []);

  const endCapture = useCallback((): PitchSample[] => {
    const samples = captureRef.current ?? [];
    captureRef.current = null;
    return samples;
  }, []);

  return { ...audio, beginCapture, endCapture };
}

export type VoiceSampler = ReturnType<typeof useVoiceSampler>;
