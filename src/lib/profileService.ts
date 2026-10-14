/**
 * Profile service — persists user profile, consent, and onboarding data
 * to the Supabase profiles table.
 *
 * SECURITY:
 * - All writes go through the authenticated Supabase client
 * - RLS enforces auth.uid() = id on profiles
 * - No sensitive auth data (passwords, tokens) is stored
 */

import { supabase } from './supabaseClient';

export interface OnboardingData {
  goals: string[];
  role: string;
  experience: string;
  readsNotation: boolean;
  knowsSolfa: boolean;
  hasInstrument: boolean;
  practiceFrequency: string;
  practiceDuration: string;
  skillsToImprove: string[];
  strengths: string[];
  struggles: string[];
  assessmentResults: Record<string, AssessmentResult>;
}

export interface AssessmentResult {
  module: string;
  skill: string;
  accuracy: number;
  attempts: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'unassessed';
  source: 'measured' | 'self-reported' | 'estimated';
}

export interface LearningMapData {
  recommendedStart: string;
  sequence: string[];
  levels: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'unassessed'>;
  reasons: Record<string, string>;
  practicePlan: { frequency: string; duration: string };
  generatedAt: string;
}

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user.id ?? null;
}

export async function fetchProfile(): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function updateProfile(fields: Record<string, unknown>): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Not connected' };
  const userId = await getCurrentUserId();
  if (!userId) return { error: 'Not signed in' };
  const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function saveOnboardingData(data: OnboardingData, step?: string): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = { onboarding_data: data };
  if (step) updates.onboarding_step = step;
  return updateProfile(updates);
}

export async function completeOnboarding(map: LearningMapData): Promise<{ error: string | null }> {
  return updateProfile({
    onboarding_completed: true,
    onboarding_step: null,
    learning_map: map,
    learning_map_generated_at: new Date().toISOString(),
  });
}

export async function saveConsent(consent: {
  termsVersion?: string;
  privacyVersion?: string;
  cookieConsent?: Record<string, unknown>;
}): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {};
  if (consent.termsVersion) {
    updates.terms_accepted_version = consent.termsVersion;
    updates.terms_accepted_at = new Date().toISOString();
  }
  if (consent.privacyVersion) {
    updates.privacy_policy_acknowledged_version = consent.privacyVersion;
    updates.privacy_policy_acknowledged_at = new Date().toISOString();
  }
  if (consent.cookieConsent) {
    updates.cookie_consent = consent.cookieConsent;
  }
  if (Object.keys(updates).length === 0) return { error: null };
  return updateProfile(updates);
}
