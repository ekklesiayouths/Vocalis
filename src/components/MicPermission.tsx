/**
 * MicPermission — shared UI for requesting microphone access.
 * Warm, cozy styling matching the whimsical notebook theme.
 *
 * AUDIO LIFECYCLE:
 * - Shows a tactile "Wake Up Microphone" button before mic is active.
 * - When the stream is active and receiving audio, shows a soft pulsing
 *   sage-green "Listening..." circle.
 * - When the stream is active but no audio is being received (silent),
 *   shows a gentle toast: "Checking for sound... Please hum or adjust microphone settings!"
 *
 * SECURITY: The start callback must be triggered by a user tap (this button).
 * No audio data is stored or transmitted.
 */

import { Mic, MicOff } from 'lucide-react';
import type { MicPermissionState } from '@/hooks/useAudioInput';

interface MicPermissionProps {
  permission: MicPermissionState;
  errorMessage: string | null;
  onStart: () => void;
  /** True when mic is active AND receiving non-silent audio */
  isReceiving?: boolean;
  /** True when mic is active (stream open) */
  isActive?: boolean;
}

export function MicPermission({ permission, errorMessage, onStart, isReceiving, isActive }: MicPermissionProps) {
  const micActive = isActive ?? (permission === 'granted');
  const receiving = isReceiving ?? false;

  // Before mic is active — show the tactile "Wake Up Microphone" button
  if (permission !== 'requesting' && !micActive) {
    return (
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onStart}
          className="group flex flex-col items-center gap-3 transition-all active:translate-y-0.5"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sage-DEFAULT shadow-paper transition-all group-hover:bg-sage-dark group-hover:shadow-paper-lg group-active:shadow-paper-sm">
            <Mic className="h-8 w-8 text-cream-50 transition-transform group-hover:scale-110" />
          </div>
          <span className="font-hand text-lg text-charcoal">Wake Up Microphone</span>
        </button>

        {permission === 'denied' && (
          <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep text-center max-w-xs">
            Microphone access was denied. Please allow it in your browser settings and try again.
          </div>
        )}

        {permission === 'error' && errorMessage && (
          <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep text-center max-w-xs">
            {errorMessage}
          </div>
        )}

        <p className="text-xs text-charcoal-muted text-center max-w-xs">
          Your audio never leaves your device. No microphone data is stored or transmitted.
        </p>
      </div>
    );
  }

  // Requesting permission — show a gentle loading state
  if (permission === 'requesting') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-200 border-2 border-cream-400 shadow-paper-sm">
          <Mic className="h-8 w-8 text-charcoal-muted animate-pulse" />
        </div>
        <span className="font-hand text-lg text-charcoal-muted">Asking for permission...</span>
      </div>
    );
  }

  // Mic is active and receiving audio — show the pulsing sage-green "Listening" circle
  if (micActive && receiving) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-20 w-20 items-center justify-center">
          {/* Outer pulse ring */}
          <div className="absolute inset-0 rounded-full bg-sage-DEFAULT/30 animate-ping" />
          {/* Inner solid circle */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-sage-DEFAULT shadow-paper-sage">
            <Mic className="h-7 w-7 text-cream-50" />
          </div>
        </div>
        <span className="font-hand text-lg text-sage-deep">Listening...</span>
      </div>
    );
  }

  // Mic is active but NOT receiving audio — show silence toast
  if (micActive && !receiving) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-200 border-2 border-cream-400 shadow-paper-sm">
          <MicOff className="h-8 w-8 text-charcoal-muted" />
        </div>
        <div className="rounded-xl bg-mustard-light border border-mustard-DEFAULT px-4 py-3 text-sm text-mustard-deep text-center max-w-xs animate-fade-in">
          Checking for sound... Please hum or adjust microphone settings!
        </div>
      </div>
    );
  }

  return null;
}
