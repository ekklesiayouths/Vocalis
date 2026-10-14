/**
 * User state context — manages onboarding, role, and learning progress.
 *
 * SECURITY:
 * - Onboarding and role state is client-side React context, persisted to
 *   localStorage. No user data is sent to the database from this context.
 * - `completedModules` is synced from the database on app load: if the user
 *   has a Supabase session, we fetch their `profiles.completed_modules` array
 *   and merge it with the local state. This enables cross-device progress.
 * - Score submission still goes through the secure submit_score RPC, which
 *   also updates `profiles.completed_modules` server-side when accuracy >= 70%.
 * - The MD role toggle is purely a client-side UI state — it does not grant
 *   any server-side permissions.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface VocalRange {
  lowMidi: number;
  highMidi: number;
  classification: string;
}

export type UserRole = 'singer' | 'director';
export type ExperienceLevel = 'complete-beginner' | 'some-experience' | 'experienced';
export type GoalType = 'sing-better' | 'join-choir' | 'ear-training' | 'lead-choir';
export type TimeCommitment = '5-min' | '15-min' | '30-min';

export interface UserProfile {
  displayName: string;
  experience: ExperienceLevel | null;
  goal: GoalType | null;
  timeCommitment: TimeCommitment | null;
  isMusicDirector: boolean;
  onboarded: boolean;
  completedModules: string[];
  vocalRange?: VocalRange;
}

interface UserContextValue {
  profile: UserProfile;
  setProfile: (updater: (prev: UserProfile) => UserProfile) => void;
  completeOnboarding: (data: { experience: ExperienceLevel; goal: GoalType; timeCommitment: TimeCommitment; displayName: string }) => void;
  toggleMusicDirector: () => void;
  markModuleComplete: (moduleId: string) => void;
  resetProgress: () => void;
}

const STORAGE_KEY = 'vocalis-user-profile';

const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  experience: null,
  goal: null,
  timeCommitment: null,
  isMusicDirector: false,
  onboarded: false,
  completedModules: [],
};

/** Map DB module names (in completed_modules array) to LearningMap module IDs */
const DB_NAME_TO_MODULE_ID: Record<string, string> = {
  'Breath Tracker': 'breath-support',
  'Breath Support': 'breath-support',
  'Interval Recognition': 'intervals',
  'Fine-Tuning Drill': 'fine-tuning',
  'Fine Tuning Drill': 'fine-tuning',
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

const UserContext = createContext<UserContextValue | null>(null);

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(loadProfile);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // localStorage may be unavailable — fail silently
    }
  }, [profile]);

  // Sync completedModules from DB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!supabase) return;
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session || cancelled) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('completed_modules')
          .maybeSingle();

        if (cancelled || error || !data) return;

        const dbModules = data.completed_modules as string[] | null;
        if (!dbModules || dbModules.length === 0) return;

        // Map DB module names to LearningMap IDs
        const dbModuleIds = dbModules
          .map((name) => DB_NAME_TO_MODULE_ID[name] ?? name)
          .filter(Boolean);

        setProfileState((prev) => {
          const merged = [...new Set([...prev.completedModules, ...dbModuleIds])];
          if (merged.length === prev.completedModules.length) return prev;
          return { ...prev, completedModules: merged };
        });
      } catch {
        // Not signed in or table not accessible — fail silently
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setProfile = useCallback((updater: (prev: UserProfile) => UserProfile) => {
    setProfileState(updater);
  }, []);

  const completeOnboarding = useCallback((data: { experience: ExperienceLevel; goal: GoalType; timeCommitment: TimeCommitment; displayName: string }) => {
    setProfileState((prev) => ({
      ...prev,
      displayName: data.displayName,
      experience: data.experience,
      goal: data.goal,
      timeCommitment: data.timeCommitment,
      onboarded: true,
      isMusicDirector: data.goal === 'lead-choir',
    }));
  }, []);

  const toggleMusicDirector = useCallback(() => {
    setProfileState((prev) => ({ ...prev, isMusicDirector: !prev.isMusicDirector }));
  }, []);

  const markModuleComplete = useCallback((moduleId: string) => {
    setProfileState((prev) => ({
      ...prev,
      completedModules: prev.completedModules.includes(moduleId)
        ? prev.completedModules
        : [...prev.completedModules, moduleId],
    }));
  }, []);

  const resetProgress = useCallback(() => {
    setProfileState(DEFAULT_PROFILE);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return (
    <UserContext.Provider value={{ profile, setProfile, completeOnboarding, toggleMusicDirector, markModuleComplete, resetProgress }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
