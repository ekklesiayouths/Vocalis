/**
 * Scale Degrees Game — Pitch & Ear Precision (Foundation)
 *
 * Plays a C Major cadence (I-IV-V-I) then a mystery note from the scale.
 * User clicks one of 7 numbered stepping stones to identify the degree.
 *
 * SECURITY: Quiz state in React. Score via submitScore RPC.
 * Audio via useTonePlayer (native, cleaned up on unmount).
 */

import { useCallback, useRef, useState } from 'react';
import { Music, Volume2, RotateCcw, Check, X, Lightbulb, ArrowRight } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';
import { TutorChat } from '@/components/TutorChat';
import { midiToFrequency } from '@/lib/notes';

type Phase = 'ready' | 'listening' | 'answered' | 'complete';

const C4 = 60;
const SCALE_DEGREES = [0, 2, 4, 5, 7, 9, 11];

const DEGREE_NAMES = ['Tonic (1)', 'Supertonic (2)', 'Mediant (3)', 'Subdominant (4)', 'Dominant (5)', 'Submediant (6)', 'Leading Tone (7)'];

interface ScaleQuestion {
  degree: number;
  octave: number;
}

const QUESTIONS: ScaleQuestion[] = [
  { degree: 0, octave: 0 },
  { degree: 4, octave: 0 },
  { degree: 2, octave: 0 },
  { degree: 6, octave: 0 },
  { degree: 5, octave: 0 },
  { degree: 1, octave: 0 },
  { degree: 3, octave: 0 },
];

