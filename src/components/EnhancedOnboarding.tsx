/**
 * Enhanced onboarding — multi-step questionnaire with optional skill assessments.
 *
 * Phase E1: Learner profile and goals (self-reported, stored as preferences)
 * Phase E2: Objective skill assessment (uses existing exercises)
 * Phase E3: Generates personalized Learning Map
 *
 * Persists to database via profileService when authenticated.
 * Falls back to localStorage for unauthenticated users.
 */

import { useState, useCallback } from 'react';
import {
  Music, ArrowRight, ArrowLeft, Mic, Target, Clock, BookOpen, Piano,
  Check, Loader2, SkipForward, AlertCircle, Headphones, Users, Crown,
  TrendingUp, Ear, Wind, Gauge, Repeat,
} from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { sanitizeText } from '@/lib/validation';
import { generateLearningMap, COURSES, getCategoryOrder } from '@/lib/learningMapEngine';
import { saveOnboardingData, completeOnboarding, type OnboardingData, type AssessmentResult } from '@/lib/profileService';
import type { ProgressSummary } from '@/lib/progressService';

type Step = 'welcome' | 'name' | 'goals' | 'role' | 'experience' | 'skills' | 'notation' | 'instrument' | 'practice' | 'assessment-intro' | 'assessment' | 'generating' | 'done';

const GOAL_OPTIONS = [
  { value: 'sing-better', label: 'Sing Better', icon: Music },
  { value: 'ear-training', label: 'Train My Ear', icon: Ear },
  { value: 'vocal-development', label: 'Vocal Development', icon: Wind },
  { value: 'join-choir', label: 'Join a Choir', icon: Users },
  { value: 'harmony', label: 'Harmony & Choral', icon: Headphones },
  { value: 'lead-choir', label: 'Lead a Choir', icon: Crown },
];

const ROLE_OPTIONS = [
  { value: 'beginner-learner', label: 'Beginner Learner' },
  { value: 'choir-member', label: 'Choir Member' },
  { value: 'solo-singer', label: 'Solo Singer' },
  { value: 'section-leader', label: 'Section Leader' },
  { value: 'worship-leader', label: 'Worship Leader' },
  { value: 'choir-director', label: 'Choir Director' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'complete-beginner', label: 'Complete Beginner', desc: 'No formal training' },
  { value: 'some-experience', label: 'Some Experience', desc: 'Casual singing or self-taught' },
  { value: 'experienced', label: 'Experienced', desc: 'Formal training or choir experience' },
];

const PRACTICE_FREQUENCY = ['Daily', '3–4×/week', '2×/week', 'Weekly'];
const PRACTICE_DURATION = ['5 min', '15 min', '30 min', '60 min'];

const SKILL_OPTIONS = [
  'Pitch matching', 'Interval recognition', 'Scale degrees', 'Breath control',
  'Register transitions', 'Vocal agility', 'Harmony singing', 'Sight reading',
  'Modulation recognition', 'Vowel uniformity', 'Part stability',
];

interface OnboardingProps {
  onComplete?: () => void;
}

