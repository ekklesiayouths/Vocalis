/**
 * Real-time pitch detector using normalized autocorrelation with octave
 * error correction.
 *
 * ALGORITHM:
 * - Normalized autocorrelation: divides by sqrt(Σx[i]² · Σx[i+lag]²) so the
 *   correlation is a true periodicity measure in [−1, 1], independent of
 *   signal amplitude. This makes the clarity threshold meaningful.
 * - Full-range local-maxima scan: evaluates all lags, identifies local
 *   maxima (peaks where correlation is higher than both neighbors), and
 *   picks the one with the highest normalized correlation.
 * - Parabolic interpolation for sub-sample lag accuracy.
 *
 * SECURITY NOTES:
 * - Uses ONLY native browser APIs (AudioContext, AnalyserNode, getUserMedia).
 *   No third-party npm packages — zero supply-chain risk.
 * - Audio data is processed entirely in the browser. Raw microphone data is
 *   never transmitted, stored, or logged. The AnalyserNode reads time-domain
 *   data into a local Float32Array that is garbage-collected after each frame.
 * - The only data exposed to the application is the detected fundamental
 *   frequency (Hz) — a single number, not raw audio.
 *
 * AUDIO CONTEXT LIFECYCLE:
 * - Before ANY initialization, resetExistingAudioTracks() tears down hanging
 *   streams/contexts from previous components to prevent hardware contention.
 * - The active stream and context are stored on window.vocalisStream and
 *   window.vocalisContext as single-instance globals — no duplicates can
 *   run in parallel during React state changes.
 * - detectPitch() checks for suspended context and resumes it inside the
 *   RAF loop. If the buffer reads flat zeros for >1.5s while the stream is
 *   active, it re-binds the media stream source to the analyser.
 * - stop() cleans up ALL global references so the next component starts fresh.
 */

export interface PitchDetectorOptions {
  fftSize?: number;
  minFrequency?: number;
  maxFrequency?: number;
  /** Optional callback fired when flat-zero buffer is detected (hardware rebind). */
  onHardwareWarning?: () => void;
}

export interface PitchDetectionResult {
  frequency: number | null;
  clarity: number;
  rms: number;
}

const DEFAULT_OPTIONS: Required<Omit<PitchDetectorOptions, 'onHardwareWarning'>> = {
  fftSize: 2048,
  minFrequency: 70,
  maxFrequency: 1200,
};

/** Time threshold (in frames) for flat-zero detection before re-binding. */
const FLAT_ZERO_FRAME_THRESHOLD = 90; // ~1.5s at 60fps

/** Minimum normalized correlation to accept a pitch candidate. */
const CLARITY_THRESHOLD = 0.5;



/**
 * Global teardown — wipes out any existing hanging audio hooks or active
 * streams from previous components. MUST be called before any new
 * getUserMedia initialization to prevent hardware contention.
 */
function resetExistingAudioTracks(): void {
  const w = window as unknown as {
    vocalisStream?: MediaStream | null;
    vocalisContext?: AudioContext | null;
  };

  if (w.vocalisStream) {
    try {
      w.vocalisStream.getTracks().forEach((track) => track.stop());
    } catch { /* already stopped */ }
    w.vocalisStream = null;
  }

  if (w.vocalisContext && w.vocalisContext.state !== 'closed') {
    try {
      w.vocalisContext.close();
    } catch { /* already closed */ }
    w.vocalisContext = null;
  }
}

