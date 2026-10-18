/**
 * Modulation Mission lesson component — warm notebook styling.
 *
 * SECURITY: Quiz state in React, score via server-side RPC, time via ref.
 * Teach Me modal includes interactive AI tutor chat (TutorChat).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, X, Lightbulb, RotateCcw, Volume2, ArrowRight } from 'lucide-react';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';
import { TutorChat } from '@/components/TutorChat';

interface ModulationQuestion {
  id: string;
  fromKey: string;
  toKey: string;
  correctAnswer: string;
  options: string[];
  fromFrequency: number;
  toFrequency: number;
  explanation: string;
  semitoneDistance: number;
  direction: 'up' | 'down';
}

const QUESTIONS: ModulationQuestion[] = [
  { id: 'q1', fromKey: 'C Major', toKey: 'D Major', correctAnswer: 'Whole step up', options: ['Half step up', 'Whole step up', 'Half step down', 'Whole step down'], fromFrequency: 261.63, toFrequency: 293.66, explanation: 'C Major to D Major is a modulation of 2 semitones upward. Each semitone is a half step, so 2 semitones = 1 whole step. The tonic moves from C (261.63 Hz) to D (293.66 Hz).', semitoneDistance: 2, direction: 'up' },
  { id: 'q2', fromKey: 'G Major', toKey: 'F Major', correctAnswer: 'Whole step down', options: ['Half step up', 'Whole step up', 'Half step down', 'Whole step down'], fromFrequency: 392.0, toFrequency: 349.23, explanation: 'G Major to F Major is a modulation of 2 semitones downward. The tonic descends from G (392 Hz) to F (349.23 Hz), which is one whole step down.', semitoneDistance: 2, direction: 'down' },
  { id: 'q3', fromKey: 'E Major', toKey: 'F Major', correctAnswer: 'Half step up', options: ['Half step up', 'Whole step up', 'Half step down', 'Whole step down'], fromFrequency: 329.63, toFrequency: 349.23, explanation: 'E Major to F Major is the smallest modulation possible: just 1 semitone upward. E (329.63 Hz) to F (349.23 Hz) is a half step up — the smallest interval in Western music.', semitoneDistance: 1, direction: 'up' },
  { id: 'q4', fromKey: 'A Major', toKey: 'F Major', correctAnswer: 'Minor third down', options: ['Half step down', 'Whole step down', 'Minor third down', 'Major third down'], fromFrequency: 440.0, toFrequency: 349.23, explanation: 'A Major to F Major spans 3 semitones downward. A 3-semitone interval is called a minor third. The tonic drops from A (440 Hz) down to F (349.23 Hz).', semitoneDistance: 3, direction: 'down' },
];

type QuizPhase = 'listening' | 'answering' | 'answered' | 'complete';

const INTERVAL_NAMES: Record<number, string> = {
  1: 'Half step', 2: 'Whole step', 3: 'Minor third', 4: 'Major third',
  5: 'Perfect fourth', 6: 'Tritone', 7: 'Perfect fifth',
};

export function ModulationMission() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>('listening');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showTeachMe, setShowTeachMe] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);

  // Close the AudioContext on unmount to release audio hardware
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => { /* ignore */ });
        audioContextRef.current = null;
      }
    };
  }, []);

  const question = QUESTIONS[currentIndex];
  const isLastQuestion = currentIndex === QUESTIONS.length - 1;

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((frequency: number, durationMs: number = 800) => {
    try {
      setAudioError(null);
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationMs / 1000);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Failed to play audio');
    }
  }, [getAudioContext]);

  const playModulation = useCallback(() => {
    playTone(question.fromFrequency, 600);
    setTimeout(() => playTone(question.toFrequency, 600), 700);
  }, [question, playTone]);

  const handleAnswer = useCallback((answer: string) => {
    if (phase !== 'answering') return;
    setSelectedAnswer(answer);
    if (answer === question.correctAnswer) setCorrectCount((c) => c + 1);
    setPhase('answered');
  }, [phase, question]);

  const handleNext = useCallback(async () => {
    if (isLastQuestion) {
      const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      const accuracy = Math.round((correctCount / QUESTIONS.length) * 100);
      setIsSubmitting(true);
      const result = await submitScore('Modulation Mission', accuracy, elapsedSeconds);
      setScoreResult(result);
      setIsSubmitting(false);
      setPhase('complete');
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setPhase('listening');
    }
  }, [isLastQuestion, correctCount]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setCorrectCount(0);
    setPhase('listening');
    setShowTeachMe(false);
    setScoreResult(null);
    startTimeRef.current = Date.now();
  }, []);

  const isCorrect = selectedAnswer === question.correctAnswer;

  const teachMeContent = useMemo(() => {
    if (!selectedAnswer) return null;
    return {
      wasCorrect: selectedAnswer === question.correctAnswer,
      userAnswer: selectedAnswer,
      correctAnswer: question.correctAnswer,
      fromKey: question.fromKey,
      toKey: question.toKey,
      explanation: question.explanation,
      semitoneDistance: question.semitoneDistance,
      direction: question.direction,
    };
  }, [selectedAnswer, question]);

  const tutorContext = useMemo(() => {
    if (!teachMeContent) return '';
    return [
      `Quiz: Modulation Mission`,
      `from: ${teachMeContent.fromKey}`,
      `to: ${teachMeContent.toKey}`,
      `user answered: ${teachMeContent.userAnswer}`,
      `correct answer: ${teachMeContent.correctAnswer}`,
      `${teachMeContent.semitoneDistance} semitones ${teachMeContent.direction}`,
      `explanation: ${teachMeContent.explanation}`,
    ].join('\n');
  }, [teachMeContent]);

  if (phase === 'complete') {
    const accuracy = Math.round((correctCount / QUESTIONS.length) * 100);
    return (
      <div className="card flex flex-col items-center gap-6 p-8 text-center animate-scale-in">
        <h2 className="text-2xl font-bold text-charcoal">Mission Complete</h2>
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl font-bold text-mustard-DEFAULT">{accuracy}%</span>
          <span className="text-charcoal-muted">{correctCount} of {QUESTIONS.length} correct</span>
        </div>
        {scoreResult && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${scoreResult.success ? 'bg-sage-light border-sage-DEFAULT text-sage-deep' : 'bg-terracotta-light border-terracotta-DEFAULT text-terracotta-deep'}`}>
            {scoreResult.success ? `Score saved! +${scoreResult.xpEarned} XP earned` : `Could not save score: ${scoreResult.error}`}
          </div>
        )}
        {isSubmitting && <div className="text-sm text-charcoal-muted">Saving score...</div>}
        <button onClick={handleRestart} className="btn-primary max-w-xs w-full">
          <RotateCcw className="h-5 w-5" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-6 p-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-sage-deep" />
          <h2 className="text-xl font-semibold text-charcoal">Modulation Mission</h2>
        </div>
        <span className="text-sm text-charcoal-muted">Question {currentIndex + 1} of {QUESTIONS.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-cream-300">
        <div className="h-full rounded-full bg-sage-DEFAULT transition-all duration-500" style={{ width: `${((currentIndex + (phase === 'answered' ? 1 : 0)) / QUESTIONS.length) * 100}%` }} />
      </div>

      {/* Question display */}
      <div className="card-dashed flex flex-col items-center gap-4 p-6">
        <p className="text-center text-charcoal-light">
          Listen to the modulation and identify the change from{' '}
          <span className="font-semibold text-sage-deep">{question.fromKey}</span> to{' '}
          <span className="font-semibold text-sage-deep">{question.toKey}</span>
        </p>
        {audioError && (
          <div className="rounded-lg bg-terracotta-light border border-terracotta-DEFAULT px-3 py-2 text-xs text-terracotta-deep">{audioError}</div>
        )}
        <button onClick={playModulation} className="btn-secondary">
          <Volume2 className="h-5 w-5" /> Play Modulation
        </button>
      </div>

      {phase === 'listening' && (
        <button onClick={() => setPhase('answering')} className="btn-primary w-full">
          I heard it — Show me the options
          <ArrowRight className="h-5 w-5" />
        </button>
      )}

      {(phase === 'answering' || phase === 'answered') && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {question.options.map((option) => {
            const isThisSelected = selectedAnswer === option;
            const isThisCorrect = option === question.correctAnswer;
            const showResult = phase === 'answered';
            return (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={phase === 'answered'}
                className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 font-medium transition-all duration-200 ${
                  showResult
                    ? isThisCorrect
                      ? 'border-sage-DEFAULT bg-sage-light text-sage-deep'
                      : isThisSelected
                        ? 'border-terracotta-DEFAULT bg-terracotta-light text-terracotta-deep'
                        : 'border-cream-400 bg-cream-200 text-charcoal-muted'
                    : 'border-cream-400 bg-cream-50 text-charcoal hover:border-sage-DEFAULT hover:bg-cream-200 active:translate-y-0.5'
                }`}
              >
                <span>{option}</span>
                {showResult && isThisCorrect && <Check className="h-5 w-5 text-sage-deep" />}
                {showResult && isThisSelected && !isThisCorrect && <X className="h-5 w-5 text-terracotta-deep" />}
              </button>
            );
          })}
        </div>
      )}

      {phase === 'answered' && (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className={`rounded-xl px-4 py-2 text-sm font-medium ${isCorrect ? 'bg-sage-light text-sage-deep' : 'bg-terracotta-light text-terracotta-deep'}`}>
            {isCorrect ? 'Correct!' : 'Not quite — click "Teach Me" to learn why.'}
          </div>
          {!isCorrect && (
            <button onClick={() => setShowTeachMe(true)} className="btn-mustard">
              <Lightbulb className="h-5 w-5" /> Teach Me
            </button>
          )}
          <button onClick={handleNext} disabled={isSubmitting} className="btn-primary max-w-xs w-full">
            {isLastQuestion ? 'Finish Mission' : 'Next Question'}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Teach Me modal with AI tutor chat — cozy notebook layout */}
      {showTeachMe && teachMeContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-sm p-4" onClick={() => setShowTeachMe(false)}>
          <div className="card max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-paper-lg animate-scale-in scrollbar-hide" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-mustard-DEFAULT" />
              <h3 className="text-lg font-bold text-charcoal">Teach Me</h3>
            </div>

            {/* Static explanation in a notebook-style block */}
            <div className="space-y-3 text-sm text-charcoal-light mb-4 rounded-xl bg-cream-200 border border-cream-400 p-4">
              <p>You answered: <span className="font-medium text-terracotta-deep">{teachMeContent.userAnswer}</span></p>
              <p>Correct answer: <span className="font-medium text-sage-deep">{teachMeContent.correctAnswer}</span></p>
              <div className="my-3 h-px bg-cream-400" />
              <p className="text-charcoal">{teachMeContent.fromKey} to {teachMeContent.toKey}:</p>
              <p>{teachMeContent.explanation}</p>
              <div className="rounded-lg bg-cream-50 border border-cream-400 p-3">
                <p className="text-xs text-charcoal-muted">
                  Key concept: {teachMeContent.semitoneDistance} semitone{teachMeContent.semitoneDistance !== 1 ? 's' : ''} {teachMeContent.direction} = {INTERVAL_NAMES[teachMeContent.semitoneDistance] ?? `${teachMeContent.semitoneDistance} semitones`}
                </p>
              </div>
            </div>

            <div className="my-4 h-px bg-cream-400" />

            {/* Interactive AI tutor chat */}
            <TutorChat context={tutorContext} />

            <button onClick={() => setShowTeachMe(false)} className="btn-secondary w-full mt-4">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
