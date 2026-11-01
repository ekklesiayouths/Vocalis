// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SongLearningLibrary } from '@/components/SongLearningLibrary';
import { CORE_SONGS, type CoreSong } from '@/lib/coreSongs';
import { midiToFrequency } from '@/lib/notes';

const { playToneMock, stopAllMock } = vi.hoisted(() => ({
  playToneMock: vi.fn(),
  stopAllMock: vi.fn(),
}));

vi.mock('@/hooks/useTonePlayer', () => ({
  useTonePlayer: () => ({ playTone: playToneMock, stopAll: stopAllMock, playSequence: vi.fn(), cleanup: stopAllMock }),
}));

// Synthetic verified fixture for testing playback wiring only. Not song data.
const FIXTURE_SONG: CoreSong = {
  id: 'fixture',
  title: 'Fixture Tune',
  pedagogicalFocus: 'Test only',
  lyrics: 'la la',
  verification: {
    status: 'verified',
    source: 'Test fixture',
    verifiedBy: 'Test suite',
    melody: {
      key: 'C Major',
      tempoBpm: 60,
      oscillatorType: 'sine',
      phraseStarts: [0, 2],
      events: [
        { kind: 'note', midi: 60, beats: 1 },
        { kind: 'note', midi: 64, beats: 1 },
        { kind: 'rest', beats: 1 },
        { kind: 'note', midi: 67, beats: 1 },
      ],
    },
  },
};

afterEach(() => {
  cleanup();
  playToneMock.mockClear();
  stopAllMock.mockClear();
});

describe('SongLearningLibrary with the current catalogue', () => {
  it('shows every song as Needs Review with no full-melody playback or sol-fa', () => {
    render(<SongLearningLibrary />);

    expect(screen.getAllByText('Needs Review')).toHaveLength(CORE_SONGS.length);
    expect(screen.queryByRole('button', { name: /play full melody/i })).toBeNull();
    expect(screen.queryByText('Verified')).toBeNull();
    expect(screen.queryByRole('group', { name: /playback speed/i })).toBeNull();
    expect(screen.getAllByText(/awaiting verification/i)).toHaveLength(CORE_SONGS.length);
  });

  it('still shows lyrics for every song', () => {
    render(<SongLearningLibrary />);
    expect(screen.getByText(/Amazing grace, how sweet the sound/)).toBeTruthy();
  });
});

describe('SongLearningLibrary with a verified melody', () => {
  it('shows the verification source and sol-fa with octave labels', () => {
    render(<SongLearningLibrary songs={[FIXTURE_SONG]} />);

    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText(/Source: Test fixture/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Doh C4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mi E4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Soh G4' })).toBeTruthy();
  });

  it('plays a tapped note at the pitch shown in its sol-fa', () => {
    render(<SongLearningLibrary songs={[FIXTURE_SONG]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mi E4' }));

    expect(playToneMock).toHaveBeenCalledTimes(1);
    expect(playToneMock.mock.calls[0][0]).toMatchObject({
      frequency: midiToFrequency(64),
      durationMs: 1000,
      startDelayMs: 0,
    });
  });

  it('plays the full melody with the same pitches and rest-aware timing', () => {
    render(<SongLearningLibrary songs={[FIXTURE_SONG]} />);

    fireEvent.click(screen.getByRole('button', { name: /play full melody/i }));

    const calls = playToneMock.mock.calls.map(([opts]) => opts);
    expect(calls.map((c) => c.frequency)).toEqual([60, 64, 67].map(midiToFrequency));
    expect(calls.map((c) => c.startDelayMs)).toEqual([0, 1000, 3000]);
  });

  it('plays only the chosen phrase', () => {
    render(<SongLearningLibrary songs={[FIXTURE_SONG]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Phrase 2' }));

    const calls = playToneMock.mock.calls.map(([opts]) => opts);
    expect(calls.map((c) => c.frequency)).toEqual([midiToFrequency(67)]);
    expect(calls[0].startDelayMs).toBe(1000);
  });

  it('changes the timing but not the pitch when speed changes', () => {
    render(<SongLearningLibrary songs={[FIXTURE_SONG]} />);

    fireEvent.click(screen.getByRole('button', { name: '0.75x' }));
    fireEvent.click(screen.getByRole('button', { name: /play full melody/i }));

    const calls = playToneMock.mock.calls.map(([opts]) => opts);
    expect(calls.map((c) => c.frequency)).toEqual([60, 64, 67].map(midiToFrequency));
    expect(calls[0].durationMs).toBeCloseTo(1333.33, 1);
  });
});