export class PitchDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private timeDomainData: Float32Array | null = null;
  private options: Required<Omit<PitchDetectorOptions, 'onHardwareWarning'>>;
  private onHardwareWarning: (() => void) | undefined;
  private running = false;
  private flatZeroFrameCount = 0;
  /** ScriptProcessor fallback pump — keeps audio data flowing even if
   * the AnalyserNode loses its source binding during view switches. */
  private scriptProcessor: ScriptProcessorNode | null = null;
  private silentGainRef: GainNode | null = null;
  /** Cache of recent correlation values to avoid redundant recomputation
   *  in parabolicInterpolate. */
  private corrCache: Map<number, number> = new Map();

  constructor(options: PitchDetectorOptions = {}) {
    const { onHardwareWarning, ...rest } = options;
    this.options = { ...DEFAULT_OPTIONS, ...rest };
    this.onHardwareWarning = onHardwareWarning;
  }

  /**
   * Request microphone access and set up the Web Audio pipeline.
   * MUST be called from a user interaction event (button tap).
   * Tears down any existing global audio resources first.
   */
  async start(): Promise<void> {
    if (this.running) return;

    // Force global cleanup before any new initialization
    resetExistingAudioTracks();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Microphone access is not supported in this browser. Please use a modern browser over HTTPS.'
      );
    }

    // 1. Request audio-only — no video, no screen capture
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    // Store stream on global to prevent duplicate instances
    (window as unknown as { vocalisStream: MediaStream }).vocalisStream = this.mediaStream;

    // 2. Create AudioContext (must be inside user gesture)
    const AudioCtxClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }
    this.audioContext = new AudioCtxClass();

    // Store context on global
    (window as unknown as { vocalisContext: AudioContext }).vocalisContext = this.audioContext;

    // 3. Explicit resume — browsers suspend the context until a user gesture
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // 4. Create analyser node
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.options.fftSize;
    this.analyser.smoothingTimeConstant = 0;

    // 5. Create source node from the mic stream and connect to analyser
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.analyser);

    this.timeDomainData = new Float32Array(this.analyser.fftSize);
    this.flatZeroFrameCount = 0;
    this.running = true;

    // 6. ScriptProcessor fallback pump — keeps the audio graph active
    // even if the AnalyserNode loses its source binding during view switches.
    try {
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.silentGainRef = this.audioContext.createGain();
      this.silentGainRef.gain.value = 0;
      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.silentGainRef);
      this.silentGainRef.connect(this.audioContext.destination);
      this.scriptProcessor.onaudioprocess = () => { /* pump — no-op */ };
    } catch {
      this.scriptProcessor = null;
      this.silentGainRef = null;
    }
  }

  /**
   * Compute normalized autocorrelation for a given lag.
   * Returns a value in [−1, 1] that is independent of signal amplitude.
   * Uses the cache to avoid redundant recomputation.
   */
  private normalizedCorr(buffer: Float32Array, lag: number): number {
  const cached = this.corrCache.get(lag);
  if (cached !== undefined) return cached;

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
    this.corrCache.set(lag, result);
    return result;
  }

  /**
   * Detect the fundamental frequency using normalized autocorrelation
   * with octave error correction.
   * Call this from a requestAnimationFrame loop.
   * Also returns the raw RMS amplitude so callers can detect silence.
   */
  detectPitch(): PitchDetectionResult {
    if (!this.running || !this.analyser || !this.timeDomainData || !this.audioContext) {
      return { frequency: null, clarity: 0, rms: 0 };
    }

    // Forced runtime resume check
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => { /* ignore resume errors */ });
    }

    this.analyser.getFloatTimeDomainData(this.timeDomainData);
    const buffer = this.timeDomainData;
    const sampleRate = this.audioContext.sampleRate;

    // RMS check — compute true signal level
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);

    // Flat-zero detection: if buffer is all zeros while stream is active
    if (rms === 0) {
      this.flatZeroFrameCount++;
      if (this.flatZeroFrameCount > FLAT_ZERO_FRAME_THRESHOLD) {
        this.rebindSourceNode();
        this.flatZeroFrameCount = 0;
        this.onHardwareWarning?.();
      }
    } else {
      this.flatZeroFrameCount = 0;
    }

    // If the signal is essentially silent, return null pitch
    if (rms < 0.01) {
      return { frequency: null, clarity: 0, rms };
    }

    const minLag = Math.floor(sampleRate / this.options.maxFrequency);
    const maxLag = Math.floor(sampleRate / this.options.minFrequency);

    // Clear the correlation cache for this frame
    this.corrCache.clear();

    // Scan all lags for local maxima above the clarity threshold.
    // A local maximum is a lag where correlation is higher than both
    // adjacent lags. Among all qualifying peaks, pick the one with the
    // highest normalized correlation. When correlations are nearly equal
    // (within 0.5%), prefer the shorter lag — for a pure periodic signal,
    // all integer multiples of the period produce correlation ≈ 1.0, so
    // the shortest peak corresponds to the true fundamental frequency.
    let bestLag = 0;
    let bestCorrelation = 0;

    let prevCorr = 0;
    let currCorr = this.normalizedCorr(buffer, minLag);
    let nextCorr = minLag + 1 <= maxLag ? this.normalizedCorr(buffer, minLag + 1) : 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      const isLocalMax = currCorr >= prevCorr && currCorr > nextCorr;
      if (isLocalMax && currCorr >= CLARITY_THRESHOLD) {
        if (bestLag === 0 ||
            currCorr > bestCorrelation * 1.005 ||
            (currCorr > bestCorrelation * 0.995 && lag < bestLag)) {
          bestCorrelation = currCorr;
          bestLag = lag;
        }
      }
      prevCorr = currCorr;
      currCorr = nextCorr;
      nextCorr = lag + 2 <= maxLag ? this.normalizedCorr(buffer, lag + 2) : 0;
    }

    // Reject if no significant peak was found
    if (bestLag === 0 || bestCorrelation < CLARITY_THRESHOLD) {
      return { frequency: null, clarity: 0, rms };
    }

    // Parabolic interpolation for sub-sample accuracy
    const shift = this.parabolicInterpolate(buffer, bestLag, maxLag);
    const frequency = sampleRate / (bestLag + shift);

    return {
      frequency: Number.isFinite(frequency) ? frequency : null,
      clarity: Math.min(bestCorrelation, 1),
      rms,
    };
  }

  /**
   * Re-bind the media stream source to the analyser node.
   * Used when the buffer reads flat zeros despite an active stream.
   */
  private rebindSourceNode(): void {
    if (!this.audioContext || !this.mediaStream || !this.analyser) return;

    // Disconnect existing source
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* already disconnected */ }
      this.sourceNode = null;
    }

    // Disconnect old silent gain to prevent accumulation
    if (this.silentGainRef) {
      try { this.silentGainRef.disconnect(); } catch { /* ignore */ }
      this.silentGainRef = null;
    }

    // Create a fresh source node from the existing stream
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.analyser);

    // Reconnect the script processor pump to the new source
    if (this.scriptProcessor) {
      try { this.scriptProcessor.disconnect(); } catch { /* ignore */ }
      this.sourceNode.connect(this.scriptProcessor);
      this.silentGainRef = this.audioContext.createGain();
      this.silentGainRef.gain.value = 0;
      this.scriptProcessor.connect(this.silentGainRef);
      this.silentGainRef.connect(this.audioContext.destination);
    }
  }

  /**
   * Parabolic interpolation for sub-sample lag accuracy.
   * Uses the correlation cache to avoid redundant recomputation.
   */
  private parabolicInterpolate(buffer: Float32Array, lag: number, maxLag: number): number {
    if (lag <= 0 || lag >= maxLag) return 0;

    const c1 = this.normalizedCorr(buffer, lag - 1);
    const c2 = this.normalizedCorr(buffer, lag);
    const c3 = this.normalizedCorr(buffer, lag + 1);

    const denom = c1 - 2 * c2 + c3;
    if (denom === 0) return 0;
    return (0.5 * (c1 - c3)) / denom;
  }

  /**
   * Stop detection and release ALL audio resources.
   * Cleans up global window references so the next component starts fresh.
   */
  stop(): void {
    this.running = false;

    // Disconnect source from analyser
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* already disconnected */ }
      this.sourceNode = null;
    }

    // Disconnect script processor pump
    if (this.scriptProcessor) {
      try { this.scriptProcessor.disconnect(); } catch { /* already disconnected */ }
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }

    // Disconnect silent gain
    if (this.silentGainRef) {
      try { this.silentGainRef.disconnect(); } catch { /* ignore */ }
      this.silentGainRef = null;
    }

    // Disconnect analyser
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { /* already disconnected */ }
      this.analyser = null;
    }

    // Stop ALL media tracks — turns off the browser recording indicator
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Close the AudioContext — releases all audio hardware resources
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => { /* ignore close errors */ });
      this.audioContext = null;
    }

    // Clear global references
    const w = window as unknown as {
      vocalisStream?: MediaStream | null;
      vocalisContext?: AudioContext | null;
    };
    w.vocalisStream = null;
    w.vocalisContext = null;

    this.timeDomainData = null;
    this.flatZeroFrameCount = 0;
    this.corrCache.clear();
  }

  get isRunning(): boolean {
    return this.running;
  }
}
