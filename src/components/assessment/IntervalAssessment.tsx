import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Equal, RotateCcw } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { midiToFrequency } from '@/lib/notes';
import {
  BLUEPRINT_MODULES,
  EAR_TRIAL_COUNT,
  buildCompletedResult,
  generateEarTrials,
  scoreEarTraining,
  type EarDirection,
  type EarTrial,
} from '@/lib/vocalBlueprint';
import type { AssessmentResult } from '@/lib/profileService';

const BASE_MS = 700;
const TARGET_MS = 900;
const GAP_MS = 250;

interface IntervalAssessmentProps {
  onComplete: (result: AssessmentResult) => void;
  onCancel: () => void;
}

function pairEntries(trial: EarTrial) {
  return [
    { frequency: midiToFrequency(trial.baseMidi), durationMs: BASE_MS },
    { frequency: midiToFrequency(trial.targetMidi), durationMs: TARGET_MS },
  ];
}

const CHOICES: { value: EarDirection; label: string; icon: typeof ArrowUp }[] = [
  { value: 'higher', label: 'Higher', icon: ArrowUp },
  { value: 'lower', label: 'Lower', icon: ArrowDown },
  { value: 'same', label: 'Same', icon: Equal },
];

export function IntervalAssessment({ onComplete, onCancel }: IntervalAssessmentProps) {
  const { playSequence } = useTonePlayer();
  const [trials] = useState<EarTrial[]>(() => generateEarTrials());
  const [answers, setAnswers] = useState<EarDirection[]>([]);
  const [started, setStarted] = useState(false);
  const index = answers.length;
  const current = trials[index];

  useEffect(() => {
    if (!started || !current) return;
    playSequence(pairEntries(current), { gapMs: GAP_MS });
  }, [started, current, playSequence]);

  const answer = (choice: EarDirection) => {
    const next = [...answers, choice];
    setAnswers(next);
    if (next.length === trials.length) {
      const { accuracy } = scoreEarTraining(trials, next);
      onComplete(buildCompletedResult(BLUEPRINT_MODULES.ear, accuracy, EAR_TRIAL_COUNT, trials.length));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-sage-light/30 border border-sage-DEFAULT p-4 text-sm text-charcoal-light">
        <p className="font-medium text-charcoal mb-1">Interval Recognition</p>
        <p className="text-xs text-charcoal-muted">
          You'll hear two notes. Is the second note higher, lower, or the same as the first?
        </p>
      </div>

      {!started && (
        <button onClick={() => setStarted(true)} className="btn-primary w-full">
          Start listening
        </button>
      )}

      {started && current && (
        <div className="flex flex-col gap-3 rounded-xl border border-cream-400 bg-cream-100 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-charcoal-muted">Question {index + 1} of {trials.length}</p>
            <button
              onClick={() => playSequence(pairEntries(current), { gapMs: GAP_MS })}
              className="flex items-center gap-1 text-xs font-medium text-sage-deep hover:text-sage-dark"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Play again
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CHOICES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => answer(value)}
                className="flex flex-col items-center gap-1 rounded-lg border-2 border-cream-400 bg-cream-50 px-2 py-3 text-sm font-medium text-charcoal transition-all hover:border-sage-DEFAULT hover:bg-sage-light/40 active:translate-y-0.5"
              >
                <Icon className="h-4 w-4 text-sage-deep" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={onCancel} className="text-xs text-charcoal-muted hover:text-charcoal w-fit mx-auto">
        Stop and go back
      </button>
    </div>
  );
}
