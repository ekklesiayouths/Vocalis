/**
 * Terms of Service page for Vocalis.
 *
 * DRAFT — marked for owner review before production.
 * Describes actual implemented behavior of the application.
 */

import { ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  onBack: () => void;
}

export function TermsPage({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-charcoal-muted hover:text-charcoal mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-charcoal mb-2">Terms of Service</h1>
          <p className="text-xs text-charcoal-muted mb-6">Version 2026-10-14 — DRAFT, requires owner review before production</p>

          <div className="prose prose-sm max-w-none text-charcoal-light space-y-4">
            <section>
              <h2 className="text-lg font-semibold text-charcoal">1. Acceptance of Terms</h2>
              <p>By creating an account and using Vocalis, you agree to these Terms of Service. If you do not agree, do not create an account or use the application.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">2. Your Account</h2>
              <p>You provide your full name, email address, age, and a password to register. You are responsible for keeping your password secure. You must be at least 13 years old to create an account. If you are under 18, you must have a parent or guardian's permission.</p>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: The minimum age policy must be confirmed. The current registration form accepts ages 5–120. Decide on the actual minimum age for your jurisdiction and update this section and the validation accordingly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">3. Learning Data</h2>
              <p>Vocalis stores your learning progress, exercise scores, onboarding responses, vocal range, and practice history. This data is linked to your account and visible only to you. Music Directors can see scores of members in their choir. All data access is controlled by Row Level Security policies.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">4. Choir Features</h2>
              <p>If you create or join a choir, your name and choir membership are visible to the choir director and other members. Directors can upload audio files (MP3, WAV up to 50MB) to a private storage bucket accessible only to choir members.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">5. Audio Processing</h2>
              <p>Real-time audio analysis (pitch detection, vocal range checking) happens entirely in your browser. Your microphone audio is never recorded, stored, or transmitted. Uploaded choir audio files are stored in Supabase storage and accessible only to authorized choir members.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">6. Lyrics Search</h2>
              <p>When a Music Director uploads a song and provides a title and artist, Vocalis searches for lyrics using the free lyrics.ovh API. Lyrics are returned as drafts for review. You are responsible for verifying you have the right to distribute any lyrics to your choir.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">7. Third-Party Services</h2>
              <p>Vocalis uses Supabase for authentication, database storage, and serverless functions. Your email and password are managed by Supabase Auth. No other third-party analytics or advertising services are used unless you consent to optional cookies.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">8. Termination</h2>
              <p>You can sign out at any time. Account deletion requires contacting support. When your account is deleted, your profile, scores, and choir memberships are removed via database cascade.</p>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: A self-service account deletion flow should be implemented before production. The current database supports cascade deletion but no UI exists.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">9. Disclaimer</h2>
              <p>Vocalis is an educational tool. It does not provide medical or vocal health advice. Consult a qualified voice teacher or vocal health professional for personalized guidance.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">10. Changes to Terms</h2>
              <p>We may update these Terms. When material changes occur, users will be notified and asked to accept the new version. The version and date above indicate the current Terms.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-charcoal-muted hover:text-charcoal mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-charcoal mb-2">Privacy Policy</h1>
          <p className="text-xs text-charcoal-muted mb-6">Version 2026-10-14 — DRAFT, requires owner review before production</p>

          <div className="prose prose-sm max-w-none text-charcoal-light space-y-4">
            <section>
              <h2 className="text-lg font-semibold text-charcoal">1. Information We Collect</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account:</strong> Full name, email address, age, and password (managed by Supabase Auth).</li>
                <li><strong>Profile:</strong> Display name, learning preferences, onboarding responses, vocal range, completed modules.</li>
                <li><strong>Progress:</strong> Exercise scores, accuracy, time elapsed, XP, and attempt history.</li>
                <li><strong>Choir data:</strong> Choir memberships, uploaded audio files, song lyrics and metadata.</li>
                <li><strong>Consent records:</strong> Terms acceptance version/date, Privacy Policy acknowledgement version/date, cookie consent preferences.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">2. How We Use Information</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To authenticate your identity and manage your account.</li>
                <li>To personalize your learning map and track your progress.</li>
                <li>To enable choir collaboration features (song sharing, assignments).</li>
                <li>To generate adaptive recommendations based on your practice history.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">3. Audio Data</h2>
              <p>Real-time microphone input for pitch detection and vocal range checking is processed entirely in your browser. Audio is not recorded, stored, or transmitted. Uploaded choir rehearsal audio is stored in a private Supabase storage bucket with MIME-type restrictions and is accessible only to authorized choir members and directors.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">4. Data Storage</h2>
              <p>All data is stored in Supabase (PostgreSQL database and storage). Row Level Security ensures users can only access their own data. Music Directors can access scores and audio for their choir members. No data is sold to third parties.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">5. Cookies and Local Storage</h2>
              <p>Vocalis uses essential browser storage for authentication sessions (Supabase auth tokens). Local storage is used for onboarding state before account creation and for non-sensitive UI preferences. No analytics, advertising, or tracking cookies are used unless you explicitly consent via the cookie consent banner.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">6. Third-Party Services</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Supabase:</strong> Authentication, database, storage, and edge functions.</li>
                <li><strong>lyrics.ovh:</strong> Free lyrics API used when a director searches for song lyrics. No personal data is sent to lyrics.ovh — only song title and artist.</li>
              </ul>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: Review whether lyrics.ovh's data practices comply with your privacy requirements. Consider whether the lyrics search feature should be disabled for EU users under GDPR.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">7. Data Retention</h2>
              <p>Your data is retained while your account is active. When your account is deleted, your profile, scores, choir memberships, and uploaded audio are removed via database cascade deletion.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">8. Children's Privacy</h2>
              <p>Vocalis collects age at registration. The app does not knowingly collect data from children under 13 without parental consent.</p>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: If the platform may be used by minors, implement COPPA/GDPR-K compliance measures and parental consent flows. Consult a legal professional.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">9. Your Rights</h2>
              <p>You can view and update your profile information through the app. You can request account deletion by contacting support. Your exercise scores are immutable (cannot be edited after submission) to preserve assessment integrity.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">10. Contact</h2>
              <p className="text-mustard-deep">NOTE FOR OWNER: Add contact information for privacy inquiries and data requests.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
