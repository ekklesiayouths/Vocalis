/**
 * Warm-Up Studio: four routines and four categories.
 * Categories hold the original trackers plus the new timed exercises.
 *
 * SECURITY: All navigation is client-side UI state.
 */

import { useState } from 'react';
import { ChevronLeft, Clock, ListChecks } from 'lucide-react';
import { ExercisePlayer } from '@/components/warmups/ExercisePlayer';
import { RoutinePlayer } from '@/components/warmups/RoutinePlayer';
import { WarmUpCategoryView } from '@/components/warmups/WarmUpCategoryView';
import { WARMUP_CATEGORIES, getWarmUpCategory } from '@/components/warmups/warmupCategories';
import type { ExerciseCategory, ExerciseId } from '@/lib/warmupCatalog';
import { ROUTINES, type RoutineId } from '@/lib/warmupRoutines';

type View =
  | { kind: 'home' }
  | { kind: 'category'; category: ExerciseCategory }
  | { kind: 'tracker'; category: ExerciseCategory }
  | { kind: 'exercise'; category: ExerciseCategory; exerciseId: ExerciseId }
  | { kind: 'routine'; routineId: RoutineId };

export function WarmUpDashboard() {
  const [view, setView] = useState<View>({ kind: 'home' });

  if (view.kind === 'category') {
    return (
      <WarmUpCategoryView
        category={getWarmUpCategory(view.category)}
        onBack={() => setView({ kind: 'home' })}
        onOpenTracker={() => setView({ kind: 'tracker', category: view.category })}
        onOpenExercise={(exerciseId) => setView({ kind: 'exercise', category: view.category, exerciseId })}
      />
    );
  }

  if (view.kind === 'tracker') {
    const category = getWarmUpCategory(view.category);
    const { Component } = category.tracker;
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <button
          type="button"
          onClick={() => setView({ kind: 'category', category: view.category })}
          className="flex w-fit items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {category.label}
        </button>
        <Component />
      </div>
    );
  }

  if (view.kind === 'exercise') {
    return (
      <ExercisePlayer
        exerciseId={view.exerciseId}
        onExit={() => setView({ kind: 'category', category: view.category })}
      />
    );
  }

  if (view.kind === 'routine') {
    return <RoutinePlayer routineId={view.routineId} onExit={() => setView({ kind: 'home' })} />;
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-charcoal">Warm-Up Studio</h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          Follow a guided routine or pick a single exercise from a category.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-muted">Guided routines</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ROUTINES.map((routine) => (
            <button
              key={routine.id}
              type="button"
              onClick={() => setView({ kind: 'routine', routineId: routine.id })}
              className="card-hover group flex flex-col gap-3 p-5 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-charcoal">{routine.title}</h4>
                <span className="inline-flex items-center gap-1 rounded-full bg-sage-light px-2.5 py-1 text-xs font-medium text-sage-deep">
                  <Clock className="h-3 w-3" />
                  {routine.minutes} min
                </span>
              </div>
              <p className="text-sm text-charcoal-muted">{routine.description}</p>
              <p className="inline-flex items-center gap-1.5 text-xs text-charcoal-muted">
                <ListChecks className="h-3.5 w-3.5" />
                {routine.steps.length} exercises, skip or exit anytime
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-muted">Categories</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {WARMUP_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setView({ kind: 'category', category: category.id })}
                className="card-dashed-hover group flex flex-col gap-3 p-6 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${category.bg} transition-transform group-hover:scale-110`}>
                    <Icon className={`h-5 w-5 ${category.color}`} />
                  </div>
                  <h4 className="font-semibold text-charcoal">{category.label}</h4>
                </div>
                <p className="text-sm text-charcoal-muted">{category.description}</p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
