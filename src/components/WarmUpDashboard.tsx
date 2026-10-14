/**
 * Warm-Up Dashboard — whimsical notebook styling.
 * Four categories (Breath, Resonance, Agility, Pitch) as dashed-border cards.
 * Daily routine CTA with sage accent.
 *
 * SECURITY: All navigation is client-side UI state.
 */

import { useState } from 'react';
import { Wind, Waves, TrendingUp, Activity, Calendar, ChevronLeft } from 'lucide-react';
import { BreathTracker } from '@/components/warmups/BreathTracker';
import { ResonanceTracker } from '@/components/warmups/ResonanceTracker';
import { SirenSlider } from '@/components/warmups/SirenSlider';
import { PitchTracker } from '@/components/warmups/PitchTracker';

type WarmUpCategory = 'breath' | 'resonance' | 'agility' | 'pitch' | null;

interface CategoryCard {
  id: WarmUpCategory;
  label: string;
  description: string;
  icon: typeof Wind;
  color: string;
  bg: string;
}

const CATEGORIES: CategoryCard[] = [
  { id: 'breath', label: 'Breath', description: 'Straw phonation & hiss test for breath control', icon: Wind, color: 'text-sage-deep', bg: 'bg-sage-light' },
  { id: 'resonance', label: 'Resonance', description: 'Lip trill & humming with fluid wave guidance', icon: Waves, color: 'text-terracotta-deep', bg: 'bg-terracotta-light' },
  { id: 'agility', label: 'Agility', description: 'Siren slider across octaves for vocal flexibility', icon: TrendingUp, color: 'text-mustard-deep', bg: 'bg-mustard-light' },
  { id: 'pitch', label: 'Pitch', description: 'Real-time pitch detection with sharp/flat feedback', icon: Activity, color: 'text-charcoal', bg: 'bg-cream-300' },
];

const DAILY_ROUTINE: WarmUpCategory[] = ['breath', 'resonance', 'agility', 'pitch'];

export function WarmUpDashboard() {
  const [activeCategory, setActiveCategory] = useState<WarmUpCategory>(null);
  const [routineIndex, setRoutineIndex] = useState<number | null>(null);
  const [showRoutineIntro, setShowRoutineIntro] = useState(false);

  const isInRoutine = routineIndex !== null;

  const handleStartRoutine = () => {
    setRoutineIndex(0);
    setActiveCategory(DAILY_ROUTINE[0]);
    setShowRoutineIntro(false);
  };

  const handleNextInRoutine = () => {
    if (routineIndex === null) return;
    const next = routineIndex + 1;
    if (next < DAILY_ROUTINE.length) {
      setRoutineIndex(next);
      setActiveCategory(DAILY_ROUTINE[next]);
    } else {
      setRoutineIndex(null);
      setActiveCategory(null);
    }
  };

  const handleBack = () => {
    setActiveCategory(null);
    setRoutineIndex(null);
  };

  const renderActiveWarmUp = () => {
    switch (activeCategory) {
      case 'breath': return <BreathTracker />;
      case 'resonance': return <ResonanceTracker />;
      case 'agility': return <SirenSlider />;
      case 'pitch': return <PitchTracker />;
      default: return null;
    }
  };

  if (activeCategory) {
    const category = CATEGORIES.find((c) => c.id === activeCategory)!;
    const routineStep = isInRoutine ? routineIndex + 1 : null;
    const routineTotal = isInRoutine ? DAILY_ROUTINE.length : null;
    const isLastInRoutine = isInRoutine && routineIndex === DAILY_ROUTINE.length - 1;

    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Warm-Ups
          </button>
          {isInRoutine && (
            <span className="text-sm text-charcoal-muted">
              Daily Routine — Step {routineStep} of {routineTotal}
            </span>
          )}
        </div>

        {renderActiveWarmUp()}

        {isInRoutine && (
          <div className="flex justify-center">
            <button onClick={handleNextInRoutine} className="btn-primary max-w-xs">
              {isLastInRoutine ? 'Complete Routine' : 'Next Exercise'}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (showRoutineIntro) {
    return (
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="card flex flex-col items-center gap-4 p-8 max-w-md w-full">
          <Calendar className="h-10 w-10 text-sage-DEFAULT" />
          <h3 className="text-xl font-bold text-charcoal">Daily Warm-Up Routine</h3>
          <p className="text-center text-sm text-charcoal-muted">
            A guided 4-step routine covering all vocal fundamentals. Each exercise takes a few minutes.
          </p>
          <div className="flex flex-col gap-2 w-full">
            {DAILY_ROUTINE.map((cat, i) => {
              const c = CATEGORIES.find((cc) => cc.id === cat)!;
              const Icon = c.icon;
              return (
                <div key={cat} className="flex items-center gap-3 rounded-xl bg-cream-200 border border-cream-400 px-4 py-2.5">
                  <span className="text-sm text-charcoal-muted">{i + 1}</span>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                  <span className="text-sm text-charcoal">{c.label}</span>
                </div>
              );
            })}
          </div>
          <button onClick={handleStartRoutine} className="btn-primary w-full">
            Start Routine
          </button>
          <button
            onClick={() => setShowRoutineIntro(false)}
            className="text-sm text-charcoal-muted transition-colors hover:text-charcoal"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-charcoal">Warm-Up Studio</h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          Choose a standalone exercise or follow the daily routine.
        </p>
      </div>

      {/* Daily routine CTA */}
      <button
        onClick={() => setShowRoutineIntro(true)}
        className="card-hover group flex items-center gap-4 p-5 text-left w-full"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-DEFAULT transition-transform group-hover:scale-110">
          <Calendar className="h-6 w-6 text-cream-50" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-charcoal">Daily Warm-Up Routine</h3>
          <p className="text-sm text-charcoal-muted">Guided 4-step sequence: Breath, Resonance, Agility, Pitch</p>
        </div>
        <span className="text-sm text-sage-deep transition-transform group-hover:translate-x-1">Start</span>
      </button>

      {/* Category grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="card-dashed-hover group flex flex-col gap-3 p-6 text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cat.bg} transition-transform group-hover:scale-110`}>
                  <Icon className={`h-5 w-5 ${cat.color}`} />
                </div>
                <h3 className="font-semibold text-charcoal">{cat.label}</h3>
              </div>
              <p className="text-sm text-charcoal-muted">{cat.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
