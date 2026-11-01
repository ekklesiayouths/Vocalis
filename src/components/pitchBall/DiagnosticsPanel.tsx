import { midiToNoteName } from '@/lib/notes';
import { yToMidi, type VoiceRange } from '@/lib/pitchBall';
import type { InputSource, PitchBallHud, TrackStatus } from '@/components/pitchBall/usePitchBallEngine';

interface DiagnosticsPanelProps {
  hud: PitchBallHud;
  range: VoiceRange | null;
  input: InputSource;
}

const TRACK_LABELS: Record<TrackStatus, string> = {
  keys: 'Keyboard or touch control',
  'no-mic': 'Microphone not running',
  receiving: 'Receiving a steady pitch',
  holding: 'Holding last pitch through silence',
  'rejecting-jump': 'Waiting to confirm a sudden octave jump',
  silent: 'No reliable pitch',
};

export function DiagnosticsPanel({ hud, range, input }: DiagnosticsPanelProps) {
  const rows: [string, string][] = [
    ['Detected frequency', hud.frequency ? `${hud.frequency.toFixed(1)} Hz` : 'None'],
    ['Detected note', hud.noteLabel ?? 'None'],
    ['Microphone level (RMS)', hud.rawRms.toFixed(3)],
    ['Pitch clarity (detector value)', hud.clarity.toFixed(2)],
    ['Tracking', input === 'keys' ? TRACK_LABELS.keys : TRACK_LABELS[hud.trackStatus]],
    [
      'Calibrated range',
      range ? `${midiToNoteName(Math.round(range.lowMidi))} to ${midiToNoteName(Math.round(range.highMidi))}` : 'Not calibrated',
    ],
    ['Ball height', `${Math.round(hud.ballY * 100)}% (0% is bottom)`],
    [
      'Ball pitch position',
      range && input === 'mic'
        ? midiToNoteName(Math.round(yToMidi(hud.ballY, range)))
        : 'Not available',
    ],
    ['Latency', 'Not measured'],
  ];

  return (
    <div className="rounded-2xl border border-cream-400 bg-cream-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">Diagnostics</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-b border-cream-400 pb-1">
            <dt className="text-xs text-charcoal-muted">{label}</dt>
            <dd className="text-sm font-medium text-charcoal tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
