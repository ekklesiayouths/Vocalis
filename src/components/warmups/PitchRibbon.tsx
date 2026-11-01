import { freqToMidi, isReliableReading } from '@/lib/pitchBall';
import { midiToNoteName } from '@/lib/notes';
import { centsFromMidi, pitchRange, pitchTargetAt, type ExercisePlan } from '@/lib/warmupTiming';
import type { VoiceReading } from '@/lib/warmupScoring';

interface PitchRibbonProps {
  plan: ExercisePlan;
  elapsedMs: number;
  reading: VoiceReading;
}

const WIDTH = 800;
const HEIGHT = 300;
const PAD_Y = 28;
const PAD_LEFT = 56;
const WINDOW_MS = 8000;
const PLAYHEAD_FRACTION = 0.3;
const NOTE_HEIGHT = 16;

export function PitchRibbon({ plan, elapsedMs, reading }: PitchRibbonProps) {
  const range = pitchRange(plan);
  if (!range) return null;

  const plotWidth = WIDTH - PAD_LEFT;
  const playheadX = PAD_LEFT + plotWidth * PLAYHEAD_FRACTION;
  const toX = (ms: number) => playheadX + ((ms - elapsedMs) / WINDOW_MS) * plotWidth;
  const toY = (midi: number) => PAD_Y + ((range.high - midi) / (range.high - range.low)) * (HEIGHT - PAD_Y * 2);

  const visible = plan.segments.filter(
    (segment) =>
      segment.midi !== null &&
      segment.endMs >= elapsedMs - WINDOW_MS * PLAYHEAD_FRACTION &&
      segment.startMs <= elapsedMs + WINDOW_MS * (1 - PLAYHEAD_FRACTION)
  );

  const guideMidis: number[] = [];
  for (let midi = Math.ceil(range.low); midi <= Math.floor(range.high); midi += 1) guideMidis.push(midi);

  const target = pitchTargetAt(plan, elapsedMs);
  const reliable = isReliableReading(reading.frequency, reading.clarity, reading.rms);
  const liveMidi = reliable && reading.frequency !== null ? freqToMidi(reading.frequency) : null;
  const cents = target && reliable && reading.frequency !== null ? centsFromMidi(reading.frequency, target.midi) : null;
  const liveTone =
    cents === null || !target
      ? 'fill-charcoal-muted'
      : Math.abs(cents) <= target.toleranceCents
        ? 'fill-sage-deep'
        : cents > 0
          ? 'fill-terracotta-deep'
          : 'fill-mustard-deep';
  const liveLabel =
    cents === null || !target
      ? 'Listening'
      : Math.abs(cents) <= target.toleranceCents
        ? 'On the line'
        : cents > 0
          ? 'Sharp'
          : 'Flat';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-charcoal/10 bg-cream-100 shadow-paper-sm">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Pitch ribbon showing target notes and your voice">
        {guideMidis.map((midi) => (
          <g key={midi}>
            <line x1={PAD_LEFT} x2={WIDTH} y1={toY(midi)} y2={toY(midi)} className="stroke-charcoal/10" strokeWidth={1} />
            <text x={PAD_LEFT - 10} y={toY(midi) + 4} textAnchor="end" className="fill-charcoal-muted text-[13px]">
              {midiToNoteName(midi)}
            </text>
          </g>
        ))}

        {visible.map((segment, index) => {
          const x0 = toX(segment.startMs);
          const x1 = toX(segment.endMs);
          const y0 = toY(segment.midi ?? 0);
          const isGlide = segment.midiEnd !== null && segment.midiEnd !== segment.midi;
          const y1 = toY(segment.midiEnd ?? segment.midi ?? 0);
          const past = segment.endMs <= elapsedMs;
          const shape = isGlide ? (
            <polygon
              points={`${x0},${y0 - NOTE_HEIGHT / 2} ${x1},${y1 - NOTE_HEIGHT / 2} ${x1},${y1 + NOTE_HEIGHT / 2} ${x0},${y0 + NOTE_HEIGHT / 2}`}
              className={past ? 'fill-sage-light stroke-sage-dark' : 'fill-sage stroke-sage-deep'}
              strokeWidth={1.5}
            />
          ) : (
            <rect
              x={x0 + 2}
              y={y0 - NOTE_HEIGHT / 2}
              width={Math.max(x1 - x0 - 4, 2)}
              height={NOTE_HEIGHT}
              rx={8}
              className={past ? 'fill-sage-light stroke-sage-dark' : 'fill-sage stroke-sage-deep'}
              strokeWidth={1.5}
            />
          );
          return (
            <g key={`${segment.startMs}-${index}`}>
              {shape}
              {x1 - x0 > 56 && (
                <text x={x0 + 8} y={Math.min(y0, y1) - NOTE_HEIGHT} className="fill-charcoal-light text-[13px] font-medium">
                  {segment.label}
                </text>
              )}
            </g>
          );
        })}

        <line x1={playheadX} x2={playheadX} y1={PAD_Y - 12} y2={HEIGHT - PAD_Y + 12} className="stroke-charcoal/40" strokeWidth={2} strokeDasharray="6 6" />

        {liveMidi !== null && (
          <circle
            cx={playheadX}
            cy={toY(Math.min(Math.max(liveMidi, range.low), range.high))}
            r={10}
            className={`${liveTone} stroke-cream-50 transition-[cy] duration-100 ease-out`}
            strokeWidth={3}
          />
        )}
      </svg>
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-cream-50/90 px-3 py-1 text-xs font-medium text-charcoal-light shadow-paper-sm">
        {liveLabel}
      </div>
    </div>
  );
}
