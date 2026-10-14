/**
 * Onboarding flow — conversational questions to build a personalized roadmap.
 *
 * Asks: name, experience level, goal, daily time commitment.
 * Then calls completeOnboarding to save the profile.
 *
 * SECURITY: All input sanitized via sanitizeText. No data sent to the
 * database — stored in localStorage via UserContext.
 */

import { useState } from 'react';
import { Music, ArrowRight, Heart, Clock, Target, Sparkles, Mic } from 'lucide-react';
import { useUser, type ExperienceLevel, type GoalType, type TimeCommitment } from '@/context/UserContext';
import { sanitizeText } from '@/lib/validation';
import { VocalRangeChecker } from '@/components/VocalRangeChecker';

type Step = 'welcome' | 'name' | 'experience' | 'goal' | 'time' | 'range' | 'done';

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'complete-beginner', label: 'Complete Beginner', description: 'I have never sung or trained before' },
  { value: 'some-experience', label: 'Some Experience', description: 'I sing casually but want to improve' },
  { value: 'experienced', label: 'Experienced', description: 'I have trained or sung in choirs before' },
];

const GOAL_OPTIONS: { value: GoalType; label: string; description: string }[] = [
  { value: 'sing-better', label: 'Sing Better', description: 'I want to improve my voice' },
  { value: 'join-choir', label: 'Join a Choir', description: 'I want to prepare for singing with others' },
  { value: 'lead-choir', label: 'Lead a Choir', description: 'I am a music director or want to become one' },
  { value: 'ear-training', label: 'Train My Ear', description: 'I want to recognize notes and intervals' },
];

const TIME_OPTIONS: { value: TimeCommitment; label: string; description: string }[] = [
  { value: '5-min', label: '5 Minutes', description: 'A quick daily warm-up' },
  { value: '15-min', label: '15 Minutes', description: 'A solid practice session' },
  { value: '30-min', label: '30 Minutes', description: 'A deep, focused practice' },
];

export function Onboarding() {
  const { completeOnboarding } = useUser();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [goal, setGoal] = useState<GoalType | null>(null);
  const [time, setTime] = useState<TimeCommitment | null>(null);

  const handleFinish = () => {
    if (experience && goal && time) {
      const cleanName = sanitizeText(name, 60) || 'Friend';
      completeOnboarding({ experience, goal, timeCommitment: time, displayName: cleanName });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {step === 'welcome' && (
          <div className="card flex flex-col items-center gap-6 p-10 text-center animate-scale-in">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sage-DEFAULT shadow-paper">
              <Music className="h-10 w-10 text-cream-50" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-charcoal">Welcome to Vocalis!</h1>
              <p className="mt-2 text-charcoal-muted">Your cozy, personal vocal training companion.</p>
            </div>
            <p className="max-w-sm text-sm text-charcoal-muted">
              Let's get to know each other first. I'll ask a few quick questions to build your personal learning map — it only takes a minute!
            </p>
            <button onClick={() => setStep('name')} className="btn-primary max-w-xs w-full">
              Let's Begin <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="card flex flex-col gap-5 p-8 animate-fade-in">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-terracotta-deep" />
              <h2 className="text-xl font-bold text-charcoal">What should I call you?</h2>
            </div>
            <p className="text-sm text-charcoal-muted">Your name will appear on your learning map and progress.</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setStep('experience'); }}
              maxLength={60}
              placeholder="Your name or nickname..."
              className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-3 text-charcoal placeholder-charcoal-muted/50 outline-none focus:border-sage-DEFAULT"
              autoFocus
            />
            <div className="flex justify-end">
              <button onClick={() => setStep('experience')} className="btn-primary">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'experience' && (
          <div className="card flex flex-col gap-5 p-8 animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-mustard-deep" />
              <h2 className="text-xl font-bold text-charcoal">How much have you sung before?</h2>
            </div>
            <div className="flex flex-col gap-3">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setExperience(opt.value); setStep('goal'); }}
                  className={`card-dashed-hover p-4 text-left ${experience === opt.value ? 'ring-2 ring-sage-DEFAULT bg-sage-light/30' : ''}`}
                >
                  <h3 className="font-medium text-charcoal">{opt.label}</h3>
                  <p className="text-sm text-charcoal-muted mt-1">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'goal' && (
          <div className="card flex flex-col gap-5 p-8 animate-fade-in">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-sage-deep" />
              <h2 className="text-xl font-bold text-charcoal">What is your dream?</h2>
            </div>
            <div className="flex flex-col gap-3">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setGoal(opt.value); setStep('time'); }}
                  className={`card-dashed-hover p-4 text-left ${goal === opt.value ? 'ring-2 ring-sage-DEFAULT bg-sage-light/30' : ''}`}
                >
                  <h3 className="font-medium text-charcoal">{opt.label}</h3>
                  <p className="text-sm text-charcoal-muted mt-1">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'time' && (
          <div className="card flex flex-col gap-5 p-8 animate-fade-in">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-terracotta-deep" />
              <h2 className="text-xl font-bold text-charcoal">How much time each day?</h2>
            </div>
            <p className="text-sm text-charcoal-muted">Be honest — I'll tailor your daily practice to fit!</p>
            <div className="flex flex-col gap-3">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setTime(opt.value); setStep('range'); }}
                  className={`card-dashed-hover p-4 text-left ${time === opt.value ? 'ring-2 ring-sage-DEFAULT bg-sage-light/30' : ''}`}
                >
                  <h3 className="font-medium text-charcoal">{opt.label}</h3>
                  <p className="text-sm text-charcoal-muted mt-1">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'range' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-sage-deep" />
              <h2 className="text-xl font-bold text-charcoal">Discover Your Vocal Range</h2>
            </div>
            <p className="text-sm text-charcoal-muted">
              Let's find your vocal range! This helps us personalize your learning and show your comfortable notes on the piano. You can skip this and do it later from Settings.
            </p>
            <VocalRangeChecker onComplete={() => setStep('done')} onCancel={() => setStep('done')} />
          </div>
        )}

        {step === 'done' && (
          <div className="card flex flex-col items-center gap-6 p-10 text-center animate-scale-in">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sage-DEFAULT shadow-paper animate-bounce-note">
              <Music className="h-10 w-10 text-cream-50" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-charcoal">Wonderful, {sanitizeText(name, 60) || 'Friend'}!</h1>
              <p className="mt-2 text-charcoal-muted">Your personal learning map is ready.</p>
            </div>
            <p className="max-w-sm text-sm text-charcoal-muted">
              {goal === 'lead-choir' && "Since you want to lead a choir, I've unlocked the Music Director tools for you too!"}
              {goal !== 'lead-choir' && "We'll start with the basics and unlock more as you grow. You can always change your settings later!"}
            </p>
            <button onClick={handleFinish} className="btn-primary max-w-xs w-full">
              See My Learning Map <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
