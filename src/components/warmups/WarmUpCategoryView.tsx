import { ChevronLeft, Mic, Timer } from 'lucide-react';
import { exercisesForCategory, type ExerciseId } from '@/lib/warmupCatalog';
import type { WarmUpCategory } from '@/components/warmups/warmupCategories';

interface WarmUpCategoryViewProps {
  category: WarmUpCategory;
  onBack: () => void;
  onOpenTracker: () => void;
  onOpenExercise: (id: ExerciseId) => void;
}

export function WarmUpCategoryView({ category, onBack, onOpenTracker, onOpenExercise }: WarmUpCategoryViewProps) {
  const Icon = category.icon;
  const exercises = exercisesForCategory(category.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Warm-Ups
      </button>

      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${category.bg}`}>
          <Icon className={`h-6 w-6 ${category.color}`} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-charcoal">{category.label}</h2>
          <p className="text-sm text-charcoal-muted">{category.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" onClick={onOpenTracker} className="card-dashed-hover group flex items-center gap-4 p-5 text-left">
          <div className="flex-1">
            <h3 className="font-semibold text-charcoal">{category.tracker.title}</h3>
            <p className="text-sm text-charcoal-muted">{category.tracker.description}</p>
          </div>
          <span className="text-sm text-sage-deep transition-transform group-hover:translate-x-1">Open</span>
        </button>

        {exercises.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => onOpenExercise(exercise.id)}
            className="card-dashed-hover group flex items-center gap-4 p-5 text-left"
          >
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-charcoal">{exercise.title}</h3>
              <p className="text-sm text-charcoal-muted">{exercise.summary}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-charcoal-muted">
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  About {Math.round(exercise.defaultDurationSec / 60) || 1} min
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mic className="h-3.5 w-3.5" />
                  {exercise.usesPitch ? 'Pitch feedback' : exercise.usesMic ? 'Listens to your voice' : 'Timing only'}
                </span>
              </div>
            </div>
            <span className="text-sm text-sage-deep transition-transform group-hover:translate-x-1">Start</span>
          </button>
        ))}
      </div>
    </div>
  );
}
