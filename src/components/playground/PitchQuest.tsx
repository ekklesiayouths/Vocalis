/**
 * Vocalis Pitch Quest — a voice-controlled musical adventure mini-game.
 *
 * The player guides a character through a sequence of musical gates by
 * singing the correct notes. The first level uses Do-Re-Mi-Fa-Sol in
 * C major.
 *
 * Uses existing utilities:
 * - useAudioInput for microphone + pitch detection
 * - useTonePlayer for hearing target notes
 * - frequencyToNote / midiToFrequency from notes.ts
 * - pitchQuest.ts for all game logic (tested independently)
 *
 * RESOURCE CLEANUP: mic streams, RAF loops, timers, and audio nodes
 * are cleaned up on stop, unmount, and screen exit.
 *
 * SECURITY: No raw audio stored. No hardcoded scores. All pitch data
 * comes from real gameplay via useAudioInput.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Music, Mic, Square, Play, Pause, RotateCcw, Volume2,
  Trophy, ChevronRight, ChevronLeft, Hand, MapPin, Sparkles,
} from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { MicPermission } from '@/components/MicPermission';
import { midiToFrequency, midiToNoteName } from '@/lib/notes';
import {
  createLevel, assessPitch, updateHold, isHoldComplete,
  computeQuestScore, computeManualScore,
  DEFAULT_TOLERANCE_CENTS, DEFAULT_HOLD_MS, HOLD_TOLERANCE_CENTS,
  type QuestLevel, type PitchZone, type QuestScore, type HoldState,
} from '@/lib/pitchQuest';

type GamePhase = 'intro' | 'ready' | 'playing' | 'paused' | 'complete';
type GameMode = 'mic' | 'manual';

const QUEST_LEVEL: QuestLevel = createLevel(60, 'C Major');
const TOTAL_NOTES = QUEST_LEVEL.notes.length;
const GATE_SPACING = 100; // percentage units across the path

const ZONE_COLORS: Record<PitchZone, string> = {
  silent: 'bg-cream-400',
  below: 'bg-terracotta-DEFAULT',
  'near-below': 'bg-mustard-DEFAULT',
  'on-target': 'bg-sage-DEFAULT',
  'near-above': 'bg-mustard-DEFAULT',
  above: 'bg-terracotta-DEFAULT',
};

const ZONE_LABELS: Record<PitchZone, string> = {
  silent: 'Listening...',
  below: 'Too low',
  'near-below': 'Almost — a bit low',
  'on-target': 'On target!',
  'near-above': 'Almost — a bit high',
  above: 'Too high',
};

export function PitchQuest() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 70,
    maxFrequency: 1200,
  });

  const { playTone, cleanup: cleanupAudio } = useTonePlayer();

  const [phase, setPhase] = useState<GamePhase>('intro');
  const [mode, setMode] = useState<GameMode>('mic');
  const [currentNoteIdx, setCurrentNoteIdx] = useState(0);
  const [zone, setZone] = useState<PitchZone>('silent');
  const [centsDiff, setCentsDiff] = useState<number | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [characterPos, setCharacterPos] = useState(0);
  const [score, setScore] = useState<QuestScore | null>(null);
  const [notesAttempted, setNotesAttempted] = useState(0);
  const [matchedCents, setMatchedCents] = useState<number[]>([]);
  const [matchedHolds, setMatchedHolds] = useState<number[]>([]);

  // Refs for game loop
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;
  const holdStateRef = useRef<HoldState>({ holdMs: 0, lastOnTargetTime: null });
  const currentNoteIdxRef = useRef(0);
  const phaseRef = useRef<GamePhase>('intro');
  const modeRef = useRef<GameMode>('mic');
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const notesAttemptedRef = useRef(0);
  const matchedCentsRef = useRef<number[]>([]);
  const matchedHoldsRef = useRef<number[]>([]);

  // Keep refs in sync with state
  useEffect(() => { currentNoteIdxRef.current = currentNoteIdx; }, [currentNoteIdx]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ─── Game loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'mic') return;

    const loop = () => {
      if (phaseRef.current !== 'playing' || modeRef.current !== 'mic') return;

      const now = performance.now();
      const m = metricsRef.current;
      const targetNote = QUEST_LEVEL.notes[currentNoteIdxRef.current];
      const assessment = assessPitch(
        m.frequency, m.clarity, m.rawRms, targetNote.midi, DEFAULT_TOLERANCE_CENTS
      );

      setZone(assessment.zone);
      setCentsDiff(assessment.centsDiff);

      if (startTimeRef.current === null) {
        startTimeRef.current = now;
      }

      const isOnTarget = assessment.reliable &&
        Math.abs(assessment.centsDiff ?? 999) <= HOLD_TOLERANCE_CENTS;

      holdStateRef.current = updateHold(holdStateRef.current, isOnTarget, now);
      const holdPct = Math.min(100, (holdStateRef.current.holdMs / DEFAULT_HOLD_MS) * 100);
      setHoldProgress(holdPct);

      // Move character slightly toward gate when on target
      const basePos = (currentNoteIdxRef.current / TOTAL_NOTES) * 100;
      const targetPos = ((currentNoteIdxRef.current + 1) / TOTAL_NOTES) * 100;
      const moveFraction = holdPct / 100;
      setCharacterPos(basePos + (targetPos - basePos) * moveFraction * 0.8);

      if (isHoldComplete(holdStateRef.current.holdMs, DEFAULT_HOLD_MS)) {
        // Note matched!
        notesAttemptedRef.current += 1;
        matchedCentsRef.current.push(assessment.centsDiff ?? 50);
        matchedHoldsRef.current.push(holdStateRef.current.holdMs);

        holdStateRef.current = { holdMs: 0, lastOnTargetTime: null };
        setHoldProgress(0);

        if (currentNoteIdxRef.current >= TOTAL_NOTES - 1) {
          // Level complete
          const elapsed = startTimeRef.current ? now - startTimeRef.current : 0;
          const finalScore = computeQuestScore(
            notesAttemptedRef.current,
            matchedCentsRef.current.length,
            matchedCentsRef.current,
            matchedHoldsRef.current,
            elapsed
          );
          setScore(finalScore);
          setPhase('complete');
          stop();
          return;
        } else {
          setCurrentNoteIdx((prev) => prev + 1);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [phase, mode, stop]);

  // ─── Controls ───────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (mode === 'mic') {
      start();
    }
    setCurrentNoteIdx(0);
    currentNoteIdxRef.current = 0;
    holdStateRef.current = { holdMs: 0, lastOnTargetTime: null };
    setHoldProgress(0);
    setZone('silent');
    setCentsDiff(null);
    setCharacterPos(0);
    setScore(null);
    notesAttemptedRef.current = 0;
    matchedCentsRef.current = [];
    matchedHoldsRef.current = [];
    startTimeRef.current = null;
    setPhase('playing');
  }, [mode, start]);

  const handlePause = useCallback(() => {
    setPhase('paused');
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const handleResume = useCallback(() => {
    holdStateRef.current = { holdMs: 0, lastOnTargetTime: null };
    setPhase('playing');
  }, []);

  const handleRestart = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stop();
    cleanupAudio();
    setPhase('intro');
    setCurrentNoteIdx(0);
    currentNoteIdxRef.current = 0;
    setHoldProgress(0);
    setZone('silent');
    setCentsDiff(null);
    setCharacterPos(0);
    setScore(null);
    setNotesAttempted(0);
    notesAttemptedRef.current = 0;
    matchedCentsRef.current = [];
    matchedHoldsRef.current = [];
    holdStateRef.current = { holdMs: 0, lastOnTargetTime: null };
    startTimeRef.current = null;
  }, [stop, cleanupAudio]);

  const handleHearNote = useCallback(() => {
    const note = QUEST_LEVEL.notes[currentNoteIdx];
    playTone({
      frequency: midiToFrequency(note.midi),
      durationMs: 800,
      type: 'sine',
      volume: 0.25,
    });
  }, [currentNoteIdx, playTone]);

  // Manual mode: advance to next note
  const handleManualAdvance = useCallback(() => {
    const newIdx = currentNoteIdx + 1;
    setNotesAttempted(newIdx);
    if (newIdx >= TOTAL_NOTES) {
      const finalScore = computeManualScore(TOTAL_NOTES, TOTAL_NOTES);
      setScore(finalScore);
      setPhase('complete');
      setCharacterPos(100);
    } else {
      setCurrentNoteIdx(newIdx);
      setCharacterPos((newIdx / TOTAL_NOTES) * 100);
    }
  }, [currentNoteIdx]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      stop();
      cleanupAudio();
    };
  }, [stop, cleanupAudio]);

  // ─── Render ─────────────────────────────────────────────────────
  const currentNote = QUEST_LEVEL.notes[currentNoteIdx];
  const currentFreq = midiToFrequency(currentNote.midi);

  // ─── Intro screen ───────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-6 p-6 animate-fade-in">
        <div className="text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-DEFAULT shadow-paper-sm mx-auto mb-3">
            <Music className="h-8 w-8 text-cream-50" />
          </div>
          <h2 className="text-2xl font-bold text-charcoal">Vocalis Pitch Quest</h2>
          <p className="mt-2 text-sm text-charcoal-muted max-w-md">
            Guide your character through five musical gates by singing the right notes.
            The first level is Do-Re-Mi-Fa-Sol in C major. Hear each note, then match it with your voice!
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted text-center">Choose your mode</p>
          <button
            onClick={() => setMode('mic')}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              mode === 'mic'
                ? 'bg-sage-light border-sage-DEFAULT shadow-paper-sm'
                : 'bg-cream-50 border-cream-400 hover:bg-cream-200'
            }`}
          >
            <Mic className="h-5 w-5 text-sage-deep shrink-0" />
            <div>
              <p className="text-sm font-semibold text-charcoal">Microphone Mode</p>
              <p className="text-xs text-charcoal-muted">Sing to guide your character — real pitch detection</p>
            </div>
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              mode === 'manual'
                ? 'bg-mustard-light border-mustard-DEFAULT shadow-paper-sm'
                : 'bg-cream-50 border-cream-400 hover:bg-cream-200'
            }`}
          >
            <Hand className="h-5 w-5 text-mustard-deep shrink-0" />
            <div>
              <p className="text-sm font-semibold text-charcoal">Manual Practice Mode</p>
              <p className="text-xs text-charcoal-muted">No mic needed — does not measure singing accuracy</p>
            </div>
          </button>
        </div>

        {/* Mic permission if mic mode */}
        {mode === 'mic' && permission !== 'granted' && (
          <MicPermission
            permission={permission}
            errorMessage={errorMessage}
            onStart={start}
            isActive={isActive}
            isReceiving={isReceiving}
          />
        )}

        <button
          onClick={handleStart}
          disabled={mode === 'mic' && permission !== 'granted'}
          className="btn-primary max-w-xs w-full"
        >
          <Play className="h-4 w-4" /> Start Quest
        </button>

        {/* Instructions */}
        <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 max-w-sm w-full">
          <p className="text-xs font-bold uppercase tracking-wide text-sage-deep mb-2">How to Play</p>
          <ul className="flex flex-col gap-1.5 text-sm text-charcoal-light">
            <li className="flex gap-2"><span className="text-sage-deep font-bold">1.</span> Hear the target note with the Hear Note button</li>
            <li className="flex gap-2"><span className="text-sage-deep font-bold">2.</span> Sing the note and hold it briefly</li>
            <li className="flex gap-2"><span className="text-sage-deep font-bold">3.</span> Watch the feedback — too low, on target, or too high</li>
            <li className="flex gap-2"><span className="text-sage-deep font-bold">4.</span> Pass all five gates to complete the level!</li>
          </ul>
        </div>
      </div>
    );
  }

  // ─── Complete screen ─────────────────────────────────────────────
  if (phase === 'complete' && score) {
    return (
      <div className="flex flex-col items-center gap-6 p-6 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-sage-DEFAULT shadow-paper-lg mx-auto animate-fade-in">
          <Trophy className="h-10 w-10 text-cream-50" />
        </div>
        <h2 className="text-2xl font-bold text-charcoal">Quest Complete!</h2>

        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-center">
            <span className="text-3xl font-bold text-sage-deep">{score.score}</span>
            <div className="text-xs text-charcoal-muted">final score</div>
          </div>
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-center">
            <span className="text-3xl font-bold text-charcoal">{score.notesMatched}/{score.notesAttempted}</span>
            <div className="text-xs text-charcoal-muted">notes matched</div>
          </div>
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-center">
            <span className="text-xl font-bold text-charcoal">{score.avgCentsDeviation}</span>
            <div className="text-xs text-charcoal-muted">avg cents off</div>
          </div>
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-center">
            <span className="text-xl font-bold text-charcoal">{Math.round(score.avgHoldMs / 1000 * 10) / 10}s</span>
            <div className="text-xs text-charcoal-muted">avg hold time</div>
          </div>
        </div>

        <div className="rounded-xl bg-sage-light/40 border border-sage-DEFAULT/50 p-4 max-w-sm w-full text-center">
          <p className="text-sm text-charcoal">{score.summary}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={handleRestart} className="btn-primary">
            <RotateCcw className="h-4 w-4" /> Play Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Playing / paused screen ─────────────────────────────────────
  const basePos = (currentNoteIdx / TOTAL_NOTES) * 100;
  const targetGatePos = ((currentNoteIdx + 1) / TOTAL_NOTES) * 100;

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      {/* Header with note info */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-light border border-sage-DEFAULT">
            <span className="text-sm font-bold text-sage-deep">{currentNoteIdx + 1}/{TOTAL_NOTES}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-charcoal">{currentNote.label}</p>
            <p className="text-xs text-charcoal-muted">{midiToNoteName(currentNote.midi)} · {currentFreq.toFixed(1)} Hz</p>
          </div>
        </div>

        {/* Pause/Resume/Restart controls */}
        <div className="flex items-center gap-2">
          {phase === 'playing' && (
            <button onClick={handlePause} className="btn-secondary !px-3" title="Pause">
              <Pause className="h-4 w-4" />
            </button>
          )}
          {phase === 'paused' && (
            <button onClick={handleResume} className="btn-secondary !px-3" title="Resume">
              <Play className="h-4 w-4" />
            </button>
          )}
          <button onClick={handleRestart} className="btn-secondary !px-3" title="Restart">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Musical world — the path with gates */}
      <div className="relative w-full overflow-hidden rounded-2xl border-2 border-cream-400 bg-gradient-to-b from-sky-100 via-sage-light/30 to-sage-light/60" style={{ height: '260px' }}>
        {/* Ground path */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-sage-DEFAULT/30 to-transparent" />

        {/* Gates */}
        {QUEST_LEVEL.notes.map((note, i) => {
          const gatePos = ((i + 1) / TOTAL_NOTES) * 100;
          const isPassed = i < currentNoteIdx;
          const isCurrent = i === currentNoteIdx;
          return (
            <div
              key={i}
              className="absolute bottom-12 flex flex-col items-center transition-all duration-300"
              style={{ left: `${gatePos}%`, transform: 'translateX(-50%)' }}
            >
              {/* Gate */}
              <div
                className={`flex h-20 w-12 items-center justify-center rounded-t-lg border-2 transition-all duration-300 ${
                  isPassed
                    ? 'bg-sage-light border-sage-DEFAULT opacity-50'
                    : isCurrent
                      ? 'bg-mustard-light border-mustard-DEFAULT scale-110 shadow-paper-sm'
                      : 'bg-cream-100 border-cream-400'
                }`}
              >
                <span className={`text-xs font-bold ${isPassed ? 'text-sage-deep' : isCurrent ? 'text-mustard-deep' : 'text-charcoal-muted'}`}>
                  {note.solfege}
                </span>
              </div>
              {/* Gate base */}
              <div className={`h-2 w-14 rounded-full ${isPassed ? 'bg-sage-DEFAULT' : isCurrent ? 'bg-mustard-DEFAULT' : 'bg-cream-400'}`} />
            </div>
          );
        })}

        {/* Character — a musical note sprite */}
        <div
          className="absolute bottom-14 transition-all duration-200 ease-out"
          style={{ left: `${characterPos}%`, transform: 'translateX(-50%)' }}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-150 ${
            zone === 'on-target'
              ? 'bg-sage-DEFAULT border-sage-deep shadow-paper-sage scale-110'
              : zone === 'near-below' || zone === 'near-above'
                ? 'bg-mustard-light border-mustard-DEFAULT'
                : 'bg-cream-50 border-cream-400'
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={zone === 'on-target' ? '#fff' : '#5E8A56'}>
              <circle cx="6" cy="18" r="4" />
              <rect x="9" y="3" width="2" height="15" />
              <path d="M11 3 Q18 5 18 10 Q11 8 11 10" fill="none" stroke={zone === 'on-target' ? '#fff' : '#5E8A56'} strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Sparkles on target */}
        {zone === 'on-target' && (
          <div className="absolute bottom-16 animate-pulse" style={{ left: `${characterPos}%`, transform: 'translateX(-50%)' }}>
            <Sparkles className="h-5 w-5 text-sage-deep" />
          </div>
        )}
      </div>

      {/* Hold progress bar */}
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-charcoal-muted">Hold the note</span>
          <span className="text-xs text-charcoal-muted">{Math.round(holdProgress)}%</span>
        </div>
        <div className="h-3 rounded-full bg-cream-300 overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${holdProgress >= 100 ? 'bg-sage-DEFAULT' : 'bg-mustard-DEFAULT'}`}
            style={{ width: `${holdProgress}%` }}
          />
        </div>
      </div>

      {/* Pitch feedback indicator */}
      {mode === 'mic' && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${ZONE_COLORS[zone]}`} />
            <span className="text-sm font-medium text-charcoal">{ZONE_LABELS[zone]}</span>
            {centsDiff !== null && zone !== 'silent' && (
              <span className="text-xs text-charcoal-muted">
                {centsDiff > 0 ? '+' : ''}{centsDiff} cents
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={handleHearNote}
          className="btn-secondary"
        >
          <Volume2 className="h-4 w-4" /> Hear Note
        </button>

        {mode === 'mic' && phase === 'paused' ? (
          <button onClick={handleResume} className="btn-primary">
            <Play className="h-4 w-4" /> Resume
          </button>
        ) : mode === 'mic' && phase === 'playing' ? (
          <button onClick={handlePause} className="btn-terracotta">
            <Pause className="h-4 w-4" /> Pause
          </button>
        ) : null}

        {mode === 'manual' && (
          <button onClick={handleManualAdvance} className="btn-primary">
            <ChevronRight className="h-4 w-4" /> I Sang It — Next Note
          </button>
        )}
      </div>

      {/* Manual mode disclaimer */}
      {mode === 'manual' && (
        <div className="rounded-xl bg-mustard-light/40 border border-mustard-DEFAULT/40 p-3 text-center max-w-md mx-auto">
          <p className="text-xs text-mustard-deep">
            Manual practice mode — this does not measure your pitch accuracy.
            Try microphone mode for a real score.
          </p>
        </div>
      )}

      {/* Paused overlay */}
      {phase === 'paused' && (
        <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-center max-w-md mx-auto">
          <p className="text-sm font-semibold text-charcoal">Paused</p>
          <p className="text-xs text-charcoal-muted mt-1">Press Resume to continue your quest.</p>
        </div>
      )}
    </div>
  );
}
