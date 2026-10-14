/**
 * Legal pages for Vocalis — Terms of Service and Privacy Policy.
 *
 * DRAFT — marked for owner review before production.
 * Content is based on actual implemented application behavior.
 * Placeholders are used where owner input is required.
 */

import { ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  onBack: () => void;
}

const OWNER_PLACEHOLDER = '[OWNER: Insert your legal name, business name (if applicable), and contact email here]';

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
              <p>By creating an account or using Vocalis, you agree to these Terms of Service. If you do not agree, do not create an account or use the application. You may use public features without an account, but saving progress and personalised data requires registration.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">2. Eligibility and Account Responsibilities</h2>
              <p>You provide your full name, email address, age, and a password to register. You are responsible for keeping your password secure and for all activity under your account.</p>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: The minimum age policy must be confirmed. The current registration form accepts ages 5–120. Decide on the actual minimum age for your jurisdiction and update this section and the validation accordingly. If the platform may be used by minors, implement parental consent flows and consult a legal professional.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">3. Acceptable Use and Prohibited Abuse</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Use Vocalis for any unlawful purpose or in violation of applicable laws.</li>
                <li>Attempt to access another user's data, scores, or choir information without authorisation.</li>
                <li>Upload content that infringes copyright, is defamatory, or is otherwise illegal.</li>
                <li>Attempt to disrupt or overload the service, including rate-limit bypass attempts.</li>
                <li>Use the AI tutor or recommendation system to generate harmful, abusive, or misleading content.</li>
                <li>Share your account credentials with others.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">4. Learning Data and Privacy</h2>
              <p>Vocalis stores your learning progress, exercise scores, onboarding responses, vocal range, and practice history. This data is linked to your account and visible only to you. Music Directors can see scores of members in their choir. All data access is controlled by Row Level Security policies. See our Privacy Policy for full details.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">5. Choir Features</h2>
              <p>If you create or join a choir, your name and choir membership are visible to the choir director and other members. Directors can upload audio files (MP3, WAV up to 50MB) to a private storage bucket accessible only to choir members.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">6. Audio Processing</h2>
              <p>Real-time audio analysis (pitch detection, vocal range checking) happens entirely in your browser. Your microphone audio is never recorded, stored, or transmitted. Uploaded choir audio files are stored in Supabase storage and accessible only to authorised choir members.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">7. Intellectual Property and User-Submitted Content</h2>
              <p>Vocalis and its original content (exercises, course materials, UI design) are owned by the application owner. You retain ownership of content you upload (choir audio, song lyrics metadata). By uploading choir audio, you grant other choir members access to that audio for rehearsal purposes. You are responsible for ensuring you have the right to distribute any lyrics or audio you upload.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">8. Lyrics Search</h2>
              <p>When a Music Director uploads a song and provides a title and artist, Vocalis searches for lyrics using the free lyrics.ovh API. Lyrics are returned as drafts for review. You are responsible for verifying you have the right to distribute any lyrics to your choir.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">9. Third-Party Services and Availability</h2>
              <p>Vocalis uses Supabase for authentication, database storage, and serverless functions. Your email and password are managed by Supabase Auth. The AI tutor feature uses a third-party language model API. Vocalis does not guarantee uninterrupted availability and is not liable for third-party service outages.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">10. Educational Limitations</h2>
              <p>Vocalis provides music-learning tools, exercises, and feedback. It does not guarantee specific musical outcomes, proficiency levels, or vocal improvement. Progress depends on individual practice, prior experience, and other factors outside the application's control. Vocalis is not a substitute for a qualified voice teacher or vocal health professional.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">11. Suspension, Termination, and Account Deletion</h2>
              <p>You can sign out at any time. You can delete your account from the Settings panel, which permanently removes your auth account, profile, scores, and choir memberships. The owner reserves the right to suspend or terminate accounts that violate these Terms. When your account is deleted, your data is removed via database cascade deletion.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">12. Changes to Terms and Service</h2>
              <p>We may update these Terms. When material changes occur, users will be notified and asked to accept the new version. The version and date above indicate the current Terms. Continued use after changes constitutes acceptance of the updated Terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">13. Contact</h2>
              <p className="text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2">
                {OWNER_PLACEHOLDER}
              </p>
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
              <h2 className="text-lg font-semibold text-charcoal">1. Data Controller</h2>
              <p>The data controller for Vocalis is:</p>
              <p className="text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2">
                {OWNER_PLACEHOLDER}
              </p>
              <p className="text-xs text-charcoal-muted mt-1">This document is an initial draft and requires owner review. It does not constitute legal advice or a certification of compliance.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">2. Personal Data We Collect</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Authentication:</strong> Email address, password (hashed by Supabase Auth), and full name.</li>
                <li><strong>Profile:</strong> Display name, age, learning preferences, onboarding responses, vocal range, completed modules.</li>
                <li><strong>Progress:</strong> Exercise scores, accuracy, time elapsed, XP, and attempt history.</li>
                <li><strong>Choir data:</strong> Choir memberships, uploaded audio files, song lyrics and metadata.</li>
                <li><strong>Consent records:</strong> Terms acceptance version/date, Privacy Policy acknowledgement version/date, cookie consent preferences.</li>
                <li><strong>Audio processing:</strong> Real-time microphone input for pitch detection and vocal range checking is processed in-browser only. Audio is not recorded, stored, or transmitted.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">3. Purposes of Collection</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To authenticate your identity and manage your account.</li>
                <li>To personalise your learning map and track your progress.</li>
                <li>To enable choir collaboration features (song sharing, assignments).</li>
                <li>To generate adaptive recommendations based on your practice history.</li>
                <li>To provide AI tutor assistance (sent to a third-party language model API — see Section 6).</li>
                <li>To record legal consent and comply with obligations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">4. Audio Data</h2>
              <p>Real-time microphone input for pitch detection and vocal range checking is processed entirely in your browser. Audio is not recorded, stored, or transmitted to any server. Uploaded choir rehearsal audio is stored in a private Supabase storage bucket with MIME-type restrictions and is accessible only to authorised choir members and directors.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">5. Data Storage and Hosting</h2>
              <p>All data is stored in Supabase (PostgreSQL database and file storage), hosted on cloud infrastructure. Row Level Security ensures users can only access their own data. Music Directors can access scores and audio for their choir members. No data is sold to third parties.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">6. Third-Party Services and AI Providers</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Supabase:</strong> Authentication, database, storage, and edge functions. Your email and hashed password are managed by Supabase Auth.</li>
                <li><strong>AI Language Model API:</strong> The AI tutor feature sends your questions and relevant practice context to a third-party language model API for generating responses. No microphone audio is sent. The specific provider depends on configuration.</li>
                <li><strong>lyrics.ovh:</strong> Free lyrics API used when a director searches for song lyrics. Only song title and artist are sent — no personal data.</li>
              </ul>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: Review whether lyrics.ovh's data practices comply with your privacy requirements. Confirm the AI provider's data processing terms and whether conversations are retained by the provider.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">7. International Transfers</h2>
              <p>Supabase and AI provider infrastructure may process data in countries outside your own. By using Vocalis, you acknowledge that your data may be transferred to and processed in such countries, subject to applicable data protection laws.</p>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: If serving EU/UK users, confirm Standard Contractual Clauses or adequate safeguards are in place with Supabase and the AI provider.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">8. Cookies and Local Storage</h2>
              <p>Vocalis uses essential browser storage for authentication sessions (Supabase auth tokens). Local storage is used for onboarding state before account creation and for non-sensitive UI preferences. No analytics, advertising, or tracking cookies are used. Cookie consent preferences can be changed at any time from Settings.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">9. Data Retention</h2>
              <p>Your data is retained while your account is active. When you delete your account, your profile, scores, choir memberships, and uploaded audio are removed via database cascade deletion. Exercise scores are immutable after submission to preserve assessment integrity.</p>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: Define specific retention periods for inactive accounts and any legal record-keeping obligations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">10. Security</h2>
              <p>Vocalis uses Row Level Security policies to enforce that users can only access their own data. Passwords are hashed by Supabase Auth. The service-role key is never exposed to the client. Account deletion is performed through a server-side edge function using privileged credentials.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">11. Children's Privacy</h2>
              <p>Vocalis collects age at registration. The app does not knowingly collect data from children under 13 without parental consent.</p>
              <p className="text-xs text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2 mt-2">
                NOTE FOR OWNER: If the platform may be used by minors, implement COPPA/GDPR-K compliance measures and parental consent flows. Consult a legal professional.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">12. Your Data Subject Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Access:</strong> Request a copy of your personal data (available via the in-app data export feature).</li>
                <li><strong>Rectification:</strong> Correct inaccurate profile information.</li>
                <li><strong>Erasure:</strong> Delete your account and all associated data (available via the in-app account deletion feature).</li>
                <li><strong>Restriction:</strong> Request limitation of processing.</li>
                <li><strong>Portability:</strong> Export your data in a machine-readable format.</li>
                <li><strong>Objection:</strong> Object to certain processing activities.</li>
              </ul>
              <p>To exercise these rights, use the in-app features or contact the data controller listed in Section 1.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">13. Complaints</h2>
              <p>If you believe your data has been handled improperly, you may file a complaint with the data controller. You also have the right to lodge a complaint with your local data protection authority (e.g., the ICO in the UK, the DPC in Ireland, or your local equivalent in the EU/EEA).</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">14. Policy Changes</h2>
              <p>We may update this Privacy Policy. When material changes occur, users will be notified. The version and date above indicate the current policy. Continued use after changes constitutes acceptance of the updated policy.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-charcoal">15. Contact</h2>
              <p className="text-mustard-deep bg-mustard-light/50 border border-mustard-DEFAULT rounded-lg p-2">
                {OWNER_PLACEHOLDER}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
