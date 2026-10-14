/**
 * Free Sing — pressure-free creative visualizer.
 * Warm notebook styling: canvas with warm color palette.
 *
 * SECURITY: Uses the shared useAudioInput hook. Canvas drawing is purely
 * client-side. No audio data is stored or transmitted.
 */

import { useEffect, useRef } from 'react';
import { Palette, MicOff, Trash2 } from 'lucide-react';
import { useAudioInput } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';

const MIN_HZ = 80;
const MAX_HZ = 1000;

function freqToColor(hz: number): string {
  const ratio = Math.min(1, Math.max(0, (Math.log2(hz / MIN_HZ)) / (Math.log2(MAX_HZ / MIN_HZ))));
  // Warm palette: sage (120°) → mustard (45°) → terracotta (15°)
  // Interpolate from green through gold to warm red
  const hue = 120 - ratio * 105; // 120 (sage green) → 15 (terracotta red)
  const sat = 55 + ratio * 15;   // increase saturation toward warmer tones
  return `hsl(${hue}, ${sat}%, 55%)`;
}

function freqToY(hz: number, height: number): number {
  const ratio = Math.min(1, Math.max(0, (Math.log2(hz / MIN_HZ)) / (Math.log2(MAX_HZ / MIN_HZ))));
  return height * (1 - ratio);
}

export function FreeSing() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawXRef = useRef(0);

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    if (metrics.frequency && metrics.clarity > 0.3) {
      const y = freqToY(metrics.frequency, canvas.height);
      const color = freqToColor(metrics.frequency);

      if (lastPointRef.current === null || drawXRef.current >= canvas.width) {
        if (drawXRef.current >= canvas.width) {
          ctx.fillStyle = 'rgba(250, 250, 247, 0.12)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          drawXRef.current = 0;
        }
        lastPointRef.current = { x: drawXRef.current, y };
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(drawXRef.current + 2, y);
      ctx.stroke();

      lastPointRef.current = { x: drawXRef.current + 2, y };
      drawXRef.current += 2;
    } else {
      lastPointRef.current = null;
    }
  }, [metrics, isActive]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawXRef.current = 0;
    lastPointRef.current = null;
  };

  const handleStop = () => { handleClear(); stop(); };

  return (
    <div className="card flex flex-col items-center gap-4 p-6">
      <div className="flex items-center gap-3">
        <Palette className="h-5 w-5 text-sage-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Free Sing</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Sing freely and watch your voice paint on the canvas. No scores — just art.
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <>
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-cream-50 border border-cream-400 shadow-paper-sm">
            <canvas ref={canvasRef} className="h-64 w-full" />
            {metrics.noteLabel && (
              <div className="absolute right-3 top-3 rounded-xl bg-cream-200 border border-cream-400 px-3 py-1.5 text-sm font-medium text-charcoal">
                {metrics.noteLabel}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleClear} className="btn-secondary">
              <Trash2 className="h-4 w-4" /> Clear Canvas
            </button>
            <button onClick={handleStop} className="btn-terracotta">
              <MicOff className="h-4 w-4" /> Stop
            </button>
          </div>
        </>
      )}
    </div>
  );
}
