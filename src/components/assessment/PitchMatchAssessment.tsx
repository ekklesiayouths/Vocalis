import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { MicPermission } from '@/components/MicPermission';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { useVoiceSampler } from '@/hooks/useVoiceSampler';
import { midiToFrequency, midiToNoteName } from '@/lib/notes';
import {
  BLUEPRINT_MODULES,
  PITCH_CAPTURE_MS,
  PITCH_REFERENCE_POOL,
  PITCH_RULES,
  PITCH_TRIAL_COUNT,
  buildCompletedResult,
  isPitchHit,
  pitchTrialScore,
  scorePitchMatching,
  summarizeCapture,
  type CaptureSummary,
} from '@/lib/vocalBlueprint';
import type { AssessmentResult } from '@/lib/profileService';

const LISTEN_MS = 1400;
const TONE_MS = 1200;

type Phase = 'ready' | 'listen' | 'sing' | 'feedback' | 'failed';

interface TrialResult {
  score: number;
  usable: boolean;
}

interface PitchMatchAssessmentProps {
  onComplete: (result: AssessmentResult) => void;
  onCancel: () => void;
}

function pickTargets(): number[] {
  const targets: number[] = [];
  while (targets.length < PITCH_TRIAL_COUNT) {
    const candidate = PITCH_REFERENCE_POOL[Math.floor(Math.random() * PITCH_REFERENCE_POOL.length)];
    if (candidate !== targets[targets.length - 1]) targets.push(candidate);
  }
  return targets;
}

function feedbackFor(summary: CaptureSummary): string {
  switch (summary.status) {
    case 'ok':
      if (summary.medianCents !== null && isPitchHit(summary.medianCents)) return 'Right on the note!';
      return summary.medianCents !== null && summary.medianCents > 0
        ? 'Close, but a little sharp.'
        : 'Close, but a little flat.';
    case 'silent':
      return "We didn't hear you. Try singing a little louder.";
    case 'octave-error':
      return 'You sang an octave away from the tone. Try the same pitch you heard.';
    case 'unstable':
      return 'Your pitch wobbled. Aim for one steady note.';
    case 'unreliable':
      return "We couldn't read a clear pitch. Try a steady 'ah' sound.";
  }
}

export function PitchMatchAssessment({ onComplete, onCancel }: PitchMatchAssessmentProps) {
  const {
    permission,
    errorMessage,
    isActive,
    isReceiving,
    metrics,
    start,
    beginCapture,
    endCapture,
  } = useVoiceSampler();
  const { playTone } = useTonePlayer();
  const [phase, setPhase] = useState<Phase>('ready');
  const [targets, setTargets] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<CaptureSummary | null>(null);
  const [results, setResults] = useState<TrialResult[]>([]);
  const timersRef = useRef<number[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  const runTrial = useCallback((list: number[], i: number) => {
    const target = list[i];
    setIndex(i);
    setSummary(null);
    setPhase('listen');
    playTone({ frequency: midiToFrequency(target), durationMs: TONE_MS });
    schedule(() => {
      beginCapture();
      setPhase('sing');
    }, LISTEN_MS);
    schedule(() => {
      const result = summarizeCapture(endCapture(), target, PITCH_RULES);
      setSummary(result);
      setResults((prev) => [
        ...prev,
        {
          score: result.status === 'ok' && result.medianCents !== null ? pitchTrialScore(result.medianCents) : 0,
          usable: result.status === 'ok',
        },
      ]);
      setPhase('feedback');
    }, LISTEN_MS + PITCH_CAPTURE_MS);
  }, [playTone, schedule, beginCapture, endCapture]);

  const begin = () => {
    const list = pickTargets();
    setTargets(list);
    setResults([]);
    runTrial(list, 0);
  };

  const finish = () => {
    const usable = results.filter((r) => r.usable).length;
    if (usable === 0) {
      setPhase('failed');
      return;
    }
    const accuracy = scorePitchMatching(results.map((r) => r.score));
    onComplete(buildCompletedResult(BLUEPRINT_MODULES.pitch, accuracy, PITCH_TRIAL_COUNT, usable));
  };

  const advance = () => {
    if (index + 1 < targets.length) {
      runTrial(targets, index + 1);
    } else {
      finish();
    }
  };

  const currentNote = targets.length > 0 ? midiToNoteName(targets[index]) : '';
  const isLastTrial = index + 1 >= PITCH_TRIAL_COUNT;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-sage-light/30 border border-sage-DEFAULT p-4 text-sm text-charcoal-light">
        <p className="font-medium text-charcoal mb-1">Pitch Matching</p>
        <p className="text-xs text-charcoal-muted">
          You'll hear {PITCH_TRIAL_COUNT} notes. After each one, sing it back and hold it steady.
        </p>
      </div>

      {phase === 'ready' && (
        <div className="flex flex-col gap-3">
          <MicPermission
            permission={permission}
            errorMessage={errorMessage}
            onStart={start}
            isActive={isActive}
            isReceiving={isReceiving}
          />
          {isActive && (
            <button onClick={begin} className="btn-primary w-full">
              <Volume2 className="h-4 w-4" /> Play first note
            </button>
          )}
        </div>
      )}

      {phase === 'listen' && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-cream-400 bg-cream-100 p-6 text-center">
          <Volume2 className="h-8 w-8 text-sage-deep animate-pulse" />
          <p className="text-sm font-medium text-charcoal">Listen to the note</p>
          <p className="text-xs text-charcoal-muted">Note {index + 1} of {PITCH_TRIAL_COUNT}</p>
        </div>
      )}

      {phase === 'sing' && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-sage-DEFAULT bg-sage-light/30 p-6 text-center">
          <Mic className="h-8 w-8 text-sage-deep animate-pulse" />
          <p className="text-sm font-medium text-charcoal">Sing {currentNote} now</p>
          <p className="text-xs text-charcoal-muted">
            You're singing: <span className="font-medium text-charcoal">{metrics.noteLabel ?? 'Listening...'}</span>
          </p>
        </div>
      )}

      {phase === 'feedback' && summary && (
        <div className="flex flex-col gap-3 rounded-xl border border-cream-400 bg-cream-100 p-5 text-center">
          <p className="text-xs text-charcoal-muted">Note {index + 1} of {PITCH_TRIAL_COUNT}, the target was {currentNote}</p>
          <p className="text-sm font-medium text-charcoal">{feedbackFor(summary)}</p>
          <button onClick={advance} className="btn-primary w-full">
            {isLastTrial ? 'See my result' : 'Next note'}
          </button>
        </div>
      )}

      {phase === 'failed' && (
        <div className="flex flex-col gap-3 rounded-xl border border-terracotta-DEFAULT bg-terracotta-light p-5 text-center">
          <p className="text-sm font-medium text-terracotta-deep">We didn't hear a steady note on any try.</p>
          <p className="text-xs text-terracotta-deep">Check that your microphone is on and try again in a quieter room.</p>
          <button onClick={() => setPhase('ready')} className="btn-primary w-full">Try again</button>
        </div>
      )}

      <button onClick={onCancel} className="text-xs text-charcoal-muted hover:text-charcoal w-fit mx-auto">
        Stop and go back
      </button>
    </div>
  );
}
