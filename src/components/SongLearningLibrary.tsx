/**
 * Song Learning Library: reference songs with lyrics, verification status and,
 * for verified songs only, sol-fa and playback.
 *
 * SECURITY: Static data. Audio is handled by VerifiedMelodyPanel.
 */

import { BookOpen, CircleAlert } from 'lucide-react';
import { VerifiedMelodyPanel } from '@/components/VerifiedMelodyPanel';
import { CORE_SONGS, type CoreSong } from '@/lib/coreSongs';

interface SongLearningLibraryProps {
  songs?: CoreSong[];
}

export function SongLearningLibrary({ songs = CORE_SONGS }: SongLearningLibraryProps) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-sage-deep" />
        <h3 className="font-semibold text-charcoal">Song Learning Library</h3>
      </div>
      <p className="text-sm text-charcoal-muted">
        Reference melodies appear here once they have been verified against an authoritative transcription.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {songs.map((song) => (
          <div key={song.id} className="card flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-charcoal">{song.title}</h4>
              {song.verification.status === 'needs_review' && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                  <CircleAlert className="h-3 w-3" /> Needs Review
                </span>
              )}
            </div>
            <p className="text-xs text-charcoal-muted leading-relaxed">{song.pedagogicalFocus}</p>

            {song.verification.status === 'verified' ? (
              <VerifiedMelodyPanel
                melody={song.verification.melody}
                source={song.verification.source}
                verifiedBy={song.verification.verifiedBy}
              />
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                {song.verification.reviewNote}
              </p>
            )}

            <pre className="whitespace-pre-wrap font-sans text-xs text-charcoal-light bg-cream-100 rounded-lg p-3 border border-cream-400/50">{song.lyrics}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
