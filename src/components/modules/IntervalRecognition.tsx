/**
 * Interval Recognition Game — Pitch & Ear Precision (Beginner)
 *
 * Game Logic: Plays a root note (C4) then a second note. User identifies
 * the interval: Major 2nd, Major 3rd, Perfect 5th, or Perfect Octave.
 *
 * UI: Cozy paper scorecard with 4 tactile option cards.
 * Correct: sage green celebration. Wrong: dusty rose "Why?" button → AI tutor.
 *
 * SECURITY: All quiz state in React. Score via submitScore RPC.
 * Audio via useTonePlayer (native Web Audio, cleaned up on unmount).
 */

import { useCallback, useRef, useState } from 'react';
import { Ear, Volume2, RotateCcw, Check, X, Lightbulb, ArrowRight } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';
import { TutorChat } from '@/components/TutorChat';
import { midiToFrequency } from '@/lib/notes';

type Phase = 'ready' | 'listening' | 'answered' | 'complete';

interface IntervalQuestion {
  rootMidi: number;
  targetMidi: number;
  correctAnswer: string;
  options: string[];
  intervalName: string;
  semitones: number;
}

const C4_MIDI = 60;

const QUESTIONS: IntervalQuestion[] = [
  { rootMidi: C4_MIDI, targetMidi: C4_MIDI + 2, correctAnswer: 'Step Up (2nd)', options: ['Step Up (2nd)', 'Skip Up (3rd)', 'Perfect 5th', 'The Sky (Octave)'], intervalName: 'Major 2nd', semitones: 2 },
  { rootMidi: C4_MIDI, targetMidi: C4_MIDI + 4, correctAnswer: 'Skip Up (3rd)', options: ['Step Up (2nd)', 'Skip Up (3rd)', 'Perfect 5th', 'The Sky (Octave)'], intervalName: 'Major 3rd', semitones: 4 },
  { rootMidi: C4_MIDI, targetMidi: C4_MIDI + 7, correctAnswer: 'Perfect 5th', options: ['Step Up (2nd)', 'Skip Up (3rd)', 'Perfect 5th', 'The Sky (Octave)'], intervalName: 'Perfect 5th', semitones: 7 },
  { rootMidi: C4_MIDI, targetMidi: C4_MIDI + 12, correctAnswer: 'The Sky (Octave)', options: ['Step Up (2nd)', 'Skip Up (3rd)', 'Perfect 5th', 'The Sky (Octave)'], intervalName: 'Perfect Octave', semitones: 12 },
  { rootMidi: C4_MIDI, targetMidi: C4_MIDI - 5, correctAnswer: 'Perfect 5th', options: ['Step Up (2nd)', 'Skip Up (3rd)', 'Perfect 5th', 'The Sky (Octave)'], intervalName: 'Perfect 5th (descending, F4 below C4)', semitones: 7 },
  { rootMidi: C4_MIDI, targetMidi: C4_MIDI - 9, correctAnswer: 'The Sky (Octave)', options: ['Step Up (2nd)', 'Skip Up (3rd)', 'Perfect 5th', 'The Sky (Octave)'], intervalName: 'Major 6th (descending, E3 below C4)', semitones: 9 },
];

