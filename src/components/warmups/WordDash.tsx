import { segmentIndexAt, type ExercisePlan } from '@/lib/warmupTiming';

interface WordDashProps {
  plan: ExercisePlan;
  elapsedMs: number;
}

export function WordDash({ plan, elapsedMs }: WordDashProps) {
  const index = segmentIndexAt(plan.segments, elapsedMs);
  const segment = plan.segments[index];
  const next = plan.segments[index + 1];
  const progress = segment ? Math.min((elapsedMs - segment.startMs) / (segment.endMs - segment.startMs), 1) : 0;

  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-6 rounded-2xl border border-charcoal/10 bg-cream-100 px-6 py-10 text-center shadow-paper-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
        {segment ? `Phrase ${index + 1} of ${plan.segments.length}` : 'Finished'}
      </p>
      <p key={index} className="animate-fade-in text-2xl font-semibold leading-snug text-charcoal sm:text-3xl">
        {segment?.label ?? 'Complete'}
      </p>
      <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-cream-300">
        <div className="h-full rounded-full bg-sage-dark transition-[width] duration-100 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
      {next && <p className="text-sm text-charcoal-muted">Next: {next.label}</p>}
    </div>
  );
}
