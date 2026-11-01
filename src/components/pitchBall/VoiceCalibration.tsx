import { useState } from 'react';
import { Mic, RotateCcw, Check } from 'lucide-react';
import { midiToNoteName } from '@/lib/notes';
import { createVoiceRange, isSteadySample, median, type VoiceRange } from '@/lib/pitchBall';

export interface MicControls {
  ensureMic: () => Promise<void>;
  measureNote: (durationMs: number) => Promise<number[]>;
  releaseMic: () => void;
}

interface VoiceCalibrationProps {
  mic: MicControls;
  initial: VoiceRange | null;
  onSave: (range: VoiceRange) => void;
  onCancel: () => void;
}

const MEASURE_MS = 2500;

type MeasureTarget = 'low' | 'high' | 'test';

export function VoiceCalibration({ mic, initial, onSave, onCancel }: VoiceCalibrationProps) {
  const [lowMidi, setLowMidi] = useState<number | null>(initial?.lowMidi ?? null);
  const [highMidi, setHighMidi] = useState<number | null>(initial?.highMidi ?? null);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<MeasureTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const measure = async (target: MeasureTarget) => {
    setBusy(target);
    setMessage(null);
    try {
      await mic.ensureMic();
      const samples = await mic.measureNote(MEASURE_MS);
      const center = median(samples);
      if (center === null || !isSteadySample(samples)) {
        setMessage('We could not hear one steady note. Sing a clear note for the full few seconds and try again.');
        return;
      }
      if (target === 'low') setLowMidi(center);
      if (target === 'high') setHighMidi(center);
      if (target === 'test') setTestNote(midiToNoteName(Math.round(center)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not use the microphone.');
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    if (lowMidi === null || highMidi === null) return;
    const range = createVoiceRange(Math.round(lowMidi), Math.round(highMidi));
    if (!range) {
      setMessage('Your high note needs to be at least a fifth above your low note. Sing a higher note and measure again.');
      return;
    }
    mic.releaseMic();
    onSave(range);
  };

  const cancel = () => {
    mic.releaseMic();
    onCancel();
  };

  const busyLabel = (target: MeasureTarget) => (busy === target ? 'Listening...' : null);

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in max-w-md mx-auto w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-charcoal">Calibrate your voice</h2>
        <p className="mt-1 text-sm text-charcoal-muted">
          Sing your lowest and highest comfortable notes for about {MEASURE_MS / 1000} seconds each. Never strain.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-cream-400 bg-cream-100 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-charcoal-muted">Lowest</p>
          <p className="mt-1 text-2xl font-bold text-charcoal">{lowMidi !== null ? midiToNoteName(Math.round(lowMidi)) : '—'}</p>
        </div>
        <div className="rounded-xl border border-cream-400 bg-cream-100 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-charcoal-muted">Highest</p>
          <p className="mt-1 text-2xl font-bold text-charcoal">{highMidi !== null ? midiToNoteName(Math.round(highMidi)) : '—'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button onClick={() => measure('low')} disabled={busy !== null} className="btn-secondary w-full">
          <Mic className="h-4 w-4" /> {busyLabel('low') ?? (lowMidi !== null ? 'Measure lowest again' : 'Measure lowest note')}
        </button>
        <button onClick={() => measure('high')} disabled={busy !== null} className="btn-secondary w-full">
          <Mic className="h-4 w-4" /> {busyLabel('high') ?? (highMidi !== null ? 'Measure highest again' : 'Measure highest note')}
        </button>
        <button onClick={() => measure('test')} disabled={busy !== null} className="btn-secondary w-full">
          <RotateCcw className="h-4 w-4" /> {busyLabel('test') ?? 'Test microphone'}
        </button>
      </div>

      {testNote && (
        <p className="text-center text-sm text-charcoal-light">
          Microphone heard a steady <span className="font-semibold text-charcoal">{testNote}</span>. Input is working.
        </p>
      )}

      {message && (
        <div className="rounded-xl border border-terracotta-DEFAULT bg-terracotta-light px-4 py-3 text-xs text-terracotta-deep">
          {message}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button onClick={cancel} className="text-sm text-charcoal-muted hover:text-charcoal">Back</button>
        <button onClick={save} disabled={lowMidi === null || highMidi === null || busy !== null} className="btn-primary">
          <Check className="h-4 w-4" /> Save range
        </button>
      </div>
    </div>
  );
}
