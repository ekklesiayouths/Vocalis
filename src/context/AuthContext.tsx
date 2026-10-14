/**
 * Authentication context — manages Supabase auth session state.
 *
 * Provides:
 * - Current session and user
 * - Loading state during session restoration
 * - signUp, signIn, signOut, resetPassword, resendVerification methods
 * - onAuthStateChange subscription with deadlock guard
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata: { full_name: string; age: number }) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  resendVerification: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata: { full_name: string; age: number },
  ): Promise<{ error: string | null }> => {
    if (!supabase) return { error: 'Authentication is not configured.' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signIn = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ error: string | null }> => {
    if (!supabase) return { error: 'Authentication is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (
    email: string,
  ): Promise<{ error: string | null }> => {
    if (!supabase) return { error: 'Authentication is not configured.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const resendVerification = useCallback(async (): Promise<{ error: string | null }> => {
    if (!supabase || !user?.email) return { error: 'No user to verify.' };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, [user]);

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut, resetPassword, resendVerification }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