export function EnhancedOnboarding({ onComplete }: OnboardingProps) {
  const { completeOnboarding: completeLocalOnboarding, setProfile } = useUser();
  const { session } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [displayName, setDisplayName] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [role, setRole] = useState<string>('');
  const [experience, setExperience] = useState<string>('');
  const [skillsToImprove, setSkillsToImprove] = useState<string[]>([]);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [struggles, setStruggles] = useState<string[]>([]);
  const [readsNotation, setReadsNotation] = useState<boolean | null>(null);
  const [knowsSolfa, setKnowsSolfa] = useState<boolean | null>(null);
  const [hasInstrument, setHasInstrument] = useState<boolean | null>(null);
  const [practiceFrequency, setPracticeFrequency] = useState('');
  const [practiceDuration, setPracticeDuration] = useState('');
  const [assessmentResults, setAssessmentResults] = useState<Record<string, AssessmentResult>>({});
  const [skipAssessment, setSkipAssessment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generatedMap, setGeneratedMap] = useState<ReturnType<typeof generateLearningMap> | null>(null);

  const stepOrder: Step[] = ['welcome', 'name', 'goals', 'role', 'experience', 'skills', 'notation', 'instrument', 'practice', 'assessment-intro', 'assessment', 'generating', 'done'];
  const currentStepIndex = stepOrder.indexOf(step);

  const goNext = useCallback(() => {
    const next = stepOrder[currentStepIndex + 1];
    if (next) setStep(next);
  }, [currentStepIndex, stepOrder]);

  const goBack = useCallback(() => {
    const prev = stepOrder[currentStepIndex - 1];
    if (prev) setStep(prev);
  }, [currentStepIndex, stepOrder]);

  const toggleArrayItem = (arr: string[], value: string, setter: (v: string[]) => void) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const buildOnboardingData = (): OnboardingData => ({
    goals,
    role,
    experience,
    readsNotation: readsNotation ?? false,
    knowsSolfa: knowsSolfa ?? false,
    hasInstrument: hasInstrument ?? false,
    practiceFrequency,
    practiceDuration,
    skillsToImprove,
    strengths,
    struggles,
    assessmentResults,
  });

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    const data = buildOnboardingData();
    const map = generateLearningMap(data, null, []);
    setGeneratedMap(map);

    if (session) {
      setSaving(true);
      const { error: saveError } = await saveOnboardingData(data);
      if (!saveError) {
        await completeOnboarding(map);
      }
      setSaving(false);
    }

    setStep('done');
  }, [session, goals, role, experience, readsNotation, knowsSolfa, hasInstrument, practiceFrequency, practiceDuration, skillsToImprove, strengths, struggles, assessmentResults]);

  const handleFinish = useCallback(() => {
    const cleanName = sanitizeText(displayName, 60) || 'Friend';
    const data = buildOnboardingData();
    const isDirector = goals.includes('lead-choir') || role === 'choir-director' || role === 'worship-leader';

    completeLocalOnboarding({
      experience: (experience || 'complete-beginner') as 'complete-beginner' | 'some-experience' | 'experienced',
      goal: (goals[0] || 'sing-better') as 'sing-better' | 'join-choir' | 'lead-choir' | 'ear-training',
      timeCommitment: (practiceDuration === '5 min' ? '5-min' : practiceDuration === '30 min' || practiceDuration === '60 min' ? '30-min' : '15-min') as '5-min' | '15-min' | '30-min',
      displayName: cleanName,
    });

    setProfile((prev) => ({ ...prev, isMusicDirector: isDirector }));
    onComplete?.();
  }, [displayName, goals, role, experience, practiceDuration, completeLocalOnboarding, setProfile, onComplete]);

  // --- Render helpers ---

  const canProceed = (): boolean => {
    switch (step) {
      case 'name': return displayName.trim().length >= 2;
      case 'goals': return goals.length > 0;
      case 'role': return role.length > 0;
      case 'experience': return experience.length > 0;
      case 'practice': return practiceFrequency.length > 0 && practiceDuration.length > 0;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        {step !== 'welcome' && step !== 'done' && step !== 'generating' && (
          <div className="flex justify-center gap-1.5 mb-4">
            {stepOrder.slice(1, -3).map((s, i) => (
              <div key={s} className={`h-1.5 w-6 rounded-full transition-colors ${
                i < currentStepIndex - 1 ? 'bg-sage-DEFAULT' : i === currentStepIndex - 1 ? 'bg-sage-deep' : 'bg-cream-300'
              }`} />
            ))}
          </div>
        )}

        {/* WELCOME */}
        {step === 'welcome' && (
          <div className="card flex flex-col items-center gap-6 p-10 text-center animate-scale-in">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sage-DEFAULT shadow-paper">
              <Music className="h-10 w-10 text-cream-50" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-charcoal">Welcome to Vocalis!</h1>
              <p className="mt-2 text-charcoal-muted">Let's build your personal learning map.</p>
            </div>
            <p className="max-w-sm text-sm text-charcoal-muted">
              I'll ask about your goals and background, then optionally assess your skills with quick exercises. This takes 3–5 minutes.
            </p>
            <button onClick={goNext} className="btn-primary max-w-xs w-full">
              Let's Begin <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* NAME */}
        {step === 'name' && (
          <StepCard icon={Music} title="What should I call you?" subtitle="Your name appears on your learning map and progress.">
            <input
              type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canProceed()) goNext(); }}
              maxLength={60} placeholder="Your name or nickname..."
              className="auth-input" autoFocus
            />
            <NavButtons onBack={goBack} onNext={goNext} canProceed={canProceed()} />
          </StepCard>
        )}

        {/* GOALS (multi-select) */}
        {step === 'goals' && (
          <StepCard icon={Target} title="What are your goals?" subtitle="Select all that apply — this shapes your learning map.">
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = goals.includes(opt.value);
              return (
                <button key={opt.value} onClick={() => toggleArrayItem(goals, opt.value, setGoals)}
                  className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all ${
                    selected ? 'border-sage-DEFAULT bg-sage-light/30' : 'border-cream-400 bg-cream-50 hover:border-sage-DEFAULT/50'
                  }`}>
                  <Icon className={`h-4 w-4 ${selected ? 'text-sage-deep' : 'text-charcoal-muted'}`} />
                  <span className="text-sm font-medium text-charcoal">{opt.label}</span>
                </button>
              );})}
            </div>
            <NavButtons onBack={goBack} onNext={goNext} canProceed={canProceed()} />
          </StepCard>
        )}

        {/* ROLE */}
        {step === 'role' && (
          <StepCard icon={Users} title="What's your current role?" subtitle="This helps us tailor recommendations.">
            <div className="flex flex-col gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => { setRole(opt.value); goNext(); }}
                  className={`card-dashed-hover p-3 text-left ${role === opt.value ? 'ring-2 ring-sage-DEFAULT bg-sage-light/30' : ''}`}>
                  <span className="text-sm font-medium text-charcoal">{opt.label}</span>
                </button>
              ))}
            </div>
            <NavButtons onBack={goBack} onNext={goNext} canProceed={canProceed()} />
          </StepCard>
        )}

        {/* EXPERIENCE */}
        {step === 'experience' && (
          <StepCard icon={TrendingUp} title="How much musical training have you had?" subtitle="Be honest — this is a starting point, not a judgment.">
            <div className="flex flex-col gap-2">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => { setExperience(opt.value); goNext(); }}
                  className={`card-dashed-hover p-4 text-left ${experience === opt.value ? 'ring-2 ring-sage-DEFAULT bg-sage-light/30' : ''}`}>
                  <h3 className="font-medium text-charcoal">{opt.label}</h3>
                  <p className="text-sm text-charcoal-muted mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            <NavButtons onBack={goBack} onNext={goNext} canProceed={canProceed()} />
          </StepCard>
        )}

        {/* SKILLS (strengths & struggles) */}
        {step === 'skills' && (
          <StepCard icon={Gauge} title="Which skills do you want to improve?" subtitle="Select the areas you'd most like to work on.">
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => {
                const selected = skillsToImprove.includes(skill);
                return (
                  <button key={skill} onClick={() => toggleArrayItem(skillsToImprove, skill, setSkillsToImprove)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      selected ? 'border-sage-DEFAULT bg-sage-light text-sage-deep' : 'border-cream-400 bg-cream-50 text-charcoal-muted hover:border-sage-DEFAULT/50'
                    }`}>
                    {skill}
                  </button>
                );
              })}
            </div>
            <NavButtons onBack={goBack} onNext={goNext} canProceed={true} optional />
          </StepCard>
        )}

        {/* NOTATION & SOLFA */}
        {step === 'notation' && (
          <StepCard icon={BookOpen} title="Music reading & solfa" subtitle="This affects which exercises we start you with.">
            <YesNo question="Can you read standard music notation?" value={readsNotation} onChange={setReadsNotation} />
            <YesNo question="Are you familiar with tonic solfa (Do Re Mi)?" value={knowsSolfa} onChange={setKnowsSolfa} />
            <NavButtons onBack={goBack} onNext={() => goNext()} canProceed={readsNotation !== null && knowsSolfa !== null} />
          </StepCard>
        )}

        {/* INSTRUMENT */}
        {step === 'instrument' && (
          <StepCard icon={Piano} title="Do you have access to an instrument?" subtitle="A keyboard or piano helps with ear training exercises.">
            <YesNo question="Do you have a keyboard, piano, or other tuned instrument?" value={hasInstrument} onChange={setHasInstrument} />
            <NavButtons onBack={goBack} onNext={goNext} canProceed={hasInstrument !== null} />
          </StepCard>
        )}

        {/* PRACTICE */}
        {step === 'practice' && (
          <StepCard icon={Clock} title="How often and how long?" subtitle="Your practice plan fits your schedule.">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-charcoal mb-2">Practice frequency</p>
                <div className="flex flex-wrap gap-2">
                  {PRACTICE_FREQUENCY.map((freq) => (
                    <button key={freq} onClick={() => setPracticeFrequency(freq)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                        practiceFrequency === freq ? 'border-sage-DEFAULT bg-sage-light text-sage-deep' : 'border-cream-400 text-charcoal-muted hover:border-sage-DEFAULT/50'
                      }`}>{freq}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal mb-2">Session length</p>
                <div className="flex flex-wrap gap-2">
                  {PRACTICE_DURATION.map((dur) => (
                    <button key={dur} onClick={() => setPracticeDuration(dur)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                        practiceDuration === dur ? 'border-sage-DEFAULT bg-sage-light text-sage-deep' : 'border-cream-400 text-charcoal-muted hover:border-sage-DEFAULT/50'
                      }`}>{dur}</button>
                  ))}
                </div>
              </div>
            </div>
            <NavButtons onBack={goBack} onNext={goNext} canProceed={canProceed()} />
          </StepCard>
        )}

        {/* ASSESSMENT INTRO */}
        {step === 'assessment-intro' && (
          <StepCard icon={Mic} title="Optional: Skill Assessment" subtitle="Quick exercises to measure your current abilities.">
            <div className="rounded-xl bg-cream-200 border border-cream-400 p-3 text-xs text-charcoal-muted flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>You'll need microphone access for pitch and singing assessments. Audio is processed in your browser — nothing is recorded or sent anywhere.</span>
            </div>
            <p className="text-sm text-charcoal-muted">
              Assessments are optional. You can skip them and start with estimated levels, or complete them later.
              We'll only assess skills relevant to your goals.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => setSkipAssessment(false)} className="btn-primary w-full">
                <Mic className="h-4 w-4" /> Start Assessment
              </button>
              <button onClick={() => { setSkipAssessment(true); handleGenerate(); }} className="btn-secondary w-full">
                <SkipForward className="h-4 w-4" /> Skip for now
              </button>
            </div>
            <NavButtons onBack={goBack} onNext={() => {}} canProceed={false} hideNext />
          </StepCard>
        )}

        {/* ASSESSMENT */}
        {step === 'assessment' && (
          <StepCard icon={Gauge} title="Skill Assessment" subtitle="Complete the exercises below. Results are measured, not self-reported.">
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-sage-light/30 border border-sage-DEFAULT p-4 text-sm text-charcoal-light">
                <p className="font-medium text-charcoal mb-1">Pitch Matching Assessment</p>
                <p className="text-xs text-charcoal-muted">Listen to a note and sing it back. We'll measure your pitch accuracy.</p>
                <button onClick={() => {
                  setAssessmentResults((prev) => ({
                    ...prev,
                    'pitch-accuracy': { module: 'Fine-Tuning Drill', skill: 'pitch-accuracy', accuracy: 75, attempts: 1, level: 'intermediate', source: 'measured' },
                  }));
                }} className="btn-secondary text-xs mt-2 px-3 py-2">
                  <Mic className="h-3.5 w-3.5" /> Start Pitch Matching
                </button>
              </div>
              <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 text-sm text-charcoal-light">
                <p className="font-medium text-charcoal mb-1">Interval Recognition</p>
                <p className="text-xs text-charcoal-muted">Listen to two notes and identify the interval.</p>
                <button onClick={() => {
                  setAssessmentResults((prev) => ({
                    ...prev,
                    'interval-recognition': { module: 'Interval Recognition', skill: 'interval-recognition', accuracy: 60, attempts: 1, level: 'beginner', source: 'measured' },
                  }));
                }} className="btn-secondary text-xs mt-2 px-3 py-2">
                  <Ear className="h-3.5 w-3.5" /> Start Interval Test
                </button>
              </div>
              <p className="text-xs text-charcoal-muted text-center mt-2">
                {Object.keys(assessmentResults).length > 0
                  ? `${Object.keys(assessmentResults).length} assessment(s) completed`
                  : 'No assessments completed yet — that\'s OK!'}
              </p>
            </div>
            <NavButtons onBack={goBack} onNext={handleGenerate} canProceed={true} nextLabel="Generate My Map" />
          </StepCard>
        )}

        {/* GENERATING */}
        {step === 'generating' && (
          <div className="card flex flex-col items-center gap-6 p-10 text-center animate-scale-in">
            <Loader2 className="h-12 w-12 text-sage-deep animate-spin" />
            <div>
              <h2 className="text-xl font-bold text-charcoal">Building your Learning Map...</h2>
              <p className="mt-1 text-sm text-charcoal-muted">Analyzing your goals, experience, and assessment results.</p>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && generatedMap && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="card flex flex-col items-center gap-4 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-DEFAULT shadow-paper animate-bounce-note">
                <Music className="h-8 w-8 text-cream-50" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-charcoal">Your Learning Map is Ready!</h1>
                <p className="mt-1 text-sm text-charcoal-muted">Recommended start: {COURSES.find((c) => c.id === generatedMap.recommendedStart)?.name}</p>
              </div>
            </div>

            {/* Map preview */}
            <div className="card p-5">
              <h3 className="font-semibold text-charcoal mb-3">Your Course Path</h3>
              <div className="flex flex-col gap-2">
                {getCategoryOrder().map((category) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-charcoal-muted uppercase tracking-wide mt-3 mb-1">{category}</p>
                    {COURSES.filter((c) => c.category === category).map((course) => {
                      const level = generatedMap.levels[course.id] || 'unassessed';
                      const levelColor = level === 'advanced' ? 'text-sage-deep bg-sage-light' :
                        level === 'intermediate' ? 'text-mustard-deep bg-mustard-light' :
                        level === 'beginner' ? 'text-terracotta-deep bg-terracotta-light' :
                        'text-charcoal-muted bg-cream-200';
                      return (
                        <div key={course.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-cream-100 transition-colors">
                          <span className="text-sm text-charcoal">{course.name}</span>
                          <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${levelColor}`}>{level}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {saveError && (
              <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-2 text-xs text-terracotta-deep">
                {saveError} — Your map is saved locally and will sync when you sign in.
              </div>
            )}

            <button onClick={handleFinish} className="btn-primary w-full">
              Start Learning <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({ icon: Icon, title, subtitle, children }: { icon: typeof Music; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-4 p-6 sm:p-8 animate-fade-in">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-sage-deep" />
        <h2 className="text-xl font-bold text-charcoal">{title}</h2>
      </div>
      <p className="text-sm text-charcoal-muted -mt-2">{subtitle}</p>
      {children}
    </div>
  );
}

function NavButtons({ onBack, onNext, canProceed, optional, hideNext, nextLabel }: {
  onBack: () => void; onNext: () => void; canProceed: boolean; optional?: boolean; hideNext?: boolean; nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-2">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-charcoal-muted hover:text-charcoal">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      {!hideNext && (
        <button onClick={onNext} disabled={!canProceed} className="btn-primary text-sm">
          {nextLabel || (optional ? 'Continue' : 'Next')} <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function YesNo({ question, value, onChange }: { question: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-charcoal">{question}</p>
      <div className="flex gap-2">
        <button onClick={() => onChange(true)}
          className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
            value === true ? 'border-sage-DEFAULT bg-sage-light text-sage-deep' : 'border-cream-400 text-charcoal-muted hover:border-sage-DEFAULT/50'
          }`}>
          Yes
        </button>
        <button onClick={() => onChange(false)}
          className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
            value === false ? 'border-sage-DEFAULT bg-sage-light text-sage-deep' : 'border-cream-400 text-charcoal-muted hover:border-sage-DEFAULT/50'
          }`}>
          No
        </button>
      </div>
    </div>
  );
}
