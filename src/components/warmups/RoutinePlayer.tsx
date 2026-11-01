import { useState } from 'react';
import { Check } from 'lucide-react';
import { ExercisePlayer } from '@/components/warmups/ExercisePlayer';
import { getExercise } from '@/lib/warmupCatalog';
import { getRoutine, routineTotalSec, type RoutineId } from '@/lib/warmupRoutines';
import type { ExerciseResult } from '@/lib/warmupScoring';

interface RoutinePlayerProps {
  routineId: RoutineId;
  onExit: () => void;
}

type StepOutcome =
  | { exerciseId: string; title: string; skipped: true; result: null }
  | { exerciseId: string; title: string; skipped: false; result: ExerciseResult };

export function RoutinePlayer({ routineId, onExit }: RoutinePlayerProps) {
  const routine = getRoutine(routineId);
  const [stepIndex, setStepIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<StepOutcome[]>([]);
  const totalSteps = routine.steps.length;
  const finished = stepIndex >= totalSteps;
  const current = routine.steps[stepIndex];

  const advance = (result: ExerciseResult | null) => {
    const title = getExercise(current.exerciseId).title;
    const outcome: StepOutcome = result
      ? { exerciseId: current.exerciseId, title, skipped: false, result }
      : { exerciseId: current.exerciseId, title, skipped: true, result: null };
    setOutcomes((previous) => [...previous, outcome]);
    setStepIndex((previous) => previous + 1);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold text-charcoal">{routine.title}</h2>
          <p className="text-sm text-charcoal-muted">About {Math.round(routineTotalSec(routine) / 60)} minutes</p>
        </div>
        <div className="flex gap-2" aria-label="Routine progress">
          {routine.steps.map((step, index) => (
            <div
              key={`${step.exerciseId}-${index}`}
              className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                index < stepIndex ? 'bg-sage-dark' : index === stepIndex && !finished ? 'bg-sage' : 'bg-cream-300'
              }`}
            />
          ))}
        </div>
      </div>

      {finished ? (
        <section className="card space-y-5 p-6 animate-scale-in">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-light text-sage-deep">
              <Check className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-semibold text-charcoal">Routine complete</h3>
          </div>
          <ul className="divide-y divide-charcoal/10">
            {outcomes.map((outcome, index) => (
              <li key={`${outcome.exerciseId}-${index}`} className="flex items-center justify-between gap-4 py-3">
                <span className="font-medium text-charcoal">{outcome.title}</span>
                <span className="text-sm text-charcoal-muted">
                  {outcome.skipped
                    ? 'Skipped'
                    : outcome.result.accuracyPct !== null
                      ? `${outcome.result.accuracyPct}% in tune`
                      : 'Completed'}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onExit} className="btn-primary">
            Back to Warm-Ups
          </button>
        </section>
      ) : (
        <ExercisePlayer
          key={stepIndex}
          exerciseId={current.exerciseId}
          durationSec={current.durationSec}
          onExit={onExit}
          routine={{
            stepLabel: `Step ${stepIndex + 1} of ${totalSteps}`,
            onSkip: () => advance(null),
            onContinue: advance,
          }}
        />
      )}
    </div>
  );
}
