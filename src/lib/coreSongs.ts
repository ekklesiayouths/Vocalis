/**
 * Core reference songs for the Song Learning Library.
 *
 * A song only carries a melody once it has been verified against an
 * authoritative transcription. Until then it is marked Needs Review and no
 * melody, sol-fa or full-melody playback is offered for it.
 *
 * SECURITY: Static data, no user input, no I/O.
 */

import type { SongVerification } from '@/lib/songMelody';

export interface CoreSong {
  id: string;
  title: string;
  pedagogicalFocus: string;
  lyrics: string;
  verification: SongVerification;
}

const PENDING_REVIEW_NOTE =
  'The reference melody for this song is awaiting verification against an authoritative transcription. Sol-fa and full-melody playback are unavailable until it is verified.';

export const CORE_SONGS: CoreSong[] = [
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    pedagogicalFocus: 'Phrasing and breath control in a traditional hymn tune.',
    lyrics: `Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see`,
    verification: { status: 'needs_review', reviewNote: PENDING_REVIEW_NOTE, melody: null },
  },
  {
    id: 'joy-to-the-world',
    title: 'Joy to the World',
    pedagogicalFocus: 'Stepwise motion and interval recognition in a traditional carol.',
    lyrics: `Joy to the world, the Lord is come
Let earth receive her King
Let every heart prepare Him room
And heaven and nature sing`,
    verification: { status: 'needs_review', reviewNote: PENDING_REVIEW_NOTE, melody: null },
  },
  {
    id: 'lean-on-me',
    title: 'Lean on Me',
    pedagogicalFocus: 'Phrasing and steady breath support in a contemporary song.',
    lyrics: `Lean on me, when you're not strong
And I'll be your friend
I'll help you carry on
For it won't be long
Till I'm gonna need somebody to lean on`,
    verification: { status: 'needs_review', reviewNote: PENDING_REVIEW_NOTE, melody: null },
  },
  {
    id: 'as-the-deer',
    title: 'As the Deer',
    pedagogicalFocus: 'Expressive legato singing and phrase shaping in a worship song.',
    lyrics: `As the deer panteth for the water
So my soul longeth after Thee
You alone are my heart's desire
And I long to worship Thee`,
    verification: { status: 'needs_review', reviewNote: PENDING_REVIEW_NOTE, melody: null },
  },
];