export function IntervalRecognition() {
  const { playSequence, cleanup } = useTonePlayer();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showTutor, setShowTutor] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const startTimeRef = useRef(Date.now());

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;
  const isCorrect = selected === question.correctAnswer;

  const playInterval = useCallback(() => {
    playSequence([
      { frequency: midiToFrequency(question.rootMidi), durationMs: 500, type: 'triangle', volume: 0.2 },
      { frequency: midiToFrequency(question.targetMidi), durationMs: 600, type: 'triangle', volume: 0.2 },
    ], { gapMs: 200 });
  }, [playSequence, question]);

  const handleAnswer = useCallback((answer: string) => {
    if (phase !== 'listening') return;
    setSelected(answer);
    if (answer === question.correctAnswer) setCorrectCount((c) => c + 1);
    setPhase('answered');
  }, [phase, question]);

  const handleNext = useCallback(async () => {
    if (isLast) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const accuracy = Math.round((correctCount / QUESTIONS.length) * 100);
      const result = await submitScore('Interval Recognition', accuracy, elapsed);
      setScoreResult(result);
      setPhase('complete');
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setPhase('listening');
    }
  }, [isLast, correctCount]);

  const handleRestart = useCallback(() => {
    cleanup();
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setPhase('listening');
    setShowTutor(false);
    setScoreResult(null);
    startTimeRef.current = Date.now();
  }, [cleanup]);

  const handleStart = useCallback(() => {
    setPhase('listening');
    startTimeRef.current = Date.now();
    // Auto-play the first interval so the user hears something immediately
    setTimeout(() => {
      playSequence([
        { frequency: midiToFrequency(QUESTIONS[0].rootMidi), durationMs: 500, type: 'triangle', volume: 0.2 },
        { frequency: midiToFrequency(QUESTIONS[0].targetMidi), durationMs: 600, type: 'triangle', volume: 0.2 },
      ], { gapMs: 200 });
    }, 300);
  }, [playSequence]);

  const tutorContext = selected
    ? `Quiz: Interval Recognition\nroot: C4\ntarget interval: ${question.intervalName} (${question.semitones} semitones)\nuser answered: ${selected}\ncorrect answer: ${question.correctAnswer}`
    : '';

  if (phase === 'complete') {
    const accuracy = Math.round((correctCount / QUESTIONS.length) * 100);
    return (
      <div className="card flex flex-col items-center gap-6 p-8 text-center animate-scale-in">
        <h2 className="text-2xl font-bold text-charcoal">Interval Training Complete!</h2>
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
          <Ear className="h-7 w-7 text-sage-deep" />
        </div>
        <h3 className="text-xl font-bold text-charcoal">Interval Recognition</h3>
        <p className="max-w-sm text-sm text-charcoal-muted">
          You'll hear two notes. Identify what step the music took — a small step, a skip, a leap, or the full sky!
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
          <Ear className="h-5 w-5 text-sage-deep" />
          <h3 className="font-semibold text-charcoal">What step did the music take?</h3>
        </div>
        <span className="text-sm text-charcoal-muted">{index + 1}/{QUESTIONS.length}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-cream-300">
        <div className="h-full rounded-full bg-sage-DEFAULT transition-all duration-500" style={{ width: `${((index + (phase === 'answered' ? 1 : 0)) / QUESTIONS.length) * 100}%` }} />
      </div>

      <button onClick={playInterval} className="btn-secondary w-full" disabled={phase === 'answered'}>
        <Volume2 className="h-5 w-5" /> Play Interval Again
      </button>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options.map((opt) => {
          const isSel = selected === opt;
          const isRight = opt === question.correctAnswer;
          const show = phase === 'answered';
          return (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              disabled={phase === 'answered'}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3.5 font-medium transition-all ${
                show
                  ? isRight ? 'border-sage-DEFAULT bg-sage-light text-sage-deep' : isSel ? 'border-terracotta-DEFAULT bg-terracotta-light text-terracotta-deep' : 'border-cream-400 bg-cream-50 text-charcoal-muted'
                  : 'border-cream-400 bg-cream-50 text-charcoal hover:border-sage-DEFAULT hover:bg-cream-200 active:translate-y-0.5'
              }`}
            >
              <span>{opt}</span>
              {show && isRight && <Check className="h-5 w-5 text-sage-deep" />}
              {show && isSel && !isRight && <X className="h-5 w-5 text-terracotta-deep" />}
            </button>
          );
        })}
      </div>

      {phase === 'answered' && (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className={`rounded-xl px-4 py-2 text-sm font-medium ${isCorrect ? 'bg-sage-light text-sage-deep' : 'bg-terracotta-light text-terracotta-deep'}`}>
            {isCorrect ? 'Beautifully done!' : `That was a ${question.intervalName}.`}
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
              <p>You answered: <span className="font-medium text-terracotta-deep">{selected}</span></p>
              <p>Correct: <span className="font-medium text-sage-deep">{question.correctAnswer} ({question.intervalName})</span></p>
              <p>The interval spans {question.semitones} semitones. {question.semitones <= 2 ? 'A step is the smallest move — just 1-2 half steps.' : question.semitones <= 4 ? 'A skip covers 3-4 half steps — a third.' : question.semitones <= 7 ? 'A 5th spans 7 half steps — a strong, open leap.' : 'An octave spans 12 half steps — the same note, higher!'}</p>
            </div>
            <TutorChat context={tutorContext} />
            <button onClick={() => setShowTutor(false)} className="btn-secondary w-full mt-4">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
