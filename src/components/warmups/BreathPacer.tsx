import { segmentIndexAt, type ExercisePlan } from '@/lib/warmupTiming';

interface BreathPacerProps {
  plan: ExercisePlan;
  elapsedMs: number;
}

const MIN_SCALE = 0.55;

export function BreathPacer({ plan, elapsedMs }: BreathPacerProps) {
  const segment = plan.segments[segmentIndexAt(plan.segments, elapsedMs)];
  const progress = segment ? (elapsedMs - segment.startMs) / (segment.endMs - segment.startMs) : 0;
  const isIn = segment?.kind === 'breath-in';
  const scale = isIn ? MIN_SCALE + (1 - MIN_SCALE) * progress : 1 - (1 - MIN_SCALE) * progress;
  const secondsLeft = segment ? Math.ceil((segment.endMs - elapsedMs) / 1000) : 0;

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-charcoal/10 bg-cream-100 px-6 py-10 shadow-paper-sm">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div
          className={`absolute inset-0 rounded-full ${isIn ? 'bg-sage-light' : 'bg-terracotta-light'}`}
          style={{ transform: `scale(${scale})`, transition: 'transform 120ms linear' }}
        />
        <div className="relative text-center">
          <p className="font-hand text-3xl text-charcoal">{segment?.label ?? 'Complete'}</p>
          <p className="mt-1 text-sm tabular-nums text-charcoal-muted">{segment ? `${secondsLeft}s` : ''}</p>
        </div>
      </div>
      <p className="text-sm text-charcoal-muted">The circle is a guide only. Breathe at a pace that feels comfortable.</p>
    </div>
  );
}
