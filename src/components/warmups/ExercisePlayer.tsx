import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, LogOut, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { MicPermission } from '@/components/MicPermission';
import { BreathPacer } from '@/components/warmups/BreathPacer';
import { PitchRibbon } from '@/components/warmups/PitchRibbon';
import { WordDash } from '@/components/warmups/WordDash';
import { useTimedExercise } from '@/hooks/useTimedExercise';
import { submitAttempt } from '@/lib/progressService';
import { submitScore } from '@/lib/scoreService';
import { DEFAULT_TEMPO, TEMPO_LEVELS, getExercise, getTempo, type ExerciseId, type TempoId } from '@/lib/warmupCatalog';
import type { ExerciseResult } from '@/lib/warmupScoring';

export interface RoutineStepControls {
  stepLabel: string;
  onSkip: () => void;
  onContinue: (result: ExerciseResult) => void;
}

interface ExercisePlayerProps {
  exerciseId: ExerciseId;
  durationSec?: number;
  routine?: RoutineStepControls;
  onExit: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function ExercisePlayer({ exerciseId, durationSec, routine, onExit }: ExercisePlayerProps) {
  const meta = getExercise(exerciseId);
  const [tempoId, setTempoId] = useState<TempoId>(DEFAULT_TEMPO);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const seconds = durationSec ?? meta.defaultDurationSec;
  const tempo = getTempo(tempoId);
  const plan = useMemo(() => meta.build(tempo.factor, seconds * 1000), [meta, tempo.factor, seconds]);
  const session = useTimedExercise({ plan, usesMic: meta.usesMic, usesPitch: meta.usesPitch });
  const { status, elapsedMs, liveReading, result, mic } = session;
  const canStart = !meta.usesMic || mic.permission === 'granted';
  const progress = plan.totalMs > 0 ? Math.min(elapsedMs / plan.totalMs, 1) : 0;

  useEffect(() => {
    if (!result || result.accuracyPct === null) return;
    const accuracy = result.accuracyPct;
    const elapsedSec = Math.round(result.durationMs / 1000);
    let cancelled = false;
    const save = async () => {
      const saved = await submitScore(meta.title, accuracy, elapsedSec);
      if (cancelled) return;
      if (!saved.success) {
        setSaveNote('This result could not be saved right now.');
        return;
      }
      await submitAttempt(meta.title, accuracy, elapsedSec, saved.xpEarned ?? 0, accuracy / 100);
      if (!cancelled) setSaveNote('Saved to your progress.');
    };
    void save();
    return () => {
      cancelled = true;
    };
  }, [result, meta.title]);

  const restart = () => {
    setSaveNote(null);
    session.restart();
  };

  const visual =
    meta.visual === 'ribbon' ? (
      <PitchRibbon plan={plan} elapsedMs={elapsedMs} reading={liveReading} />
    ) : meta.visual === 'pacer' ? (
      <BreathPacer plan={plan} elapsedMs={elapsedMs} />
    ) : (
      <WordDash plan={plan} elapsedMs={elapsedMs} />
    );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="btn-secondary inline-flex items-center gap-2">
          {routine ? <LogOut className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          {routine ? 'Exit routine' : 'Back to exercises'}
        </button>
        {routine && <p className="text-sm font-medium text-charcoal-muted">{routine.stepLabel}</p>}
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold leading-tight text-charcoal">{meta.title}</h2>
        <p className="text-charcoal-light">{meta.summary}</p>
      </div>

      <section className="card space-y-3 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-muted">How to do it</h3>
        <ol className="list-decimal space-y-2 pl-5 text-charcoal-light">
          {meta.instructions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {meta.usesMic && (
        <MicPermission
          permission={mic.permission}
          errorMessage={mic.errorMessage}
          onStart={mic.start}
          isActive={mic.isActive}
          isReceiving={mic.isReceiving}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm tabular-nums text-charcoal-muted">
          <span>{formatTime(elapsedMs)}</span>
          <span>{formatTime(plan.totalMs)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-cream-300">
          <div className="h-full rounded-full bg-sage-dark transition-[width] duration-150 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {visual}

      {status === 'ready' && (
        <div className="flex flex-wrap items-center gap-4">
          {!routine && (
            <div className="flex items-center gap-2" role="group" aria-label="Tempo">
              {TEMPO_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  aria-pressed={level.id === tempoId}
                  onClick={() => setTempoId(level.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    level.id === tempoId
                      ? 'border-sage-deep bg-sage-light text-charcoal'
                      : 'border-charcoal/15 bg-cream-50 text-charcoal-light hover:border-sage-dark'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={session.begin} disabled={!canStart} className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Play className="h-4 w-4" />
            Start
          </button>
          {routine && (
            <button type="button" onClick={routine.onSkip} className="btn-secondary inline-flex items-center gap-2">
              <SkipForward className="h-4 w-4" />
              Skip
            </button>
          )}
        </div>
      )}

      {(status === 'running' || status === 'paused') && (
        <div className="flex flex-wrap items-center gap-3">
          {status === 'running' ? (
            <button type="button" onClick={session.pause} className="btn-primary inline-flex items-center gap-2">
              <Pause className="h-4 w-4" />
              Pause
            </button>
          ) : (
            <button type="button" onClick={session.resume} className="btn-primary inline-flex items-center gap-2">
              <Play className="h-4 w-4" />
              Resume
            </button>
          )}
          <button type="button" onClick={restart} className="btn-secondary inline-flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>
          {routine && (
            <button type="button" onClick={routine.onSkip} className="btn-secondary inline-flex items-center gap-2">
              <SkipForward className="h-4 w-4" />
              Skip
            </button>
          )}
        </div>
      )}

      {status === 'done' && result && (
        <section className="card space-y-4 p-6 animate-scale-in">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-light text-sage-deep">
              <Check className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-semibold text-charcoal">Exercise complete</h3>
          </div>
          {result.accuracyPct !== null && (
            <p className="text-4xl font-semibold tabular-nums text-charcoal">{result.accuracyPct}%</p>
          )}
          <p className="text-charcoal-light">{result.message}</p>
          {result.coveragePct !== null && (
            <p className="text-sm text-charcoal-muted">Your voice was heard on {result.coveragePct}% of the sung notes.</p>
          )}
          {saveNote && <p className="text-sm text-charcoal-muted">{saveNote}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            {routine ? (
              <button type="button" onClick={() => routine.onContinue(result)} className="btn-primary inline-flex items-center gap-2">
                Continue
              </button>
            ) : (
              <button type="button" onClick={restart} className="btn-primary inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Practice again
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
