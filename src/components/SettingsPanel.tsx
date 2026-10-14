/**
 * Settings panel — user profile, Music Director toggle, account management.
 *
 * Features:
 * - Display profile info (name, experience, goal, vocal range)
 * - Music Director mode toggle (client-side UI only)
 * - Vocal range checker access
 * - Account info for signed-in users (email, consent status)
 * - Data export (download profile data as JSON)
 * - Account deletion (requires signed-in session, calls edge function)
 * - Cookie preferences revisit
 * - Reset local progress
 *
 * SECURITY:
 * - Account deletion calls a SECURITY DEFINER edge function that deletes
 *   the auth.users row — this cascades to all user data via FK constraints.
 * - The edge function uses the service-role key (never exposed to client).
 * - Profile edits go through authenticated Supabase client with RLS.
 */

import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Crown, User, RotateCcw, X, Mic, Music2, Download, Trash2, AlertCircle, Loader2, Mail, Shield, Cookie, Check } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { fetchProfile } from '@/lib/profileService';
import { loadConsent } from '@/components/CookieConsent';

interface SettingsPanelProps {
  onClose: () => void;
  onShowRangeChecker?: () => void;
  onSignOut?: () => void;
}

export function SettingsPanel({ onClose, onShowRangeChecker, onSignOut }: SettingsPanelProps) {
  const { profile, toggleMusicDirector, resetProgress, setProfile } = useUser();
  const { session, signOut } = useAuth();
  const [dbProfile, setDbProfile] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (session) {
      fetchProfile().then(setDbProfile);
    }
  }, [session]);

  const experienceLabel = profile.experience === 'complete-beginner' ? 'Complete Beginner' :
    profile.experience === 'some-experience' ? 'Some Experience' :
    profile.experience === 'experienced' ? 'Experienced' : 'Not set';

  const goalLabel = profile.goal === 'sing-better' ? 'Sing Better' :
    profile.goal === 'join-choir' ? 'Join a Choir' :
    profile.goal === 'lead-choir' ? 'Lead a Choir' :
    profile.goal === 'ear-training' ? 'Train My Ear' : 'Not set';

  const timeLabel = profile.timeCommitment === '5-min' ? '5 Minutes/day' :
    profile.timeCommitment === '15-min' ? '15 Minutes/day' :
    profile.timeCommitment === '30-min' ? '30 Minutes/day' : 'Not set';

  const consent = loadConsent();
  const termsAccepted = dbProfile?.terms_accepted_version as string | undefined;
  const privacyAcknowledged = dbProfile?.privacy_policy_acknowledged_version as string | undefined;

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const exportData: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        localProfile: profile,
      };
      if (dbProfile) {
        exportData.databaseProfile = dbProfile;
      }
      if (session) {
        const { data: scores } = await supabase?.from('scores').select('*') ?? { data: null };
        if (scores) exportData.scores = scores;
        const { data: attempts } = await supabase?.from('exercise_attempts').select('*') ?? { data: null };
        if (attempts) exportData.exerciseAttempts = attempts;
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vocalis-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
    setExporting(false);
  }, [profile, dbProfile, session]);

  const handleDeleteAccount = useCallback(async () => {
    if (!session || !supabase) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setDeleteError('No active session. Please sign in again.');
        setDeleting(false);
        return;
      }
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/account-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setDeleteError(body.error || `Request failed (${response.status})`);
        setDeleting(false);
        return;
      }
      await signOut();
      resetProgress();
      setDeleting(false);
      setDeleteConfirm(false);
      onSignOut?.();
      onClose();
    } catch {
      setDeleteError('Network error. Please try again.');
      setDeleting(false);
    }
  }, [session, signOut, resetProgress, onSignOut, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-6 shadow-paper-lg animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-charcoal" />
            <h3 className="text-lg font-bold text-charcoal">Settings</h3>
          </div>
          <button onClick={onClose} className="text-charcoal-muted hover:text-charcoal transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profile info */}
        <div className="rounded-xl bg-cream-200 border border-cream-400 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-sage-deep" />
            <span className="text-sm font-semibold text-charcoal">Your Profile</span>
          </div>
          <div className="space-y-1.5 text-sm text-charcoal-light">
            <p><span className="text-charcoal-muted">Name:</span> {profile.displayName || 'Friend'}</p>
            {session && Boolean(dbProfile?.email) && (
              <p className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-charcoal-muted" /> {String(dbProfile!.email)}</p>
            )}
            <p><span className="text-charcoal-muted">Experience:</span> {experienceLabel}</p>
            <p><span className="text-charcoal-muted">Goal:</span> {goalLabel}</p>
            <p><span className="text-charcoal-muted">Daily time:</span> {timeLabel}</p>
            <p><span className="text-charcoal-muted">Modules completed:</span> {profile.completedModules.length}</p>
            {profile.vocalRange && (
              <p className="flex items-center gap-1.5">
                <span className="text-charcoal-muted">Voice type:</span>
                <span className="flex items-center gap-1 rounded-md bg-sage-light border border-sage-DEFAULT px-2 py-0.5 text-xs font-medium text-sage-deep">
                  <Music2 className="h-3 w-3" /> {profile.vocalRange.classification}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Account status */}
        {session ? (
          <div className="rounded-xl bg-sage-light/30 border border-sage-DEFAULT p-3 mb-4 text-xs text-charcoal-light">
            <p className="flex items-center gap-1.5 font-medium text-sage-deep"><Check className="h-3 w-3" /> Signed in</p>
            <div className="mt-1.5 space-y-0.5">
              {termsAccepted && <p>Terms accepted: v{termsAccepted}</p>}
              {privacyAcknowledged && <p>Privacy acknowledged: v{privacyAcknowledged}</p>}
              {!termsAccepted && <p className="text-mustard-deep">Terms acceptance not recorded</p>}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-3 mb-4 text-xs text-charcoal-muted">
            <p>Not signed in. Sign in to sync your progress across devices and save your learning map.</p>
          </div>
        )}

        {/* Vocal Range Checker */}
        {onShowRangeChecker && (
          <button onClick={onShowRangeChecker} className="btn-secondary w-full mb-4 text-sm">
            <Mic className="h-4 w-4" /> {profile.vocalRange ? 'Redo Vocal Range Check' : 'Discover Your Vocal Range'}
          </button>
        )}

        {/* MD Toggle */}
        <div className="rounded-xl bg-cream-50 border border-cream-400 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${profile.isMusicDirector ? 'bg-mustard-DEFAULT shadow-paper-mustard' : 'bg-cream-200 border border-cream-400'}`}>
                <Crown className={`h-5 w-5 ${profile.isMusicDirector ? 'text-charcoal' : 'text-charcoal-muted'}`} />
              </div>
              <div>
                <h4 className="font-semibold text-charcoal">Music Director Mode</h4>
                <p className="text-xs text-charcoal-muted">Unlock choir management tools</p>
              </div>
            </div>
            <button
              onClick={() => {
                toggleMusicDirector();
                if (profile.isMusicDirector) {
                  localStorage.removeItem('vocalis-local-choirs');
                  setProfile((prev) => ({ ...prev, isMusicDirector: false }));
                }
              }}
              className={`relative h-7 w-12 rounded-full transition-colors ${profile.isMusicDirector ? 'bg-sage-DEFAULT' : 'bg-cream-300'}`}
            >
              <div className={`absolute top-1 h-5 w-5 rounded-full bg-cream-50 shadow-sm transition-transform ${profile.isMusicDirector ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Data & Privacy section */}
        <div className="rounded-xl bg-cream-50 border border-cream-400 p-4 mb-4">
          <h4 className="font-semibold text-charcoal text-sm mb-3 flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-sage-deep" /> Data & Privacy
          </h4>
          <div className="flex flex-col gap-2">
            <button onClick={handleExport} disabled={exporting} className="btn-secondary text-sm w-full">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export my data
            </button>
            {consent && (
              <p className="text-xs text-charcoal-muted flex items-center gap-1">
                <Cookie className="h-3 w-3" /> Cookie preferences set on {new Date(consent.timestamp).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Account deletion (signed in only) */}
        {session && (
          <div className="rounded-xl bg-terracotta-light/50 border border-terracotta-DEFAULT p-4 mb-4">
            <h4 className="font-semibold text-charcoal text-sm mb-2 flex items-center gap-1.5">
              <Trash2 className="h-4 w-4 text-terracotta-deep" /> Delete Account
            </h4>
            {!deleteConfirm ? (
              <>
                <p className="text-xs text-charcoal-muted mb-2">
                  Permanently delete your account and all associated data (profile, scores, choir memberships). This cannot be undone.
                </p>
                <button onClick={() => setDeleteConfirm(true)} className="btn-terracotta text-sm w-full">
                  <Trash2 className="h-4 w-4" /> Request account deletion
                </button>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-terracotta-light border border-terracotta-DEFAULT p-2 mb-2 text-xs text-terracotta-deep flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>This will permanently delete your account, profile, scores, and choir memberships. This action cannot be reversed.</span>
                </div>
                {deleteError && <p className="text-xs text-terracotta-deep mb-2">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleDeleteAccount} disabled={deleting} className="btn-terracotta text-sm flex-1">
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm deletion'}
                  </button>
                  <button onClick={() => { setDeleteConfirm(false); setDeleteError(null); }} className="btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Reset local progress */}
        <button onClick={() => { resetProgress(); onClose(); }} className="btn-terracotta w-full">
          <RotateCcw className="h-4 w-4" /> Reset Local Progress
        </button>
      </div>
    </div>
  );
}
