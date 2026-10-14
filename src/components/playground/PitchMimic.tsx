/**
 * Pitch Mimic — low-pressure sound copying game.
 * Warm notebook styling with playful feedback.
 *
 * SECURITY: Uses native Web Audio API and shared useAudioInput hook.
 * Uses shared useTonePlayer instead of a private AudioContext.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Gamepad2, Volume2, Check, RotateCcw } from 'lucide-react';
import { useAudioInput } from '@/hooks/useAudioInput';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { MicPermission } from '@/components/MicPermission';
import { frequencyToNote } from '@/lib/notes';

interface MimicChallenge {
  name: string;
  emoji: string;
  frequency: number;
  durationMs: number;
  oscillatorType: OscillatorType;
}

const CHALLENGES: MimicChallenge[] = [
  { name: 'Cat Meow', emoji: '🐱', frequency: 300, durationMs: 500, oscillatorType: 'sine' },
  { name: 'Owl Hoot', emoji: '🦉', frequency: 220, durationMs: 700, oscillatorType: 'triangle' },
  { name: 'Bell Ring', emoji: '🔔', frequency: 440, durationMs: 400, oscillatorType: 'sine' },
  { name: 'Frog Croak', emoji: '🐸', frequency: 150, durationMs: 600, oscillatorType: 'sawtooth' },
  { name: 'Whistle', emoji: '🎈', frequency: 523, durationMs: 500, oscillatorType: 'sine' },
  { name: 'Dog Howl', emoji: '🐕', frequency: 180, durationMs: 800, oscillatorType: 'triangle' },
  { name: 'Bird Chirp', emoji: '🐦', frequency: 660, durationMs: 300, oscillatorType: 'square' },
  { name: 'Train Horn', emoji: '🚂', frequency: 200, durationMs: 900, oscillatorType: 'sawtooth' },
];

type GamePhase = 'idle' | 'playing' | 'mimicking' | 'result';

export function PitchMimic() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput();
  const { playTone, stopAll } = useTonePlayer();
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [challenge, setChallenge] = useState<MimicChallenge | null>(null);
  const [resultText, setResultText] = useState<string>('');
  const [round, setRound] = useState(0);
  const roundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playChallengeSound = useCallback((ch: MimicChallenge) => {
    playTone({
      frequency: ch.frequency,
      durationMs: ch.durationMs,
      type: ch.oscillatorType,
      volume: 0.25,
    });
  }, [playTone]);

  const pickRandomChallenge = useCallback((): MimicChallenge => {
    return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
  }, []);

  const handleStartRound = useCallback(() => {
    const ch = pickRandomChallenge();
    setChallenge(ch);
    setPhase('playing');
    setResultText('');
    playChallengeSound(ch);
    if (roundTimeoutRef.current) clearTimeout(roundTimeoutRef.current);
    roundTimeoutRef.current = setTimeout(() => setPhase('mimicking'), ch.durationMs + 300);
  }, [pickRandomChallenge, playChallengeSound]);

  // Clean up pending timeout on unmount
  useEffect(() => {
    return () => {
      if (roundTimeoutRef.current) clearTimeout(roundTimeoutRef.current);
    };
  }, []);

  const targetNote = challenge ? frequencyToNote(challenge.frequency) : null;
  const userNote = metrics.frequency ? frequencyToNote(metrics.frequency) : null;
  const isMatching =
    phase === 'mimicking' && targetNote && userNote &&
    Math.abs(userNote.cents - targetNote.cents) < 50 &&
    targetNote.noteName === userNote.noteName;

  const handleCheckResult = useCallback(() => {
    if (!challenge || !targetNote || !userNote) {
      setResultText('No pitch detected — try again, no worries!');
    } else if (Math.abs(userNote.cents - targetNote.cents) < 50 && targetNote.noteName === userNote.noteName) {
      setResultText('Perfect mimic! You nailed it!');
    } else {
      const direction = userNote.cents > targetNote.cents ? 'a bit higher' : 'a bit lower';
      setResultText(`Close! The target was ${targetNote.fullLabel} — you were ${direction}. No penalty, try another!`);
    }
    setPhase('result');
    setRound((r) => r + 1);
  }, [challenge, targetNote, userNote]);

  const handleStop = () => {
    if (roundTimeoutRef.current) {
      clearTimeout(roundTimeoutRef.current);
      roundTimeoutRef.current = null;
    }
    stopAll();
    stop();
    setPhase('idle');
    setChallenge(null);
    setRound(0);
    setResultText('');
  };

  return (
    <div className="card flex flex-col items-center gap-4 p-6">
      <div className="flex items-center gap-3">
        <Gamepad2 className="h-5 w-5 text-mustard-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Pitch Mimic</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Listen to the sound, then mimic the pitch with your voice. No penalties — just play!
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <>
          {challenge && (
            <div className="flex flex-col items-center gap-3">
              {phase === 'playing' && <div className="text-6xl animate-float">{challenge.emoji}</div>}
              {phase === 'mimicking' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-5xl">{challenge.emoji}</div>
                  <div className="text-sm text-charcoal-muted">Mimic this pitch: <span className="font-bold text-sage-deep">{targetNote?.fullLabel}</span></div>
                  {userNote && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-charcoal-muted">You:</span>
                      <span className={`font-bold ${isMatching ? 'text-sage-deep' : 'text-terracotta-deep'}`}>{userNote.fullLabel}</span>
                      {isMatching && <Check className="h-4 w-4 text-sage-deep" />}
                    </div>
                  )}
                </div>
              )}
              {phase === 'result' && <div className="text-center text-sm text-charcoal-light max-w-xs">{resultText}</div>}
            </div>
          )}

          {phase === 'idle' && (
            <button onClick={handleStartRound} className="btn-primary max-w-xs w-full">
              <Volume2 className="h-4 w-4" /> Start Round
            </button>
          )}
          {phase === 'mimicking' && (
            <button onClick={handleCheckResult} className="btn-primary max-w-xs w-full">
              <Check className="h-4 w-4" /> Check My Pitch
            </button>
          )}
          {phase === 'result' && (
            <button onClick={handleStartRound} className="btn-primary max-w-xs w-full">
              <RotateCcw className="h-4 w-4" /> Next Sound
            </button>
          )}

          <div className="flex items-center gap-4 text-sm text-charcoal-muted">
            <span>Round {round}</span>
            <button onClick={handleStop} className="text-charcoal-muted transition-colors hover:text-terracotta-deep">Quit</button>
          </div>
        </>
      )}
    </div>
  );
}
