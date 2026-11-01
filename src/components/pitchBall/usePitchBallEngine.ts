import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { PitchDetector, type PitchDetectionResult } from '@/lib/pitchDetector';
import { frequencyToNote, midiToNoteName, midiToFrequency } from '@/lib/notes';
import { createLevel, isHoldComplete, updateHold, type HoldState } from '@/lib/pitchQuest';
import {
  BALL_X, GATE_PASS_POINTS, GATE_SPACING, INITIAL_TRACK, LIVES_START, MATCH_HOLD_MS, NOTE_MATCH_POINTS,
  clamp01, freqToMidi, gateHeightFor, isNoteOnTarget, isReliableReading, judgeGate, levelFor, midiToY,
  clampGapY, smoothY, speedFor, trackPitch, type Gate, type TrackState, type VoiceRange,
} from '@/lib/pitchBall';
import { fitCanvas, drawPitchBall, type SceneState } from '@/components/pitchBall/drawPitchBall';

export type GameMode = 'arcade' | 'music';
export type InputSource = 'mic' | 'keys';
export type GamePhase = 'ready' | 'playing' | 'paused' | 'over';
export type TrackStatus = 'keys' | 'no-mic' | 'receiving' | 'holding' | 'rejecting-jump' | 'silent';

export interface PitchBallHud {
  phase: GamePhase;
  score: number;
  lives: number;
  level: number;
  gatesPassed: number;
  gatesResolved: number;
  noteMatches: number;
  noteChallenges: number;
  micRunning: boolean;
  micError: string | null;
  trackStatus: TrackStatus;
  frequency: number | null;
  noteLabel: string | null;
  clarity: number;
  rawRms: number;
  ballY: number;
  targetLabel: string | null;
  flash: 'pass' | 'hit' | null;
}

export interface EngineOptions {
  mode: GameMode;
  input: InputSource;
  range: VoiceRange | null;
  playTone: (frequency: number, durationMs: number) => void;
}

interface World {
  ballY: number;
  keyTarget: number;
  gates: Gate[];
  nextId: number;
  scroll: number;
  score: number;
  lives: number;
  gatesPassed: number;
  gatesResolved: number;
  noteChallenges: number;
  noteMatches: number;
  activeId: number | null;
  matchedIds: Set<number>;
  matchHold: HoldState;
  matchReadyAt: number;
  track: TrackState;
  trackStatus: TrackStatus;
  flash: { kind: 'pass' | 'hit'; age: number } | null;
}

const EMPTY_READING: PitchDetectionResult = { frequency: null, clarity: 0, rms: 0 };
const FRESH_HOLD: HoldState = { holdMs: 0, lastOnTargetTime: null };
const KEY_SPEED = 0.8;
const TONE_CLEAR_MS = 900;
const REFERENCE_TONE_MS = 700;
const CUE_TONE_MS = 220;
const PASS_CUE_HZ = 880;
const HIT_CUE_HZ = 220;
const HUD_INTERVAL_MS = 120;
const SPAWN_X = 1.5;
const NOTE_CYCLE = createLevel(60, 'C Major').notes;

function createGate(id: number, level: number, mode: GameMode, range: VoiceRange | null): Gate {
  const gapH = gateHeightFor(level);
  if (mode === 'music') {
    const note = NOTE_CYCLE[id % NOTE_CYCLE.length];
    return {
      id,
      x: SPAWN_X,
      gapY: clampGapY(range ? midiToY(note.midi, range) : 0.5, gapH),
      gapH,
      noteMidi: note.midi,
      noteLabel: `${note.solfege} · ${midiToNoteName(note.midi)}`,
      resolved: false,
      passed: false,
    };
  }
  return {
    id,
    x: SPAWN_X,
    gapY: clampGapY(0.15 + Math.random() * 0.7, gapH),
    gapH,
    noteMidi: null,
    noteLabel: null,
    resolved: false,
    passed: false,
  };
}

function freshWorld(): World {
  return {
    ballY: 0.5,
    keyTarget: 0.5,
    gates: [],
    nextId: 1,
    scroll: 0,
    score: 0,
    lives: LIVES_START,
    gatesPassed: 0,
    gatesResolved: 0,
    noteChallenges: 0,
    noteMatches: 0,
    activeId: null,
    matchedIds: new Set(),
    matchHold: FRESH_HOLD,
    matchReadyAt: 0,
    track: INITIAL_TRACK,
    trackStatus: 'silent',
    flash: null,
  };
}

