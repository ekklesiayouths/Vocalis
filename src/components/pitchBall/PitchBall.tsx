import { useRef, useState } from 'react';
import { Activity, Keyboard, Mic, Music, Waves } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { createVoiceRange, type VoiceRange } from '@/lib/pitchBall';
import { midiToNoteName } from '@/lib/notes';
import { usePitchBallEngine, type GameMode, type InputSource } from '@/components/pitchBall/usePitchBallEngine';
import { VoiceCalibration } from '@/components/pitchBall/VoiceCalibration';
import { PitchBallPlay } from '@/components/pitchBall/PitchBallPlay';

type Screen = 'menu' | 'calibrate' | 'play';

const RANGE_STORAGE_KEY = 'vocalis.pitchBall.voiceRange';

function loadRange(): VoiceRange | null {
  try {
    const raw = window.localStorage.getItem(RANGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VoiceRange>;
    if (typeof parsed.lowMidi !== 'number' || typeof parsed.highMidi !== 'number') return null;
    return createVoiceRange(parsed.lowMidi, parsed.highMidi);
  } catch {
    return null;
  }
}

function saveRange(range: VoiceRange) {
  try {
    window.localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(range));
  } catch {
    // Storage can be unavailable in private browsing; the range still applies for this visit.
  }
}

const MODE_CARDS: { id: GameMode; title: string; description: string; icon: typeof Waves }[] = [
  {
    id: 'arcade',
    title: 'Arcade',
    description: 'Sing higher to lift the ball and lower to drop it. Steer through the gaps as the road speeds up.',
    icon: Waves,
  },
  {
    id: 'music',
    title: 'Music Challenge',
    description: 'Each gate shows a note. Hear the reference, then sing it accurately and hold it to earn points.',
    icon: Music,
  },
];

export function PitchBall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode>('arcade');
  const [keyboardInput, setKeyboardInput] = useState<boolean>(false);
  const [range, setRange] = useState<VoiceRange | null>(loadRange);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { playTone } = useTonePlayer();

  const input: InputSource = mode === 'arcade' && keyboardInput ? 'keys' : 'mic';
  const needsRange = input === 'mic';
  const canStart = !needsRange || range !== null;

  const engine = usePitchBallEngine(canvasRef, {
    mode,
    input,
    range,
    playTone: (frequency, durationMs) => playTone({ frequency, durationMs, volume: 0.22 }),
  });

  const leavePlay = () => {
    engine.stop();
    setScreen('menu');
  };

  if (screen === 'calibrate') {
    return (
      <VoiceCalibration
        mic={engine}
        initial={range}
        onCancel={() => setScreen('menu')}
        onSave={(saved) => {
          saveRange(saved);
          setRange(saved);
          setScreen('menu');
        }}
      />
    );
  }

  if (screen === 'play') {
    return (
      <PitchBallPlay
        canvasRef={canvasRef}
        engine={engine}
        mode={mode}
        input={input}
        range={range}
        showDiagnostics={showDiagnostics}
        onToggleDiagnostics={() => setShowDiagnostics((v) => !v)}
        onMenu={leavePlay}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-charcoal">Pitch Ball</h2>
        <p className="mt-1 text-sm text-charcoal-muted">Your voice steers the ball. Pick a mode to begin.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MODE_CARDS.map((card) => {
          const Icon = card.icon;
          const selected = mode === card.id;
          return (
            <button
              key={card.id}
              onClick={() => setMode(card.id)}
              aria-pressed={selected}
              className={`rounded-2xl border p-5 text-left transition-all duration-200 ${
                selected
                  ? 'border-sage-dark bg-sage-light shadow-paper-sage'
                  : 'border-cream-400 bg-cream-50 hover:-translate-y-0.5 hover:shadow-paper-sm'
              }`}
            >
              <Icon className="h-6 w-6 text-sage-deep" />
              <p className="mt-3 text-lg font-bold text-charcoal">{card.title}</p>
              <p className="mt-1 text-sm text-charcoal-light">{card.description}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-cream-400 bg-cream-50 p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-charcoal">Your voice range</p>
            <p className="text-sm text-charcoal-muted">
              {range
                ? `${midiToNoteName(Math.round(range.lowMidi))} to ${midiToNoteName(Math.round(range.highMidi))}`
                : 'Not calibrated yet. Calibrate once so the ball knows your low and high notes.'}
            </p>
          </div>
          <button onClick={() => setScreen('calibrate')} className="btn-secondary">
            <Mic className="h-4 w-4" /> {range ? 'Recalibrate' : 'Calibrate voice'}
          </button>
        </div>

        {mode === 'arcade' && (
          <div className="flex flex-col gap-2 border-t border-cream-400 pt-4">
            <p className="text-sm font-semibold text-charcoal">Controls</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setKeyboardInput(false)}
                aria-pressed={!keyboardInput}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  !keyboardInput ? 'border-sage-dark bg-sage-light text-charcoal' : 'border-cream-400 text-charcoal-muted hover:text-charcoal'
                }`}
              >
                <Mic className="h-4 w-4" /> Voice
              </button>
              <button
                onClick={() => setKeyboardInput(true)}
                aria-pressed={keyboardInput}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  keyboardInput ? 'border-sage-dark bg-sage-light text-charcoal' : 'border-cream-400 text-charcoal-muted hover:text-charcoal'
                }`}
              >
                <Keyboard className="h-4 w-4" /> Keys or touch
              </button>
            </div>
          </div>
        )}

        {needsRange && !range && (
          <p className="text-xs text-terracotta-deep">Calibrate your voice before starting this mode.</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          onClick={() => setShowDiagnostics((v) => !v)}
          aria-pressed={showDiagnostics}
          className="flex items-center justify-center gap-2 text-sm text-charcoal-muted transition-colors hover:text-charcoal"
        >
          <Activity className="h-4 w-4" /> {showDiagnostics ? 'Hide' : 'Show'} diagnostics
        </button>
        <button
          onClick={() => {
            setScreen('play');
            void engine.start();
          }}
          disabled={!canStart}
          className="btn-primary"
        >
          Start {mode === 'arcade' ? 'Arcade' : 'Music Challenge'}
        </button>
      </div>
    </div>
  );
}
