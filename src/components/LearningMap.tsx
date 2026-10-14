/**
 * Learning Map — personalized chronological roadmap with adaptive recommendations.
 *
 * ADAPTIVE RECOMMENDATIONS (Phase 7):
 * Uses the recommendationService which tries the trained ML model first
 * (from model_predictions table), falls back to the rule-based baseline
 * (lowest avg accuracy), and returns null if neither is available.
 * The recommendation card shows whether it came from the model or baseline.
 *
 * SECURITY: Progress is read from UserContext (localStorage) for the module
 * path. Score history is fetched via the get_progress_summary RPC, which
 * runs as SECURITY DEFINER with auth.uid() validation. Model predictions
 * are read from model_predictions (RLS-scoped to own data).
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Lock, MapPin, ArrowRight, TrendingDown, Sparkles, Brain } from 'lucide-react';
import { useUser, type ExperienceLevel } from '@/context/UserContext';
import { getProgress, type ProgressSummary } from '@/lib/progressService';
import { getRecommendation, type Recommendation } from '@/lib/recommendationService';

interface MapModule {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryColor: string;
  difficulty: string;
  prerequisites: string[];
}

const ALL_MODULES: MapModule[] = [
  { id: 'breath-support', name: 'Breath Support', description: 'Steady airflow is the foundation of singing', category: 'Vocal Mechanics', categoryColor: 'text-terracotta-deep', difficulty: 'Beginner', prerequisites: [] },
  { id: 'intervals', name: 'Interval Recognition', description: 'Hear the distance between two notes', category: 'Pitch & Ear', categoryColor: 'text-sage-deep', difficulty: 'Beginner', prerequisites: [] },
  { id: 'fine-tuning', name: 'Fine-Tuning', description: 'Sing precisely on pitch', category: 'Pitch & Ear', categoryColor: 'text-sage-deep', difficulty: 'Foundation', prerequisites: ['intervals'] },
  { id: 'scale-degrees', name: 'Scale Degrees', description: 'Know where each note lives in the scale', category: 'Pitch & Ear', categoryColor: 'text-sage-deep', difficulty: 'Foundation', prerequisites: ['intervals'] },
  { id: 'register-blending', name: 'Register Blending', description: 'Smooth transitions between voice registers', category: 'Vocal Mechanics', categoryColor: 'text-terracotta-deep', difficulty: 'Singer', prerequisites: ['breath-support'] },
  { id: 'dexterity-drills', name: 'Dexterity Drills', description: 'Fast pentatonic runs for vocal agility', category: 'Agility & Runs', categoryColor: 'text-mustard-deep', difficulty: 'Singer', prerequisites: ['scale-degrees', 'register-blending'] },
  { id: 'third-fifth-finding', name: '3rd/5th Finding', description: 'Sing harmony parts against a melody', category: 'Harmony', categoryColor: 'text-terracotta-deep', difficulty: 'Harmony', prerequisites: ['scale-degrees', 'fine-tuning'] },
  { id: 'vowel-blending', name: 'Vowel Blending', description: 'Unify vowel shapes for a blended choir sound', category: 'Harmony', categoryColor: 'text-terracotta-deep', difficulty: 'Harmony', prerequisites: ['third-fifth-finding'] },
  { id: 'modulation-mission', name: 'Modulation Missions', description: 'Identify key changes by ear', category: 'Director Suite', categoryColor: 'text-mustard-deep', difficulty: 'Advanced', prerequisites: ['scale-degrees', 'dexterity-drills'] },
  { id: 'a-cappella-key-starts', name: 'A Cappella Key Starts', description: 'Give starting pitches without instruments', category: 'Director Suite', categoryColor: 'text-mustard-deep', difficulty: 'Advanced', prerequisites: ['modulation-mission', 'fine-tuning'] },
];

/** Map DB module names to LearningMap module IDs */
const NAME_TO_ID: Record<string, string> = {
  'Breath Tracker': 'breath-support',
  'Breath Support': 'breath-support',
  'Interval Recognition': 'intervals',
  'Fine-Tuning Drill': 'fine-tuning',
  'Scale Degrees': 'scale-degrees',
  'Register Blending': 'register-blending',
  'Dexterity Drills': 'dexterity-drills',
  'Third Fifth Finding': 'third-fifth-finding',
  'Vowel Blending': 'vowel-blending',
  'Modulation Mission': 'modulation-mission',
  'A Cappella Key Starts': 'a-cappella-key-starts',
  'Siren Elevator': 'register-blending',
  'Resonance Tracker': 'register-blending',
  'Pitch Tracker': 'fine-tuning',
};

function getOrderedModules(experience: ExperienceLevel | null): MapModule[] {
  if (experience === 'experienced') return ALL_MODULES;
  if (experience === 'some-experience') return ALL_MODULES.filter((m) => m.id !== 'breath-support');
  return ALL_MODULES;
}

interface LearningMapProps {
  onSelectModule: (moduleId: string) => void;
}

