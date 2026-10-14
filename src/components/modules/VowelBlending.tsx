/**
 * Vowel Blending Audio Game — Harmony & Choral Mastery (Harmony)
 *
 * Plays an unblended chord where one voice part has a harsh vowel.
 * User adjusts sliders from "Harsh/Bright" to "Round/Blended" until
 * the chord blends. The audio changes as the slider moves (filter).
 *
 * SECURITY: Uses useTonePlayer (native Web Audio, cleaned up on unmount).
 * No mic needed. Score via submitScore RPC.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Volume2, Check } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { midiToFrequency } from '@/lib/notes';
import { submitScore, type ScoreSubmissionResult } from '@/lib/scoreService';

type Phase = 'ready' | 'playing' | 'result';

const CHORD_MIDIS = [60, 64, 67]; // C major triad
const SLIDER_COUNT = 3;

export function VowelBlending() {
  const { playTone, stopAll, cleanup } = useTonePlayer();
  const [phase, setPhase] = useState<Phase>('ready');
  const [sliders, setSliders] = useState([20, 20, 80]);
  const [scoreResult, setScoreResult] = useState<ScoreSubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // "Blended" is when all sliders are in the 60-100 range (round/blended side)
  const allBlended = sliders.every((s) => s >= 60);
  const blendScore = Math.round(sliders.reduce((acc, s) => acc + Math.min(100, s), 0) / SLIDER_COUNT);

  const playChord = useCallback(() => {
    stopAll();
    CHORD_MIDIS.forEach((midi, i) => {
      const blend = sliders[i] / 100;
      // Higher blend = softer/rounder (sine), lower = brighter (sawtooth)
      const type: OscillatorType = blend > 0.6 ? 'sine' : blend > 0.3 ? 'triangle' : 'sawtooth';
      const volume = 0.15 - blend * 0.05;
      playTone({ frequency: midiToFrequency(midi), durationMs: 1500, type, volume });
    });
  }, [playTone, stopAll, sliders]);

  // Auto-play chord when sliders change during playing phase
  useEffect(() => {
    if (phase === 'playing') {
      playChord();
    }
  }, [sliders, phase, playChord]);

  const handleStart = useCallback(() => {
    setPhase('playing');
    setSliders([20, 20, 80]);
    setTimeout(() => playChord(), 100);
  }, [playChord]);

  const handleSliderChange = useCallback((index: number, value: number) => {
    setSliders((prev) => prev.map((s, i) => (i === index ? value : s)));
  }, []);

  const handleFinish = useCallback(async () => {
    stopAll();
    setIsSubmitting(true);
    const result = await submitScore('Vowel Blending', blendScore, 30);
    setScoreResult(result);
    setIsSubmitting(false);
    setPhase('result');
  }, [stopAll, blendScore]);

  const handleRestart = useCallback(() => {
    cleanup();
    setPhase('ready');
    setSliders([20, 20, 80]);
    setScoreResult(null);
  }, [cleanup]);

  const sliderLabels = ['Soprano', 'Alto', 'Tenor'];

  return (
    <div className="card flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-terracotta-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Vowel Blending</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        One part is singing too bright. Adjust the sliders from "Harsh/Bright" to "Round/Blended" until the chord sounds unified.
      </p>

      {phase === 'ready' && (
        <button onClick={handleStart} className="btn-primary max-w-xs w-full">
          <Volume2 className="h-5 w-5" /> Start
        </button>
      )}

      {phase === 'playing' && (
        <>
          {/* Chord playback indicator */}
          <button onClick={playChord} className="btn-secondary">
            <Volume2 className="h-4 w-4" /> Replay Chord
          </button>

          {/* Sliders */}
          <div className="flex flex-col gap-5 w-full max-w-md">
            {sliders.map((val, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-charcoal">{sliderLabels[i]}</span>
                  <span className={`text-xs ${val >= 60 ? 'text-sage-deep' : val >= 30 ? 'text-mustard-deep' : 'text-terracotta-deep'}`}>
                    {val >= 60 ? 'Round' : val >= 30 ? 'Mixed' : 'Harsh'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={val}
                  onChange={(e) => handleSliderChange(i, Number(e.target.value))}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer bg-cream-300 accent-sage-DEFAULT"
                  style={{
                    background: `linear-gradient(to right, #E4A598 0%, #E8C547 50%, #A8C9A0 100%)`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Blend indicator */}
          <div className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${allBlended ? 'bg-sage-light text-sage-deep' : 'bg-cream-200 text-charcoal-muted'}`}>
            {allBlended ? 'Beautifully blended!' : `Blend score: ${blendScore}%`}
          </div>

          <button onClick={handleFinish} className="btn-primary max-w-xs w-full">
            <Check className="h-4 w-4" /> Submit
          </button>
        </>
      )}

      {phase === 'result' && (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <span className="text-4xl font-bold text-mustard-DEFAULT">{blendScore}%</span>
          <span className="text-sm text-charcoal-muted">blend score</span>
          {scoreResult && (
            <div className={`rounded-xl px-4 py-3 text-sm border ${scoreResult.success ? 'bg-sage-light border-sage-DEFAULT text-sage-deep' : 'bg-terracotta-light border-terracotta-DEFAULT text-terracotta-deep'}`}>
              {scoreResult.success ? `Score saved! +${scoreResult.xpEarned} XP` : `Could not save: ${scoreResult.error}`}
            </div>
          )}
          <button onClick={handleRestart} className="btn-primary max-w-xs w-full">
            <Volume2 className="h-5 w-5" /> Try Again
          </button>
        </div>
      )}
    </div>
  );
}
