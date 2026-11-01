// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RoutinePlayer } from '@/components/warmups/RoutinePlayer';

const session = vi.hoisted(() => ({
  status: 'ready' as 'ready' | 'running' | 'paused' | 'done',
  result: null as null | { durationMs: number; usesPitch: boolean; accuracyPct: number | null; coveragePct: number | null; tendency: null; message: string },
}));

vi.mock('@/hooks/useTimedExercise', () => ({
  useTimedExercise: () => ({
    mic: {
      permission: 'granted',
      errorMessage: null,
      isActive: true,
      isReceiving: false,
      metrics: { frequency: null, clarity: 0, volume: 0, rawRms: 0, noteLabel: null, cents: null, tuning: null },
      start: vi.fn(),
      stop: vi.fn(),
    },
    status: session.status,
    elapsedMs: 0,
    liveReading: { frequency: null, clarity: 0, rms: 0 },
    result: session.result,
    begin: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    restart: vi.fn(),
  }),
}));

vi.mock('@/lib/scoreService', () => ({
  submitScore: vi.fn(async () => ({ success: true, xpEarned: 5 })),
}));

vi.mock('@/lib/progressService', () => ({
  submitAttempt: vi.fn(async () => ({ success: true })),
}));

describe('RoutinePlayer', () => {
  beforeEach(() => {
    session.status = 'ready';
    session.result = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('starts the first step of the routine with its progress label', () => {
    render(<RoutinePlayer routineId="gentle-reset" onExit={vi.fn()} />);
    expect(screen.getByText('Gentle Reset')).toBeTruthy();
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByText('Breath Pacer')).toBeTruthy();
  });

  it('moves to the next step when a step is skipped', () => {
    render(<RoutinePlayer routineId="gentle-reset" onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.getByText('Vowel Flow')).toBeTruthy();
  });

  it('advances after a finished step and lists the outcome at the end', () => {
    render(<RoutinePlayer routineId="gentle-reset" onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('Routine complete')).toBeTruthy();
    expect(screen.getAllByText('Skipped')).toHaveLength(3);
  });

  it('records a completed pitched step and continues', () => {
    session.status = 'done';
    session.result = {
      durationMs: 60000,
      usesPitch: true,
      accuracyPct: 72,
      coveragePct: 90,
      tendency: null,
      message: 'In tune for 72% of the notes you sang.',
    };
    render(<RoutinePlayer routineId="gentle-reset" onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  });

  it('calls the exit handler from the exercise step', () => {
    const onExit = vi.fn();
    render(<RoutinePlayer routineId="gentle-reset" onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exit routine' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
