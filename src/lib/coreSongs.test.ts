import { describe, it, expect } from 'vitest';
import { CORE_SONGS } from '@/lib/coreSongs';
import { solfaForMelody, type SongMelody } from '@/lib/songMelody';

function melodyProblems(melody: SongMelody): string[] {
  const problems: string[] = [];
  if (melody.events.length === 0) problems.push('no events');
  for (const event of melody.events) {
    if (event.beats <= 0) problems.push('non-positive duration');
    if (event.kind === 'note' && (event.midi < 0 || event.midi > 127)) problems.push('pitch out of range');
  }
  if (melody.phraseStarts[0] !== 0) problems.push('first phrase must start at 0');
  for (let i = 1; i < melody.phraseStarts.length; i++) {
    if (melody.phraseStarts[i] <= melody.phraseStarts[i - 1]) problems.push('phrases out of order');
  }
  if (melody.phraseStarts.some((s) => s >= melody.events.length)) problems.push('phrase start past end');
  return problems;
}

describe('core song verification status', () => {
  it('marks every current song Needs Review with no melody data', () => {
    for (const song of CORE_SONGS) {
      expect(song.verification.status).toBe('needs_review');
      expect(song.verification.melody).toBeNull();
      if (song.verification.status === 'needs_review') {
        expect(song.verification.reviewNote.length).toBeGreaterThan(0);
      }
    }
  });

  it('requires a source and a verifier for any song marked Verified', () => {
    for (const song of CORE_SONGS) {
      if (song.verification.status !== 'verified') continue;
      expect(song.verification.source.trim().length).toBeGreaterThan(0);
      expect(song.verification.verifiedBy.trim().length).toBeGreaterThan(0);
      expect(melodyProblems(song.verification.melody)).toEqual([]);
    }
  });

  it('keeps song ids unique', () => {
    const ids = CORE_SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('verified melody data integrity', () => {
  it('derives a sol-fa syllable for every note of any verified melody', () => {
    for (const song of CORE_SONGS) {
      if (song.verification.status !== 'verified') continue;
      const solfa = solfaForMelody(song.verification.melody);
      const noteCount = song.verification.melody.events.filter((e) => e.kind === 'note').length;
      expect(solfa.length).toBe(noteCount);
      for (const note of solfa) {
        expect(note.syllable.length).toBeGreaterThan(0);
        expect(note.syllable).not.toBe('?');
      }
    }
  });
});

