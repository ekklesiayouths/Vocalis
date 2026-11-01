import { useEffect, type PointerEvent, type RefObject } from 'react';
import { ChevronLeft, Heart, Pause, Play, RotateCcw, Trophy } from 'lucide-react';
import type { VoiceRange } from '@/lib/pitchBall';
import type { GameMode, InputSource, usePitchBallEngine } from '@/components/pitchBall/usePitchBallEngine';
import { DiagnosticsPanel } from '@/components/pitchBall/DiagnosticsPanel';
import { LIVES_START } from '@/lib/pitchBall';

type PitchBallEngine = ReturnType<typeof usePitchBallEngine>;

interface PitchBallPlayProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  engine: PitchBallEngine;
  mode: GameMode;
  input: InputSource;
  range: VoiceRange | null;
  showDiagnostics: boolean;
  onToggleDiagnostics: () => void;
  onMenu: () => void;
}

const KEY_DIRECTIONS: Record<string, -1 | 1> = {
  ArrowUp: -1,
  KeyW: -1,
  ArrowDown: 1,
  KeyS: 1,
};

export function PitchBallPlay({
  canvasRef, engine, mode, input, range, showDiagnostics, onToggleDiagnostics, onMenu,
}: PitchBallPlayProps) {
  const { hud } = engine;
  const keyboard = input === 'keys';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (engine.hud?.phase === 'playing') engine.pause();
        else if (engine.hud?.phase === 'paused') engine.resume();
        return;
      }
      const direction = KEY_DIRECTIONS[event.code];
      if (keyboard && direction !== undefined) {
        event.preventDefault();
        engine.nudge(direction);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (KEY_DIRECTIONS[event.code] !== undefined) engine.nudge(0);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      engine.nudge(0);
    };
  }, [keyboard, engine]);

  if (!hud) return null;

  const handlePointer = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!keyboard) return;
    if (event.pointerType !== 'touch' && event.buttons === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    engine.setPointerY((event.clientY - rect.top) / rect.height);
  };

  const releasePointer = () => {
    if (keyboard) engine.setPointerY(null);
  };

  const isMusic = mode === 'music';
  const modeTitle = isMusic ? 'Music Challenge' : 'Arcade';
  const lives = Math.max(hud.lives, 0);
  const micStarting = !hud.micRunning && !hud.micError && hud.phase === 'ready';

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => {
            engine.stop();
            onMenu();
          }}
          className="flex items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal"
        >
          <ChevronLeft className="h-4 w-4" /> Menu
        </button>
        <p className="text-sm font-semibold text-charcoal">{modeTitle}</p>
        <button
          onClick={onToggleDiagnostics}
          aria-pressed={showDiagnostics}
          className="text-sm text-charcoal-muted transition-colors hover:text-charcoal"
        >
          {showDiagnostics ? 'Hide diagnostics' : 'Diagnostics'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <Stat label="Score" value={hud.score} />
        <Stat label="Level" value={hud.level} />
        <Stat label="Gates" value={`${hud.gatesPassed} / ${hud.gatesResolved}`} />
        <div className="rounded-xl border border-cream-400 bg-cream-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-charcoal-muted">Lives</p>
          <div className="mt-1 flex gap-1">
            {Array.from({ length: LIVES_START }, (_, i) => (
              <Heart
                key={i}
                className={`h-4 w-4 ${i < lives ? 'fill-terracotta-deep text-terracotta-deep' : 'text-cream-400'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {isMusic && (
        <div className="rounded-xl border border-sage-dark bg-sage-light px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-charcoal-light">Sing this note</p>
          <p className="text-2xl font-bold text-charcoal">{hud.targetLabel ?? 'Get ready'}</p>
          <p className="text-xs text-charcoal-light">
            Matches: {hud.noteMatches} of {hud.noteChallenges}. Hold the correct pitch for a moment to score.
          </p>
        </div>
      )}

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-cream-400 bg-charcoal shadow-paper aspect-[4/3] sm:aspect-[16/9]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
          onPointerUp={releasePointer}
          onPointerLeave={releasePointer}
          onPointerCancel={releasePointer}
          aria-label="Pitch Ball game field"
        />

        {hud.phase !== 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-charcoal/60 p-4 backdrop-blur-[2px] animate-fade-in">
            <div className="w-full max-w-xs rounded-2xl bg-cream-50 p-5 text-center shadow-paper-lg">
              {hud.phase === 'over' && (
                <>
                  <Trophy className="mx-auto h-8 w-8 text-mustard-deep" />
                  <p className="mt-2 text-lg font-bold text-charcoal">Run over</p>
                  <p className="mt-1 text-sm text-charcoal-light">
                    Score {hud.score}. Passed {hud.gatesPassed} gates
                    {isMusic ? ` and matched ${hud.noteMatches} notes` : ''}.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button onClick={() => void engine.restart()} className="btn-primary w-full">
                      <RotateCcw className="h-4 w-4" /> Play again
                    </button>
                    <button onClick={() => { engine.stop(); onMenu(); }} className="btn-secondary w-full">Back to menu</button>
                  </div>
                </>
              )}
              {hud.phase === 'paused' && (
                <>
                  <p className="text-lg font-bold text-charcoal">Paused</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button onClick={() => engine.resume()} className="btn-primary w-full">
                      <Play className="h-4 w-4" /> Resume
                    </button>
                    <button onClick={() => void engine.restart()} className="btn-secondary w-full">
                      <RotateCcw className="h-4 w-4" /> Restart
                    </button>
                  </div>
                </>
              )}
              {hud.phase === 'ready' && (
                <>
                  <p className="text-sm font-semibold text-charcoal">
                    {hud.micError ? 'The microphone could not start' : micStarting ? 'Starting microphone...' : 'Ready'}
                  </p>
                  {hud.micError && (
                    <>
                      <p className="mt-2 text-xs text-terracotta-deep">{hud.micError}</p>
                      <button onClick={() => { engine.stop(); onMenu(); }} className="btn-secondary mt-4 w-full">Back to menu</button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-charcoal-muted">
          {keyboard
            ? 'Arrow keys or W and S move the ball. Drag or tap the field on touch screens. Space pauses.'
            : range
              ? 'Sing higher to rise and lower to drop. Space pauses.'
              : 'Calibrate your voice from the menu first.'}
        </p>
        {hud.phase === 'playing' && (
          <button onClick={() => engine.pause()} className="btn-secondary">
            <Pause className="h-4 w-4" /> Pause
          </button>
        )}
      </div>

      {showDiagnostics && <DiagnosticsPanel hud={hud} range={range} input={input} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-cream-400 bg-cream-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-charcoal-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-charcoal">{value}</p>
    </div>
  );
}
