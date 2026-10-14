/**
 * Auth page — handles registration, login, and password reset.
 *
 * Modes: 'login' | 'register' | 'forgot' | 'reset'
 *
 * SECURITY:
 * - Uses Supabase auth.signUp / signInWithPassword / resetPasswordForEmail
 * - All inputs validated client-side before submission
 * - Loading states prevent duplicate submissions
 * - Errors from the backend are displayed to the user
 * - No localStorage flags used for auth state — real session only
 */

import { useState, useCallback } from 'react';
import { Music, Eye, EyeOff, ArrowRight, ArrowLeft, Check, AlertCircle, Loader2, Mail, Lock, User, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {
  validateEmail, validatePassword, validateFullName, validateAge,
} from '@/lib/validation';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

interface AuthPageProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
  onSwitchMode?: (mode: AuthMode) => void;
}

const TERMS_VERSION = '2026-10-14';
const PRIVACY_VERSION = '2026-10-14';

export function AuthPage({ initialMode = 'login', onSuccess, onSwitchMode }: AuthPageProps) {
  const { signUp, signIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [ackPrivacy, setAckPrivacy] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordReqs, setPasswordReqs] = useState<string[]>([]);

  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    onSwitchMode?.(newMode);
  }, [onSwitchMode]);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    const check = validatePassword(value);
    setPasswordStrength(check.strength);
    setPasswordReqs(check.requirements);
  };

  const handleRegister = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) { setError(nameCheck.error!); return; }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) { setError(emailCheck.error!); return; }

    const passCheck = validatePassword(password);
    if (!passCheck.valid) { setError(passCheck.error!); return; }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const ageCheck = validateAge(age);
    if (!ageCheck.valid) { setError(ageCheck.error!); return; }

    if (!agreeTerms) {
      setError('You must accept the Terms of Service to register');
      return;
    }
    if (!ackPrivacy) {
      setError('You must acknowledge the Privacy Policy to register');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUp(emailCheck.value, passCheck.value, {
      full_name: nameCheck.value,
      age: ageCheck.value,
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }

    setSuccess('Account created! Please check your email to verify your account before signing in.');
  }, [fullName, email, password, confirmPassword, age, agreeTerms, ackPrivacy, signUp]);

  const handleLogin = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) { setError(emailCheck.error!); return; }

    if (password.length === 0) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    const { error: signInError } = await signIn(emailCheck.value, password);
    setLoading(false);

    if (signInError) {
      setError(signInError);
      return;
    }

    onSuccess?.();
  }, [email, password, signIn, onSuccess]);

  const handleForgot = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) { setError(emailCheck.error!); return; }

    setLoading(true);
    const { error: resetError } = await resetPassword(emailCheck.value);
    setLoading(false);

    if (resetError) {
      setError(resetError);
      return;
    }

    setSuccess('Password reset link sent! Check your email for instructions.');
  }, [email, resetPassword]);

  const strengthLabels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-terracotta-deep', 'bg-terracotta-DEFAULT', 'bg-mustard-DEFAULT', 'bg-sage-DEFAULT', 'bg-sage-deep'];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-DEFAULT shadow-paper mb-3">
            <Music className="h-8 w-8 text-cream-50" />
          </div>
          <h1 className="text-2xl font-bold text-charcoal">Vocalis</h1>
          <p className="text-sm text-charcoal-muted mt-1">
            {mode === 'register' && 'Create your account'}
            {mode === 'login' && 'Welcome back'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Set a new password'}
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          {error && (
            <div className="mb-4 rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep flex items-start gap-2 animate-fade-in">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl bg-sage-light border border-sage-DEFAULT px-4 py-3 text-sm text-sage-deep flex items-start gap-2 animate-fade-in">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* REGISTER MODE */}
          {mode === 'register' && (
            <div className="flex flex-col gap-4">
              <Field label="Full name" icon={User}>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={120}
                  className="auth-input"
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </Field>

              <Field label="Email address" icon={Mail}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>

              <Field label="Age" icon={Calendar}>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  min={5}
                  max={120}
                  className="auth-input"
                  placeholder="25"
                />
              </Field>

              <Field label="Password" icon={Lock}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="auth-input pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-muted hover:text-charcoal"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {password.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i < passwordStrength ? strengthColors[passwordStrength] : 'bg-cream-300'
                        }`}
                      />
                    ))}
                  </div>
                  {passwordReqs.length > 0 && (
                    <p className="text-xs text-charcoal-muted">
                      Needs: {passwordReqs.join(', ')}
                    </p>
                  )}
                  {passwordReqs.length === 0 && password.length > 0 && (
                    <p className="text-xs text-sage-deep">{strengthLabels[passwordStrength]} password</p>
                  )}
                </div>
              )}

              <Field label="Confirm password" icon={Lock}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input"
                  autoComplete="new-password"
                />
              </Field>

              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-terracotta-deep">Passwords do not match</p>
              )}

              {/* Consent checkboxes */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-cream-400 text-sage-deep focus:ring-sage-DEFAULT"
                />
                <span className="text-sm text-charcoal-light">
                  I accept the{' '}
                  <a href="/terms" target="_blank" className="text-sage-deep underline hover:text-sage-dark">Terms of Service</a>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackPrivacy}
                  onChange={(e) => setAckPrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-cream-400 text-sage-deep focus:ring-sage-DEFAULT"
                />
                <span className="text-sm text-charcoal-light">
                  I acknowledge the{' '}
                  <a href="/privacy" target="_blank" className="text-sage-deep underline hover:text-sage-dark">Privacy Policy</a>
                </span>
              </label>

              <button
                onClick={handleRegister}
                disabled={loading}
                className="btn-primary w-full mt-2"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create Account <ArrowRight className="h-4 w-4" /></>}
              </button>

              <p className="text-center text-sm text-charcoal-muted">
                Already have an account?{' '}
                <button onClick={() => switchMode('login')} className="text-sage-deep font-medium hover:text-sage-dark">
                  Sign in
                </button>
              </p>
            </div>
          )}

          {/* LOGIN MODE */}
          {mode === 'login' && (
            <div className="flex flex-col gap-4">
              <Field label="Email address" icon={Mail}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </Field>

              <Field label="Password" icon={Lock}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-muted hover:text-charcoal"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <button
                onClick={() => switchMode('forgot')}
                className="text-right text-xs text-charcoal-muted hover:text-sage-deep"
              >
                Forgot password?
              </button>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
              </button>

              <p className="text-center text-sm text-charcoal-muted">
                New to Vocalis?{' '}
                <button onClick={() => switchMode('register')} className="text-sage-deep font-medium hover:text-sage-dark">
                  Create an account
                </button>
              </p>
            </div>
          )}

          {/* FORGOT PASSWORD MODE */}
          {mode === 'forgot' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-charcoal-muted">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <Field label="Email address" icon={Mail}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </Field>

              <button
                onClick={handleForgot}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Send Reset Link <ArrowRight className="h-4 w-4" /></>}
              </button>

              <button
                onClick={() => switchMode('login')}
                className="flex items-center justify-center gap-1.5 text-sm text-charcoal-muted hover:text-charcoal"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </button>
            </div>
          )}

          {/* RESET MODE (after clicking email link) */}
          {mode === 'reset' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-charcoal-muted">
                Enter your new password below.
              </p>
              <Field label="New password" icon={Lock}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="auth-input pr-10"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-muted hover:text-charcoal"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {passwordReqs.length > 0 && (
                <p className="text-xs text-charcoal-muted">Needs: {passwordReqs.join(', ')}</p>
              )}

              <Field label="Confirm new password" icon={Lock}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input"
                  autoComplete="new-password"
                />
              </Field>

              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-terracotta-deep">Passwords do not match</p>
              )}

              <button
                onClick={async () => {
                  const passCheck = validatePassword(password);
                  if (!passCheck.valid) { setError(passCheck.error!); return; }
                  if (password !== confirmPassword) { setError('Passwords do not match'); return; }
                  if (!supabase) return;
                  setLoading(true);
                  const { error: updateError } = await supabase.auth.updateUser({ password });
                  setLoading(false);
                  if (updateError) { setError(updateError.message); return; }
                  setSuccess('Password updated! You can now sign in.');
                  setTimeout(() => switchMode('login'), 2000);
                }}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Update Password <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          )}
        </div>

        {/* Public access link */}
        <p className="text-center mt-4 text-xs text-charcoal-muted">
          <button onClick={onSuccess} className="hover:text-sage-deep">
            Continue without an account
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-charcoal">
        <Icon className="h-3.5 w-3.5 text-charcoal-muted" />
        {label}
      </label>
      {children}
    </div>
  );
}
