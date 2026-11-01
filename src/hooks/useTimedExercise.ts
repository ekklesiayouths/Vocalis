import { useEffect, useRef, useState } from 'react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { midiToFrequency } from '@/lib/notes';
import {
  addSample,
  emptyStats,
  summarizeResult,
  type ExerciseResult,
  type ScoreStats,
  type VoiceReading,
} from '@/lib/warmupScoring';
import {
  REFERENCE_TONE_MS,
  pitchTargetAt,
  segmentIndexAt,
  type ExercisePlan,
} from '@/lib/warmupTiming';

export type ExerciseStatus = 'ready' | 'running' | 'paused' | 'done';

const SILENT_READING: VoiceReading = { frequency: null, clarity: 0, rms: 0 };
const UNSEEN_SEGMENT = -2;
const MAX_FRAME_MS = 100;

interface UseTimedExerciseOptions {
  plan: ExercisePlan;
  usesMic: boolean;
  usesPitch: boolean;
}

export function useTimedExercise({ plan, usesMic, usesPitch }: UseTimedExerciseOptions) {
  const mic = useAudioInput();
  const { playTone, stopAll } = useTonePlayer();
  const [status, setStatus] = useState<ExerciseStatus>('ready');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveReading, setLiveReading] = useState<VoiceReading>(SILENT_READING);
  const [result, setResult] = useState<ExerciseResult | null>(null);

  const elapsedRef = useRef(0);
  const statsRef = useRef<ScoreStats>(emptyStats);
  const segmentRef = useRef(UNSEEN_SEGMENT);
  const metricsRef = useRef<AudioMetrics>(mic.metrics);
  metricsRef.current = mic.metrics;
  const seenMetricsRef = useRef<AudioMetrics | null>(null);

  useEffect(() => {
    if (status !== 'running') return;
    let frame = 0;
    let last: number | null = null;

    const tick = (now: number) => {
      const dt = last === null ? 0 : Math.min(now - last, MAX_FRAME_MS);
      last = now;
      const ms = Math.min(elapsedRef.current + dt, plan.totalMs);
      elapsedRef.current = ms;

      const index = segmentIndexAt(plan.segments, ms);
      if (index !== segmentRef.current) {
        segmentRef.current = index;
        const segment = plan.segments[index];
        if (segment?.reference && segment.midi !== null) {
          playTone({ frequency: midiToFrequency(segment.midi), durationMs: REFERENCE_TONE_MS, volume: 0.22 });
        }
      }

      if (usesMic && usesPitch) {
        const metrics = metricsRef.current;
        if (metrics !== seenMetricsRef.current) {
          seenMetricsRef.current = metrics;
          const reading: VoiceReading = {
            frequency: metrics.frequency,
            clarity: metrics.clarity,
            rms: metrics.rawRms,
          };
          statsRef.current = addSample(statsRef.current, pitchTargetAt(plan, ms), reading);
          setLiveReading(reading);
        }
      }

      setElapsedMs(ms);

      if (ms >= plan.totalMs) {
        stopAll();
        setLiveReading(SILENT_READING);
        setResult(summarizeResult(statsRef.current, usesPitch, ms));
        setStatus('done');
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, plan, usesMic, usesPitch, playTone, stopAll]);

  const resetRun = () => {
    elapsedRef.current = 0;
    statsRef.current = emptyStats;
    segmentRef.current = UNSEEN_SEGMENT;
    seenMetricsRef.current = null;
    setElapsedMs(0);
    setLiveReading(SILENT_READING);
    setResult(null);
  };

  return {
    mic,
    status,
    elapsedMs,
    liveReading,
    result,
    begin: () => {
      if (status !== 'ready') return;
      setStatus('running');
    },
    pause: () => {
      if (status !== 'running') return;
      stopAll();
      setLiveReading(SILENT_READING);
      setStatus('paused');
    },
    resume: () => {
      if (status !== 'paused') return;
      setStatus('running');
    },
    restart: () => {
      stopAll();
      resetRun();
      setStatus('ready');
    },
  };
}