export function usePitchBallEngine(canvasRef: RefObject<HTMLCanvasElement>, options: EngineOptions) {
  const optsRef = useRef(options);
  optsRef.current = options;
  const worldRef = useRef<World>(freshWorld());
  const phaseRef = useRef<GamePhase>('ready');
  const detectorRef = useRef<PitchDetector | null>(null);
  const readingRef = useRef<PitchDetectionResult>(EMPTY_READING);
  const micErrorRef = useRef<string | null>(null);
  const keyDirRef = useRef<-1 | 0 | 1>(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastHudRef = useRef(0);
  const [hud, setHud] = useState<PitchBallHud | null>(null);

  const snapshot = useCallback((): PitchBallHud => {
    const w = worldRef.current;
    const r = readingRef.current;
    const active = w.gates.find((g) => g.id === w.activeId);
    return {
      phase: phaseRef.current,
      score: w.score,
      lives: w.lives,
      level: levelFor(w.gatesPassed),
      gatesPassed: w.gatesPassed,
      gatesResolved: w.gatesResolved,
      noteMatches: w.noteMatches,
      noteChallenges: w.noteChallenges,
      micRunning: detectorRef.current !== null,
      micError: micErrorRef.current,
      trackStatus: w.trackStatus,
      frequency: r.frequency,
      noteLabel: r.frequency ? frequencyToNote(r.frequency)?.fullLabel ?? null : null,
      clarity: r.clarity,
      rawRms: r.rms,
      ballY: w.ballY,
      targetLabel: active?.noteLabel ?? null,
      flash: w.flash?.kind ?? null,
    };
  }, []);

  const publish = useCallback(() => setHud(snapshot()), [snapshot]);

  const releaseMic = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
  }, []);

  const ensureMic = useCallback(async () => {
    if (detectorRef.current?.isRunning) return;
    const detector = new PitchDetector({ minFrequency: 70, maxFrequency: 1200 });
    try {
      await detector.start();
      detectorRef.current = detector;
      micErrorRef.current = null;
    } catch (err) {
      detector.stop();
      micErrorRef.current = err instanceof Error ? err.message : 'Could not access the microphone.';
      throw err;
    }
  }, []);

  const stepBall = (w: World, reading: PitchDetectionResult, dt: number) => {
    const o = optsRef.current;
    if (o.input === 'keys') {
      w.keyTarget = clamp01(w.keyTarget + keyDirRef.current * KEY_SPEED * (dt / 1000));
      w.ballY = smoothY(w.ballY, w.keyTarget, dt);
      w.trackStatus = 'keys';
      return;
    }
    if (!detectorRef.current || !o.range) {
      w.trackStatus = 'no-mic';
      return;
    }
    const reliable = isReliableReading(reading.frequency, reading.clarity, reading.rms);
    const midi = reliable && reading.frequency ? freqToMidi(reading.frequency) : null;
    const next = trackPitch(w.track, midi);
    w.trackStatus = midi === null
      ? (next.acceptedMidi === null ? 'silent' : 'holding')
      : (next.candidateMidi !== null ? 'rejecting-jump' : 'receiving');
    w.track = next;
    if (next.acceptedMidi !== null) {
      w.ballY = smoothY(w.ballY, midiToY(next.acceptedMidi, o.range), dt);
    }
  };

  const stepMusicMatch = (w: World, reading: PitchDetectionResult, ts: number) => {
    const o = optsRef.current;
    if (o.mode !== 'music') return;
    const active = w.gates
      .filter((g) => !g.resolved && g.noteMidi !== null && g.x > BALL_X)
      .sort((a, b) => a.x - b.x)[0];
    if (!active || active.noteMidi === null) {
      w.activeId = null;
      return;
    }
    if (w.activeId !== active.id) {
      w.activeId = active.id;
      w.noteChallenges += 1;
      w.matchHold = FRESH_HOLD;
      w.matchReadyAt = ts + TONE_CLEAR_MS;
      o.playTone(midiToFrequency(active.noteMidi), REFERENCE_TONE_MS);
    }
    if (w.matchedIds.has(active.id) || ts < w.matchReadyAt) return;
    const onTarget = isNoteOnTarget(reading.frequency, reading.clarity, reading.rms, active.noteMidi);
    w.matchHold = updateHold(w.matchHold, onTarget, ts);
    if (isHoldComplete(w.matchHold.holdMs, MATCH_HOLD_MS)) {
      w.matchedIds.add(active.id);
      w.noteMatches += 1;
      w.score += NOTE_MATCH_POINTS;
      w.matchHold = FRESH_HOLD;
    }
  };

  const stepWorld = (w: World, reading: PitchDetectionResult, dt: number, ts: number) => {
    const o = optsRef.current;
    const seconds = dt / 1000;
    const step = speedFor(levelFor(w.gatesPassed)) * seconds;
    w.scroll += step;
    for (const gate of w.gates) gate.x -= step;

    const last = w.gates[w.gates.length - 1];
    if (!last || last.x <= SPAWN_X - GATE_SPACING) {
      w.gates.push(createGate(w.nextId, levelFor(w.gatesPassed), o.mode, o.range));
      w.nextId += 1;
    }

    stepMusicMatch(w, reading, ts);

    for (const gate of w.gates) {
      if (gate.resolved || gate.x > BALL_X) continue;
      gate.resolved = true;
      gate.passed = judgeGate(w.ballY, gate);
      w.gatesResolved += 1;
      if (gate.passed) {
        w.gatesPassed += 1;
        w.score += GATE_PASS_POINTS;
      } else {
        w.lives -= 1;
      }
      w.flash = { kind: gate.passed ? 'pass' : 'hit', age: 0 };
      if (o.input === 'keys') o.playTone(gate.passed ? PASS_CUE_HZ : HIT_CUE_HZ, CUE_TONE_MS);
    }
    w.gates = w.gates.filter((g) => g.x > -0.3);

    if (w.flash) {
      w.flash.age += seconds;
      if (w.flash.age > 0.6) w.flash = null;
    }
  };

  const drawFrame = (ts: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const { width, height } = fitCanvas(canvas);
      const w = worldRef.current;
      const o = optsRef.current;
      const active = w.gates.find((g) => g.id === w.activeId);
      const scene: SceneState = {
        ballY: w.ballY,
        gates: w.gates,
        scroll: w.scroll,
        flash: w.flash,
        showTarget: active && active.noteMidi !== null && o.range
          ? { y: midiToY(active.noteMidi, o.range), label: active.noteLabel ?? '' }
          : null,
      };
      drawPitchBall(ctx, width, height, scene);
    }
    if (ts - lastHudRef.current >= HUD_INTERVAL_MS) {
      lastHudRef.current = ts;
      publish();
    }
  };

  const frame = (ts: number) => {
    const w = worldRef.current;
    const dt = lastTsRef.current === null ? 16 : Math.min(ts - lastTsRef.current, 50);
    lastTsRef.current = ts;

    const reading = detectorRef.current ? detectorRef.current.detectPitch() : EMPTY_READING;
    readingRef.current = reading;

    if (phaseRef.current === 'playing') {
      stepBall(w, reading, dt);
      stepWorld(w, reading, dt, ts);
      if (w.lives <= 0) {
        phaseRef.current = 'over';
        releaseMic();
        publish();
      }
    }

    drawFrame(ts);
    rafRef.current = requestAnimationFrame(frame);
  };

  const startLoop = () => {
    if (rafRef.current !== null) return;
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(frame);
  };

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const start = async () => {
    if (optsRef.current.input === 'mic') {
      try {
        await ensureMic();
      } catch {
        publish();
        return;
      }
    }
    worldRef.current = freshWorld();
    phaseRef.current = 'playing';
    startLoop();
    publish();
  };

  const pause = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'paused';
    publish();
  }, [publish]);

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    phaseRef.current = 'playing';
    publish();
  }, [publish]);

  const restart = async () => {
    worldRef.current = freshWorld();
    if (optsRef.current.input === 'mic' && !detectorRef.current) {
      try {
        await ensureMic();
      } catch {
        publish();
        return;
      }
    }
    phaseRef.current = 'playing';
    startLoop();
    publish();
  };

  const stop = useCallback(() => {
    stopLoop();
    releaseMic();
    phaseRef.current = 'ready';
    worldRef.current = freshWorld();
    publish();
  }, [publish, releaseMic, stopLoop]);

  const nudge = useCallback((direction: -1 | 0 | 1) => {
    keyDirRef.current = direction;
  }, []);

  const setPointerY = useCallback((y: number | null) => {
    if (y === null) {
      keyDirRef.current = 0;
      return;
    }
    worldRef.current.keyTarget = clamp01(y);
  }, []);

  const measureNote = useCallback((durationMs: number) => new Promise<number[]>((resolve, reject) => {
    const detector = detectorRef.current;
    if (!detector) {
      reject(new Error('The microphone is not running.'));
      return;
    }
    const samples: number[] = [];
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const r = detector.detectPitch();
      if (isReliableReading(r.frequency, r.clarity, r.rms) && r.frequency) {
        samples.push(freqToMidi(r.frequency));
      }
      if (performance.now() - startedAt >= durationMs) {
        window.clearInterval(timer);
        resolve(samples);
      }
    }, 40);
  }), []);

  useEffect(() => {
    publish();
    return () => {
      stopLoop();
      releaseMic();
    };
  }, [publish, releaseMic, stopLoop]);

  return { hud, start, pause, resume, restart, stop, nudge, setPointerY, ensureMic, releaseMic, measureNote };
}
