/**
 * Cookie consent banner — shows on first visit, stores preferences.
 *
 * - Essential cookies (auth session) always work
 * - No optional analytics/advertising cookies are actually used by Vocalis
 * - Consent is stored in localStorage pre-auth, synced to profile post-auth
 * - User can change preferences later from Settings
 * - Optional consent checkbox is never preselected
 */

import { useState, useEffect } from 'react';
import { Cookie, Check, X, Settings2 } from 'lucide-react';

const CONSENT_KEY = 'vocalis-cookie-consent';

interface CookieConsentData {
  essential: true;
  analytics: boolean;
  timestamp: string;
}

export function loadConsent(): CookieConsentData | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? JSON.parse(raw) as CookieConsentData : null;
  } catch { return null; }
}

function saveConsent(data: CookieConsentData) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) setVisible(true);
  }, []);

  const handleAcceptAll = () => {
    saveConsent({ essential: true, analytics: false, timestamp: new Date().toISOString() });
    setVisible(false);
  };

  const handleRejectOptional = () => {
    saveConsent({ essential: true, analytics: false, timestamp: new Date().toISOString() });
    setVisible(false);
  };

  const handleSavePreferences = () => {
    saveConsent({ essential: true, analytics, timestamp: new Date().toISOString() });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="mx-auto max-w-2xl card p-5 shadow-paper-lg">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-sage-deep mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-charcoal text-sm">Cookie Preferences</h3>
            {!showSettings ? (
              <>
                <p className="text-xs text-charcoal-muted mt-1">
                  Vocalis uses essential storage for authentication and your learning session.
                  We do not use analytics, advertising, or tracking cookies. You can learn more in our{' '}
                  <a href="/privacy" className="text-sage-deep underline">Privacy Policy</a>.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={handleAcceptAll} className="btn-primary text-xs px-3 py-2">
                    <Check className="h-3.5 w-3.5" /> OK, got it
                  </button>
                  <button onClick={() => setShowSettings(true)} className="btn-secondary text-xs px-3 py-2">
                    <Settings2 className="h-3.5 w-3.5" /> Customize
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-cream-200 border border-cream-400 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-charcoal">Essential</p>
                      <p className="text-[10px] text-charcoal-muted">Auth session, learning progress — always on</p>
                    </div>
                    <span className="text-[10px] text-sage-deep font-medium">Required</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-cream-200 border border-cream-400 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-charcoal">Analytics (not currently used)</p>
                      <p className="text-[10px] text-charcoal-muted">Vocalis does not use analytics cookies today</p>
                    </div>
                    <label className="cursor-pointer">
                      <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="h-4 w-4 rounded border-cream-400 text-sage-deep" />
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleSavePreferences} className="btn-primary text-xs px-3 py-2">
                    <Check className="h-3.5 w-3.5" /> Save preferences
                  </button>
                  <button onClick={handleRejectOptional} className="btn-secondary text-xs px-3 py-2">
                    <X className="h-3.5 w-3.5" /> Reject optional
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
