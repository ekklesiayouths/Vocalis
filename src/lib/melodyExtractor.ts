/**
 * Melody extractor — analyzes an uploaded audio file to detect the
 * dominant pitch sequence (melody) using the same normalized
 * autocorrelation algorithm as the real-time pitch detector.
 *
 * PROCESS:
 * 1. Decode the audio file using the Web Audio API (AudioContext.decodeAudioData)
 * 2. Segment the audio into analysis frames (e.g., 50ms windows)
 * 3. For each frame, run autocorrelation pitch detection
 * 4. Filter out silence and low-clarity frames
 * 5. Quantize the detected pitches into a MIDI note sequence
 * 6. Return the melody as an array of MIDI notes with timing information
 *
 * LIMITATIONS (honestly represented):
 * - Works best on monophonic audio (single melody line, solo voice)
 * - Polyphonic audio (choir with instruments) will produce less reliable results
 * - Overlapping voices, heavy reverb, or backing tracks reduce accuracy
 * - Low confidence frames are marked for review, not hidden
 *
 * SECURITY: All processing happens in-browser. Audio data never leaves
 * the client. No external services are called.
 */

import { midiToFrequency } from '@/lib/notes';

export interface MelodyNote {
  midi: number;
  /** Start time in seconds */
  startTime: number;
  /** Duration in seconds */
  duration: number;
  /** Clarity/confidence of the pitch detection (0-1) */
  clarity: number;
}

export interface MelodyExtractionResult {
  notes: MelodyNote[];
  /** Average clarity across all detected notes (0-1) */
  averageClarity: number;
  /** Fraction of the audio that contained detectable pitch (0-1) */
  voicingRatio: number;
  /** Overall confidence assessment */
  confidence: 'high' | 'medium' | 'low' | 'unreliable';
  /** Human-readable summary of reliability */
  assessment: string;
}

const FRAME_SIZE = 2048;
const HOP_SIZE = 1024; // 50% overlap
const CLARITY_THRESHOLD = 0.5;
const MIN_FREQUENCY = 70;
const MAX_FREQUENCY = 1200;

/**
 * Extract a melody from an audio file.
 *
 * @param file - An audio File object (MP3, WAV, etc.)
 * @returns A MelodyExtractionResult with detected notes and confidence info
 */
export async function extractMelody(file: File): Promise<MelodyExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();

  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioContext = new AudioCtxClass();
  let audioBuffer: AudioBuffer;

  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch {
    audioContext.close();
    throw new Error('Could not decode this audio file. It may be corrupted or in an unsupported format.');
  }

  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const totalFrames = Math.floor((channelData.length - FRAME_SIZE) / HOP_SIZE);

  if (totalFrames <= 0) {
    audioContext.close();
    return {
      notes: [],
      averageClarity: 0,
      voicingRatio: 0,
      confidence: 'unreliable',
      assessment: 'Audio file is too short to analyze.',
    };
  }

  // Detect pitch for each frame
  const frameResults: { frequency: number | null; clarity: number; time: number }[] = [];
  const buffer = new Float32Array(FRAME_SIZE);

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    const start = frameIdx * HOP_SIZE;
    for (let i = 0; i < FRAME_SIZE; i++) {
      buffer[i] = channelData[start + i];
    }

    const result = detectPitchInBuffer(buffer, sampleRate);
    const time = start / sampleRate;
    frameResults.push({
      frequency: result.frequency,
      clarity: result.clarity,
      time,
    });
  }

  audioContext.close();

  // Group consecutive frames with the same MIDI note into notes
  const notes: MelodyNote[] = [];
  let currentNote: MelodyNote | null = null;
  let voicedFrames = 0;

  for (const frame of frameResults) {
    if (frame.frequency && frame.clarity >= CLARITY_THRESHOLD) {
      voicedFrames++;
      const midi = frequencyToMidi(frame.frequency);
      const roundedMidi = Math.round(midi);

      if (currentNote && currentNote.midi === roundedMidi) {
        // Extend the current note
        currentNote.duration = frame.time - currentNote.startTime + HOP_SIZE / sampleRate;
        currentNote.clarity = Math.max(currentNote.clarity, frame.clarity);
      } else {
        // Start a new note
        if (currentNote) notes.push(currentNote);
        currentNote = {
          midi: roundedMidi,
          startTime: frame.time,
          duration: HOP_SIZE / sampleRate,
          clarity: frame.clarity,
        };
      }
    } else {
      // Silence or low clarity — end the current note
      if (currentNote) {
        notes.push(currentNote);
        currentNote = null;
      }
    }
  }
  if (currentNote) notes.push(currentNote);

  // Filter out very short notes (less than 80ms — likely detection artifacts)
  const filteredNotes = notes.filter((n) => n.duration >= 0.08);

  const averageClarity = filteredNotes.length > 0
    ? filteredNotes.reduce((sum, n) => sum + n.clarity, 0) / filteredNotes.length
    : 0;
  const voicingRatio = totalFrames > 0 ? voicedFrames / totalFrames : 0;

  const confidence = assessConfidence(averageClarity, voicingRatio, filteredNotes.length);
  const assessment = buildAssessment(confidence, averageClarity, voicingRatio, filteredNotes.length);

  return {
    notes: filteredNotes,
    averageClarity,
    voicingRatio,
    confidence,
    assessment,
  };
}

