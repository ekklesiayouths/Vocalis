/**
 * Main application component — Vocalis.
 * Handles auth routing, onboarding gate, legal pages, and main app navigation.
 */

import { useState, useEffect } from 'react';
import { Mic, GraduationCap, Gamepad2, Users, Music, Settings as SettingsIcon, Crown, Map, Piano, Music2, LogOut, FileText, Shield } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Onboarding } from '@/components/Onboarding';
import { EnhancedOnboarding } from '@/components/EnhancedOnboarding';
import { AuthPage } from '@/components/AuthPage';
import { TermsPage, PrivacyPage } from '@/components/LegalPages';
import { CookieConsent } from '@/components/CookieConsent';
import { WarmUpDashboard } from '@/components/WarmUpDashboard';
import { AcademyDashboard } from '@/components/AcademyDashboard';
import { Playground } from '@/components/Playground';
import { LearningMap } from '@/components/LearningMap';
import { ChoirSpace } from '@/components/ChoirSpace';
import { SettingsPanel } from '@/components/SettingsPanel';
import { VirtualPiano } from '@/components/VirtualPiano';
import { PitchPipe } from '@/components/PitchPipe';
import { VocalRangeChecker } from '@/components/VocalRangeChecker';

type AppMode = 'warmup' | 'map' | 'academy' | 'playground' | 'choir';
type AppView = 'auth' | 'onboarding' | 'app' | 'terms' | 'privacy';

interface NavItem {
  mode: AppMode;
  label: string;
  icon: typeof Mic;
}

