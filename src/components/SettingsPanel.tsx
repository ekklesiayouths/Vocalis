/**
 * Settings panel — user profile and Music Director role toggle.
 *
 * SECURITY: All state managed via UserContext (localStorage). The MD toggle
 * is purely a client-side UI switch — it does not grant server permissions.
 * Choir workspace database operations use existing RLS policies.
 */

import { Settings as SettingsIcon, Crown, User, RotateCcw, X, Mic, Music2 } from 'lucide-react';
import { useUser } from '@/context/UserContext';

interface SettingsPanelProps {
  onClose: () => void;
  onShowRangeChecker?: () => void;
}

export function SettingsPanel({ onClose, onShowRangeChecker }: SettingsPanelProps) {
  const { profile, toggleMusicDirector, resetProgress, setProfile } = useUser();

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

        {/* Vocal Range Checker */}
        {onShowRangeChecker && (
          <button
            onClick={onShowRangeChecker}
            className="btn-secondary w-full mb-4 text-sm"
          >
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
            {/* Toggle switch */}
            <button
              onClick={() => {
                toggleMusicDirector();
                if (profile.isMusicDirector) {
                  // Turning OFF: clear all local choir contexts and revert to singer view
                  localStorage.removeItem('vocalis-local-choirs');
                  setProfile((prev) => ({ ...prev, isMusicDirector: false }));
                }
              }}
              className={`relative h-7 w-12 rounded-full transition-colors ${profile.isMusicDirector ? 'bg-sage-DEFAULT' : 'bg-cream-300'}`}
            >
              <div
                className={`absolute top-1 h-5 w-5 rounded-full bg-cream-50 shadow-sm transition-transform ${profile.isMusicDirector ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
          {profile.isMusicDirector && (
            <p className="mt-3 text-xs text-sage-deep animate-fade-in">
              Music Director tools are now visible in your menu!
            </p>
          )}
        </div>

        {/* Reset */}
        <button
          onClick={() => { resetProgress(); onClose(); }}
          className="btn-terracotta w-full"
        >
          <RotateCcw className="h-4 w-4" /> Reset All Progress
        </button>
      </div>
    </div>
  );
}