export function LearningMap({ onSelectModule }: LearningMapProps) {
  const { profile } = useUser();
  const ordered = getOrderedModules(profile.experience);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getProgress();
      if (cancelled || !p || p.error) return;
      setProgress(p);
      const rec = await getRecommendation(p);
      if (!cancelled) setRecommendation(rec);
    })();
    return () => { cancelled = true; };
  }, []);

  const isUnlocked = (mod: MapModule): boolean => {
    if (mod.prerequisites.length === 0) return true;
    return mod.prerequisites.every((prereq) => profile.completedModules.includes(prereq));
  };

  const isCompleted = (mod: MapModule): boolean => profile.completedModules.includes(mod.id);

  // Resolve the recommendation to a map module, checking unlock/completion status
  const recommendedModule = (() => {
    if (!recommendation) return null;
    const mapModule = ALL_MODULES.find((m) => m.id === recommendation.moduleId);
    if (!mapModule || !isUnlocked(mapModule) || isCompleted(mapModule)) return null;
    return { module: mapModule, rec: recommendation };
  })();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-charcoal">Your Learning Map</h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          Follow the path from left to right. Each step builds on the last!
        </p>
      </div>

      {/* Progress summary */}
      <div className="card flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-sage-deep" />
          <div>
            <span className="font-semibold text-charcoal">{profile.completedModules.length}</span>
            <span className="text-charcoal-muted"> of {ordered.length} modules completed</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {progress && progress.xp > 0 && (
            <span className="text-sm text-mustard-deep font-medium">{progress.xp} XP</span>
          )}
          <div className="h-2 w-32 overflow-hidden rounded-full bg-cream-300">
            <div className="h-full rounded-full bg-sage-DEFAULT transition-all duration-500" style={{ width: `${(profile.completedModules.length / ordered.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Adaptive recommendation */}
      {recommendedModule && (
        <button
          onClick={() => onSelectModule(recommendedModule.module.id)}
          className="card flex items-center gap-4 p-5 text-left border-2 border-mustard-DEFAULT bg-mustard-light/30 hover:bg-mustard-light/50 transition-all hover:-translate-y-0.5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mustard-DEFAULT border-2 border-mustard-deep">
            {recommendedModule.rec.source === 'model'
              ? <Brain className="h-5 w-5 text-cream-50" />
              : <Sparkles className="h-5 w-5 text-cream-50" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-charcoal">Recommended for you</h3>
              {recommendedModule.rec.source === 'model' && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-mustard-deep bg-mustard-light border border-mustard-DEFAULT rounded px-1.5 py-0.5">AI</span>
              )}
              <TrendingDown className="h-3.5 w-3.5 text-terracotta-deep" />
            </div>
            <p className="text-sm text-charcoal-muted">
              {recommendedModule.module.name} — {recommendedModule.rec.reason}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-charcoal-muted shrink-0" />
        </button>
      )}

      {/* Path */}
      <div className="flex flex-col gap-3">
        {ordered.map((mod, index) => {
          const unlocked = isUnlocked(mod);
          const completed = isCompleted(mod);
          const isNext = unlocked && !completed && ordered.slice(0, index).every((m) => isCompleted(m) || !isUnlocked(m));

          return (
            <button
              key={mod.id}
              onClick={() => unlocked && onSelectModule(mod.id)}
              disabled={!unlocked}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                completed
                  ? 'border-sage-DEFAULT bg-sage-light/30 shadow-paper-sage'
                  : unlocked
                    ? 'border-cream-400 bg-cream-50 shadow-paper-sm hover:shadow-paper hover:-translate-y-0.5 active:translate-y-0'
                    : 'border-cream-300 bg-cream-100 opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Step number / status icon */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-bold ${
                completed ? 'bg-sage-DEFAULT border-sage-DEFAULT text-cream-50' :
                unlocked ? 'bg-cream-200 border-cream-400 text-charcoal' :
                'bg-cream-200 border-cream-300 text-charcoal-muted'
              }`}>
                {completed ? <CheckCircle2 className="h-5 w-5" /> :
                 unlocked ? index + 1 :
                 <Lock className="h-4 w-4" />}
              </div>

              {/* Module info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-charcoal">{mod.name}</h3>
                  {isNext && <span className="text-[10px] font-bold uppercase tracking-wide text-sage-deep bg-sage-light border border-sage-DEFAULT rounded px-1.5 py-0.5">Next Up</span>}
                </div>
                <p className="text-sm text-charcoal-muted truncate">{mod.description}</p>
                <p className={`text-xs mt-0.5 ${mod.categoryColor}`}>{mod.category} · {mod.difficulty}</p>
              </div>

              {/* Arrow */}
              {unlocked && !completed && <ArrowRight className="h-5 w-5 text-charcoal-muted shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Locked hint */}
      {ordered.some((m) => !isUnlocked(m)) && (
        <p className="text-center text-xs text-charcoal-muted">
          Some modules are locked until you complete their prerequisites. Keep going!
        </p>
      )}
    </div>
  );
}
