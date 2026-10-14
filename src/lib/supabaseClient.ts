/**
 * Supabase client singleton.
 *
 * When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present, creates a
 * real Supabase client. When they are absent, exports null so the rest of
 * the app can degrade gracefully — local-only features (warm-ups, academy
 * modules, playground, onboarding) keep working, and backend features
 * (choir space, score sync, AI tutor) show a clear "sign in" message
 * instead of crashing the page.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