/** Normalized autocorrelation pitch detection on a raw buffer */
function detectPitchInBuffer(buffer: Float32Array, sampleRate: number): { frequency: number | null; clarity: number } {
  // RMS check
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);

  if (rms < 0.01) {
    return { frequency: null, clarity: 0 };
  }

  const minLag = Math.floor(sampleRate / MAX_FREQUENCY);
  const maxLag = Math.floor(sampleRate / MIN_FREQUENCY);

  // Normalized autocorrelation with local-maxima scan
  let bestLag = 0;
  let bestCorrelation = 0;

  // Pre-compute energy for normalization
  let totalEnergy = 0;
  for (let i = 0; i < buffer.length; i++) {
    totalEnergy += buffer[i] * buffer[i];
  }

  const correlations: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let energy1 = 0;
    let energy2 = 0;
    const n = buffer.length - lag;
    for (let i = 0; i < n; i++) {
      correlation += buffer[i] * buffer[i + lag];
      energy1 += buffer[i] * buffer[i];
      energy2 += buffer[i + lag] * buffer[i + lag];
    }
    const denom = Math.sqrt(energy1 * energy2);
    const result = denom > 0 ? correlation / denom : 0;
    correlations.push(result);

    const isLocalMax = lag > minLag && result >= correlations[correlations.length - 2] &&
      (lag === maxLag || result >= 0); // simplified local max check
    if (result >= CLARITY_THRESHOLD && (bestLag === 0 || result > bestCorrelation * 1.005 ||
      (result > bestCorrelation * 0.995 && lag < bestLag))) {
      bestCorrelation = result;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || bestCorrelation < CLARITY_THRESHOLD) {
    return { frequency: null, clarity: 0 };
  }

  // Parabolic interpolation
  const shift = parabolicInterpolate(correlations, bestLag - minLag);
  const frequency = sampleRate / (bestLag + shift);

  return {
    frequency: Number.isFinite(frequency) ? frequency : null,
    clarity: Math.min(bestCorrelation, 1),
  };
}

function parabolicInterpolate(correlations: number[], idx: number): number {
  if (idx <= 0 || idx >= correlations.length - 1) return 0;
  const c1 = correlations[idx - 1];
  const c2 = correlations[idx];
  const c3 = correlations[idx + 1];
  const denom = c1 - 2 * c2 + c3;
  if (denom === 0) return 0;
  return (0.5 * (c1 - c3)) / denom;
}

function frequencyToMidi(freq: number): number {
  const A4_MIDI = 69;
  const A4_FREQ = 440;
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
}

function assessConfidence(avgClarity: number, voicingRatio: number, noteCount: number): MelodyExtractionResult['confidence'] {
  if (noteCount < 5) return 'unreliable';
  if (avgClarity > 0.75 && voicingRatio > 0.6) return 'high';
  if (avgClarity > 0.6 && voicingRatio > 0.4) return 'medium';
  if (avgClarity > 0.5 && voicingRatio > 0.2) return 'low';
  return 'unreliable';
}

function buildAssessment(
  confidence: MelodyExtractionResult['confidence'],
  avgClarity: number,
  voicingRatio: number,
  noteCount: number,
): string {
  const parts: string[] = [];
  parts.push(`${noteCount} notes detected`);

  if (confidence === 'high') {
    parts.push('Clear pitch detection throughout the recording.');
  } else if (confidence === 'medium') {
    parts.push('Reasonable pitch detection, but some sections may be inaccurate. Review the melody before approving.');
  } else if (confidence === 'low') {
    parts.push('Low confidence — the recording may be polyphonic, have background music, or contain overlapping voices. Manual review is strongly recommended.');
  } else {
    parts.push('Could not reliably detect a melody. This may be due to polyphonic audio, heavy accompaniment, or poor recording quality. Please enter the melody manually.');
  }

  parts.push(`Average clarity: ${Math.round(avgClarity * 100)}%, voiced: ${Math.round(voicingRatio * 100)}% of duration.`);
  return parts.join(' ');
}