export function ScaleDegrees() {
  const { playSequence, cleanup } = useTonePlayer();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showTutor, setShowTutor] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const startTimeRef = useRef(Date.now());

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;
  const isCorrect = selected === question.degree;

  const playCadence = useCallback(() => {
    playSequence([
      { frequency: midiToFrequency(C4), durationMs: 300, type: 'triangle', volume: 0.18 },
      { frequency: midiToFrequency(C4 + 5), durationMs: 300, type: 'triangle', volume: 0.18 },
      { frequency: midiToFrequency(C4 + 7), durationMs: 300, type: 'triangle', volume: 0.18 },
      { frequency: midiToFrequency(C4 + 12), durationMs: 400, type: 'triangle', volume: 0.18 },
    ], { gapMs: 80 });
  }, [playSequence]);

  const playMysteryNote = useCallback(() => {
    const midi = C4 + SCALE_DEGREES[question.degree] + question.octave * 12;
    playSequence([{ frequency: midiToFrequency(midi), durationMs: 600, type: 'sine', volume: 0.22 }]);
  }, [playSequence, question]);

  const handleStart = useCallback(() => {
    setPhase('listening');
    startTimeRef.current = Date.now();
    setTimeout(() => playCadence(), 300);
    setTimeout(() => playMysteryNote(), 300 + 4 * 380 + 400);
  }, [playCadence, playMysteryNote]);

  const handleReplay = useCallback(() => {
    playCadence();
    setTimeout(() => playMysteryNote(), 4 * 380 + 400);
  }, [playCadence, playMysteryNote]);

  const handleAnswer = useCallback((degree: number) => {
    if (phase !== 'listening') return;
    setSelected(degree);
    if (degree === question.degree) setCorrectCount((c) => c + 1);
    setPhase('answered');
  }, [phase, question]);

  const handleNext = useCallback(async () => {
    if (isLast) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const accuracy = Math.round((correctCount / QUESTIONS.length) * 100);
      const result = await submitScore('Scale Degrees', accuracy, elapsed);
      setScoreResult(result);
      setPhase('complete');
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setPhase('listening');
      setTimeout(() => playCadence(), 200);
      setTimeout(() => playMysteryNote(), 200 + 4 * 380 + 400);
    }
  }, [isLast, correctCount, playCadence, playMysteryNote]);

  const handleRestart = useCallback(() => {
    cleanup();
    setIndex(0); setSelected(null); setCorrectCount(0);
    setPhase('listening'); setShowTutor(false); setScoreResult(null);
    startTimeRef.current = Date.now();
  }, [cleanup]);

  const tutorContext = selected !== null
    ? `Quiz: Scale Degrees (C Major)\nmystery note: degree ${question.degree + 1} (${DEGREE_NAMES[question.degree]})\nuser answered: degree ${selected + 1} (${DEGREE_NAMES[selected] ?? `Tone ${selected + 1}`})\ncorrect: ${isCorrect}`
    : '';

  if (phase === 'complete') {
    const accuracy = Math.round((correctCount / QUESTIONS.length) * 100);
    return (
      <div className="card flex flex-col items-center gap-6 p-8 text-center animate-scale-in">
        <h2 className="text-2xl font-bold text-charcoal">Scale Degrees Complete!</h2>
        <span className="text-5xl font-bold text-mustard-DEFAULT">{accuracy}%</span>
        <span className="text-charcoal-muted">{correctCount} of {QUESTIONS.length} correct</span>
        {scoreResult && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${scoreResult.success ? 'bg-sage-light border-sage-DEFAULT text-sage-deep' : 'bg-terracotta-light border-terracotta-DEFAULT text-terracotta-deep'}`}>
            {scoreResult.success ? `Score saved! +${scoreResult.xpEarned} XP earned` : `Could not save score: ${scoreResult.error}`}
          </div>
        )}
        <button onClick={handleRestart} className="btn-primary max-w-xs w-full">
          <RotateCcw className="h-5 w-5" /> Try Again
        </button>
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="card flex flex-col items-center gap-6 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-light border border-sage-DEFAULT shadow-paper-sm">
          <Music className="h-7 w-7 text-sage-deep" />
        </div>
        <h3 className="text-xl font-bold text-charcoal">Scale Degrees</h3>
        <p className="max-w-sm text-sm text-charcoal-muted">
          You'll hear a C Major cadence to establish the key, then a mystery note. Click the stepping stone that matches its position in the scale!
        </p>
        <button onClick={handleStart} className="btn-primary max-w-xs w-full">
          <Volume2 className="h-5 w-5" /> Begin
        </button>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-sage-deep" />
          <h3 className="font-semibold text-charcoal">Which stepping stone is it?</h3>
        </div>
        <span className="text-sm text-charcoal-muted">{index + 1}/{QUESTIONS.length}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-cream-300">
        <div className="h-full rounded-full bg-sage-DEFAULT transition-all duration-500" style={{ width: `${((index + (phase === 'answered' ? 1 : 0)) / QUESTIONS.length) * 100}%` }} />
      </div>

      <button onClick={handleReplay} className="btn-secondary w-full" disabled={phase === 'answered'}>
        <Volume2 className="h-5 w-5" /> Replay Cadence & Mystery Note
      </button>

      {/* 7 stepping stones */}
      <div className="flex items-end justify-center gap-2 sm:gap-3 py-4">
        {SCALE_DEGREES.map((_, i) => {
          const isSel = selected === i;
          const isRight = i === question.degree;
          const show = phase === 'answered';
          const offset = [0, -4, -8, -12, -8, -4, 0][i];
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={phase === 'answered'}
              style={{ marginBottom: offset }}
              className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 font-bold text-lg transition-all ${
                show
                  ? isRight ? 'border-sage-DEFAULT bg-sage-light text-sage-deep shadow-paper-sage' : isSel ? 'border-terracotta-DEFAULT bg-terracotta-light text-terracotta-deep' : 'border-cream-400 bg-cream-50 text-charcoal-muted'
                  : 'border-cream-400 bg-cream-50 text-charcoal hover:border-sage-DEFAULT hover:bg-cream-200 hover:-translate-y-1 active:translate-y-0'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {phase === 'answered' && (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className={`rounded-xl px-4 py-2 text-sm font-medium ${isCorrect ? 'bg-sage-light text-sage-deep' : 'bg-terracotta-light text-terracotta-deep'}`}>
            {isCorrect ? 'Perfect ear!' : `That was Tone ${question.degree + 1} — ${DEGREE_NAMES[question.degree]}.`}
          </div>
          {!isCorrect && (
            <button onClick={() => setShowTutor(true)} className="btn-terracotta">
              <Lightbulb className="h-5 w-5" /> Why?
            </button>
          )}
          <button onClick={handleNext} className="btn-primary max-w-xs w-full">
            {isLast ? 'Finish' : 'Next'} <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {showTutor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-sm p-4" onClick={() => setShowTutor(false)}>
          <div className="card max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-paper-lg animate-scale-in scrollbar-hide" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-mustard-DEFAULT" />
              <h3 className="text-lg font-bold text-charcoal">Let's Learn</h3>
            </div>
            <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 mb-4 text-sm text-charcoal-light space-y-2">
              <p>You answered: <span className="font-medium text-terracotta-deep">Tone {selected! + 1}</span></p>
              <p>Correct: <span className="font-medium text-sage-deep">Tone {question.degree + 1} — {DEGREE_NAMES[question.degree]}</span></p>
              <p>{question.degree === 0 ? 'Tone 1 is the tonic — "Do" — the home note. It feels like rest.' : question.degree === 4 ? 'Tone 5 is the dominant — "Sol". It wants to resolve home.' : question.degree === 6 ? 'Tone 7 is the leading tone — "Ti". It pulls strongly upward to the tonic.' : `Tone ${question.degree + 1} is ${DEGREE_NAMES[question.degree]}. Practice singing the scale (Do-Re-Mi-Fa-Sol-La-Ti-Do) to internalize each degree.`}</p>
            </div>
            <TutorChat context={tutorContext} />
            <button onClick={() => setShowTutor(false)} className="btn-secondary w-full mt-4">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
