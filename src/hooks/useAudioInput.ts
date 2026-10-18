/**
 * Shared React hook for microphone access and real-time audio analysis.
 *
 * SECURITY:
 * - Uses ONLY native Web Audio APIs (AudioContext, AnalyserNode, getUserMedia).
 * - No raw audio data is stored, transmitted, or logged.
 * - The microphone stream is released when the hook unmounts or the user stops.
 * - Exposes only derived metrics (frequency, RMS volume, clarity) — never raw samples.
 *
 * AUDIO LIFECYCLE:
 * - start() must be called from a user interaction (button tap).
 * - The PitchDetector.start() tears down any existing global audio resources
 *   before initializing new ones, preventing hardware contention.
 * - stop() disconnects all nodes, stops all media tracks, and closes the context.
 * - The useEffect cleanup ensures resources are freed even on unmount, calling
 *   the global teardown to free the hardware microphone slot for the next page.
 *
 * SILENCE DETECTION:
 * - Tracks consecutive silent frames (rms < threshold).
 * - After SILENCE_ALERT_FRAMES consecutive silent frames, sets isReceiving=false
 *   so the UI can show a "Checking for sound..." toast.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector, type PitchDetectionResult } from '@/lib/pitchDetector';
import { frequencyToNote } from '@/lib/notes';

export type MicPermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export interface AudioMetrics {
  frequency: number | null;
  clarity: number;
  /** Scaled RMS volume level (0–1) for display — raw RMS multiplied for visibility */
  volume: number;
  /** Raw RMS amplitude (0–1) before any scaling — useful for calibration */
  rawRms: number;
  noteLabel: string | null;
  cents: number | null;
  tuning: 'sharp' | 'flat' | 'in-tune' | null;
}

export interface UseAudioInputResult {
  permission: MicPermissionState;
  errorMessage: string | null;
  isActive: boolean;
  /** True when the mic is active AND receiving non-silent audio */
  isReceiving: boolean;
  metrics: AudioMetrics;
  start: () => Promise<void>;
  stop: () => void;
}

const IDLE_METRICS: AudioMetrics = {
  frequency: null,
  clarity: 0,
  volume: 0,
  rawRms: 0,
  noteLabel: null,
  cents: null,
  tuning: null,
};

/** RMS below this = silence */
const SILENCE_THRESHOLD = 0.01;
/** Consecutive silent frames before we flag "not receiving" */
const SILENCE_ALERT_FRAMES = 30;

export function useAudioInput(options?: {
  minFrequency?: number;
  maxFrequency?: number;
  onHardwareWarning?: () => void;
}): UseAudioInputResult {
  const [permission, setPermission] = useState<MicPermissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [metrics, setMetrics] = useState<AudioMetrics>(IDLE_METRICS);

  const detectorRef = useRef<PitchDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const silenceCountRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (detectorRef.current) {
      detectorRef.current.stop();
      detectorRef.current = null;
    }
    silenceCountRef.current = 0;
    setIsActive(false);
    setIsReceiving(false);
    setMetrics(IDLE_METRICS);
  }, []);

  const loop = useCallback(() => {
    if (!mountedRef.current || !detectorRef.current) return;

    const result: PitchDetectionResult = detectorRef.current.detectPitch();

    // Use the true RMS from the detector for volume
    const volume = Math.min(result.rms * 4, 1); // scale up for display

    let newMetrics: AudioMetrics = {
      frequency: result.frequency,
      clarity: result.clarity,
      volume,
      rawRms: result.rms,
      noteLabel: null,
      cents: null,
      tuning: null,
    };

    if (result.frequency && result.clarity > 0.4) {
      const info = frequencyToNote(result.frequency);
      if (info) {
        newMetrics = {
          ...newMetrics,
          noteLabel: info.fullLabel,
          cents: info.cents,
          tuning: info.tuning,
        };
      }
    }

    setMetrics(newMetrics);

    // Track silence: if rms is above threshold, we are receiving audio
    if (result.rms > SILENCE_THRESHOLD) {
      silenceCountRef.current = 0;
      setIsReceiving(true);
    } else {
      silenceCountRef.current += 1;
      if (silenceCountRef.current >= SILENCE_ALERT_FRAMES) {
        setIsReceiving(false);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    setPermission('requesting');
    setErrorMessage(null);

    try {
      const detector = new PitchDetector({
        minFrequency: options?.minFrequency ?? 70,
        maxFrequency: options?.maxFrequency ?? 1200,
        onHardwareWarning: options?.onHardwareWarning,
      });
      await detector.start();
      detectorRef.current = detector;
      setPermission('granted');
      setIsActive(true);
      setIsReceiving(false);
      silenceCountRef.current = 0;
      loop();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied')) {
        setPermission('denied');
      } else {
        setPermission('error');
      }
      setErrorMessage(message);
    }
  }, [loop, options?.minFrequency, options?.maxFrequency, options?.onHardwareWarning]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Force teardown to free the hardware microphone slot completely
      // so the next page can use it cleanly
      stop();
    };
  }, [stop]);

  return { permission, errorMessage, isActive, isReceiving, metrics, start, stop };
}