function App() {
  const { profile } = useUser();
  const { session, loading, signOut } = useAuth();
  const [view, setView] = useState<AppView>('app');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [activeMode, setActiveMode] = useState<AppMode>('map');
  const [showSettings, setShowSettings] = useState(false);
  const [showPiano, setShowPiano] = useState(false);
  const [showPitchPipe, setShowPitchPipe] = useState(false);
  const [showRangeChecker, setShowRangeChecker] = useState(false);

  // Check URL for auth redirect (password reset, email verification)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const hash = window.location.hash;
    if (mode === 'reset' || hash.includes('type=recovery')) {
      setAuthMode('reset');
      setView('auth');
    }
  }, []);

  // Listen for navigation events from child components (e.g. legal links in auth)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'terms') setView('terms');
      if (detail === 'privacy') setView('privacy');
    };
    window.addEventListener('vocalis-navigate', handler);
    return () => window.removeEventListener('vocalis-navigate', handler);
  }, []);

  // Determine view: auth > onboarding > app
  // If user is not onboarded and we're not showing auth/legal, show onboarding
  useEffect(() => {
    if (loading) return;
    if (view === 'terms' || view === 'privacy') return;
    if (!profile.onboarded && view !== 'auth') {
      setView('onboarding');
    }
  }, [profile.onboarded, loading, view]);

  // Handle auth success
  const handleAuthSuccess = () => {
    // After login or "continue without account", go to app
    if (!profile.onboarded) {
      setView('onboarding');
    } else {
      setView('app');
    }
  };

  // Show auth page
  if (view === 'auth') {
    return (
      <>
        <AuthPage
          initialMode={authMode}
          onSuccess={handleAuthSuccess}
          onSwitchMode={(m) => setAuthMode(m)}
        />
        <CookieConsent />
      </>
    );
  }

  // Legal pages
  if (view === 'terms') {
    return <TermsPage onBack={() => setView(profile.onboarded ? 'app' : 'auth')} />;
  }
  if (view === 'privacy') {
    return <PrivacyPage onBack={() => setView(profile.onboarded ? 'app' : 'auth')} />;
  }

  // Onboarding gate
  if (!profile.onboarded) {
    return <EnhancedOnboarding onComplete={() => setView('app')} />;
  }

  const navItems: NavItem[] = [
    { mode: 'warmup', label: 'Warm-Up', icon: Mic },
    { mode: 'map', label: 'My Map', icon: Map },
    { mode: 'academy', label: 'Academy', icon: GraduationCap },
    { mode: 'playground', label: 'Playground', icon: Gamepad2 },
    { mode: 'choir' as AppMode, label: 'Choir', icon: Users },
  ];

  return (
    <div className="min-h-screen text-charcoal pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-cream-400 bg-cream-100/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-DEFAULT shadow-paper-sm transition-transform hover:scale-105">
              <Music className="h-6 w-6 text-cream-50" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-charcoal">Vocalis</h1>
              <p className="text-xs text-charcoal-muted">
                Hi, {profile.displayName}!{session && <span className="text-sage-deep"> · Signed in</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile.isMusicDirector && (
              <div className="hidden items-center gap-1.5 rounded-xl bg-mustard-light border border-mustard-DEFAULT px-2.5 py-1.5 text-xs font-medium text-mustard-deep sm:flex">
                <Crown className="h-3.5 w-3.5" /> MD Mode
              </div>
            )}
            {profile.vocalRange && (
              <button
                onClick={() => setShowRangeChecker(true)}
                className="hidden items-center gap-1.5 rounded-xl bg-sage-light border border-sage-DEFAULT px-2.5 py-1.5 text-xs font-medium text-sage-deep sm:flex transition-all hover:bg-sage-DEFAULT hover:text-cream-50"
              >
                <Music2 className="h-3.5 w-3.5" /> {profile.vocalRange.classification}
              </button>
            )}
            {session ? (
              <button
                onClick={() => { signOut(); setView('auth'); setAuthMode('login'); }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-200 border border-cream-400 text-charcoal-muted transition-all hover:bg-cream-300 hover:text-charcoal active:translate-y-0.5"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => { setAuthMode('login'); setView('auth'); }}
                className="flex items-center gap-1.5 rounded-xl bg-sage-light border border-sage-DEFAULT px-3 py-1.5 text-xs font-medium text-sage-deep transition-all hover:bg-sage-DEFAULT hover:text-cream-50"
              >
                Sign in
              </button>
            )}
            <button
              onClick={() => setShowPitchPipe(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-200 border border-cream-400 text-charcoal-muted transition-all hover:bg-cream-300 hover:text-charcoal active:translate-y-0.5"
              title="Pitch Pipe"
            >
              <Music2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-200 border border-cream-400 text-charcoal-muted transition-all hover:bg-cream-300 hover:text-charcoal active:translate-y-0.5"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden gap-1 px-4 pb-2 sm:flex max-w-5xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.mode}
                onClick={() => setActiveMode(item.mode)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  activeMode === item.mode
                    ? 'bg-sage-light text-sage-deep shadow-paper-sm'
                    : 'text-charcoal-muted hover:bg-cream-200 hover:text-charcoal'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-b border-cream-400 bg-cream-100 px-4 py-2 sm:hidden scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.mode}
              onClick={() => setActiveMode(item.mode)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                activeMode === item.mode
                  ? 'bg-sage-light text-sage-deep shadow-paper-sm'
                  : 'text-charcoal-muted hover:bg-cream-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {activeMode === 'warmup' && (
          <section className="flex flex-col gap-6 animate-fade-in">
            <WarmUpDashboard />
          </section>
        )}

        {activeMode === 'map' && (
          <section className="flex flex-col gap-6 animate-fade-in">
            <LearningMap onSelectModule={() => setActiveMode('academy')} />
          </section>
        )}

        {activeMode === 'academy' && (
          <section className="flex flex-col gap-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-charcoal">Academy</h2>
              <p className="mt-1 text-sm text-charcoal-muted">
                Browse the course catalog, diagnose your weak spots, and jump into any module.
              </p>
            </div>
            <AcademyDashboard />
          </section>
        )}

        {activeMode === 'playground' && (
          <section className="flex flex-col gap-6 animate-fade-in">
            <Playground />
          </section>
        )}

        {activeMode === 'choir' && (
          <section className="flex flex-col gap-6 animate-fade-in">
            <ChoirSpace />
          </section>
        )}
      </main>

      {/* Footer with legal links */}
      <footer className="border-t border-cream-400 py-6 text-center text-xs text-charcoal-muted">
        <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
          <button onClick={() => setView('terms')} className="flex items-center gap-1 hover:text-sage-deep">
            <FileText className="h-3 w-3" /> Terms
          </button>
          <button onClick={() => setView('privacy')} className="flex items-center gap-1 hover:text-sage-deep">
            <Shield className="h-3 w-3" /> Privacy
          </button>
        </div>
        Vocalis — All audio processed locally. No microphone data is stored or transmitted.
      </footer>

      {/* Floating Piano button */}
      <button
        onClick={() => setShowPiano(!showPiano)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-deep text-cream-50 shadow-paper-lg transition-all hover:bg-sage-dark hover:scale-105 active:translate-y-0.5"
        title="Open Keyboard"
      >
        <Piano className="h-6 w-6" />
      </button>

      {/* Settings modal */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onShowRangeChecker={() => { setShowSettings(false); setShowRangeChecker(true); }} onSignOut={() => { setView('auth'); setAuthMode('login'); }} />}

      {/* Pitch Pipe drawer */}
      <PitchPipe isOpen={showPitchPipe} onClose={() => setShowPitchPipe(false)} />

      {/* Virtual Piano drawer */}
      <VirtualPiano isOpen={showPiano} onToggle={() => setShowPiano(!showPiano)} />

      {/* Vocal Range Checker modal */}
      {showRangeChecker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowRangeChecker(false)}>
          <div className="w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
            <VocalRangeChecker onComplete={() => setShowRangeChecker(false)} onCancel={() => setShowRangeChecker(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
