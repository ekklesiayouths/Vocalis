// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EnhancedOnboarding } from '@/components/EnhancedOnboarding';

const playTone = vi.fn();
const playSequence = vi.fn();
const stopAll = vi.fn();

vi.mock('@/hooks/useTonePlayer', () => ({
  useTonePlayer: () => ({ playTone, playSequence, stopAll, cleanup: stopAll }),
}));

vi.mock('@/context/UserContext', () => ({
  useUser: () => ({ completeOnboarding: vi.fn(), setProfile: vi.fn() }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ session: null }),
}));

vi.mock('@/lib/profileService', () => ({
  saveOnboardingData: vi.fn(),
  completeOnboarding: vi.fn(),
}));

function clickButton(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function advanceToAssessmentIntro() {
  render(<EnhancedOnboarding onComplete={vi.fn()} />);
  clickButton(/Let's Begin/);

  fireEvent.change(screen.getByPlaceholderText('Your name or nickname...'), { target: { value: 'Ada' } });
  clickButton(/Next/);

  clickButton(/Sing Better/);
  clickButton(/Next/);

  clickButton(/Beginner Learner/);
  clickButton(/Next/);

  clickButton(/Complete Beginner/);

  clickButton(/Continue/);

  for (const yes of screen.getAllByRole('button', { name: 'Yes' })) fireEvent.click(yes);
  clickButton(/Next/);

  clickButton('No');
  clickButton(/Next/);

  clickButton('Daily');
  clickButton('15 min');
  clickButton(/Next/);

  screen.getByText('Optional: Skill Assessment');
}

describe('EnhancedOnboarding skill assessment navigation', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('Start Assessment opens the pitch-matching assessment immediately', () => {
    advanceToAssessmentIntro();

    clickButton(/Start Assessment/);

    expect(screen.queryByText('Optional: Skill Assessment')).toBeNull();
    expect(screen.getByText('Pitch Matching')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Stop and go back/ })).toBeTruthy();
  });

  it('Stop and go back from the pitch assessment reaches the interval assessment', () => {
    advanceToAssessmentIntro();
    clickButton(/Start Assessment/);

    clickButton(/Stop and go back/);
    const startButtons = screen.getAllByRole('button', { name: /^Start$/ });
    fireEvent.click(startButtons[1]);

    screen.getByRole('button', { name: /Start listening/ });
    expect(screen.getByText('Interval Recognition')).toBeTruthy();
  });

  it('Skip for now goes straight to the learning map', async () => {
    advanceToAssessmentIntro();

    clickButton(/Skip for now/);

    expect(await screen.findByText('Your Learning Map is Ready!')).toBeTruthy();
  });

  it('Generate My Map from the assessment list reaches the learning map', async () => {
    advanceToAssessmentIntro();
    clickButton(/Start Assessment/);
    clickButton(/Stop and go back/);

    clickButton(/Generate My Map/);

    expect(await screen.findByText('Your Learning Map is Ready!')).toBeTruthy();
  });
});
