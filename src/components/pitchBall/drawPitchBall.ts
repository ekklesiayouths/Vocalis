import { BALL_RADIUS, BALL_X, type Gate } from '@/lib/pitchBall';

export interface SceneState {
  ballY: number;
  gates: Gate[];
  scroll: number;
  flash: { kind: 'pass' | 'hit'; age: number } | null;
  showTarget: { y: number; label: string } | null;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
}

const CLOUDS: Cloud[] = [
  { x: 0.1, y: 0.16, w: 0.16 },
  { x: 0.46, y: 0.1, w: 0.2 },
  { x: 0.78, y: 0.2, w: 0.14 },
  { x: 0.28, y: 0.3, w: 0.1 },
];

const HORIZON = 0.7;

export function fitCanvas(canvas: HTMLCanvasElement): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  return { width, height };
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * HORIZON);
  sky.addColorStop(0, '#7fb8d8');
  sky.addColorStop(0.6, '#bfe0ec');
  sky.addColorStop(1, '#f6ecd6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255, 246, 214, 0.9)';
  ctx.beginPath();
  ctx.arc(w * 0.84, h * 0.14, h * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (const c of CLOUDS) {
    const x = ((c.x - scroll * 0.05) % 1 + 1) % 1;
    const cx = x * w;
    const cy = c.y * h;
    const rw = c.w * w;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw / 2, rw / 6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - rw * 0.2, cy + rw / 12, rw / 4, rw / 8, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + rw * 0.22, cy + rw / 14, rw / 3.5, rw / 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number) {
  const horizonY = h * HORIZON;
  const vanishX = w * 0.5;
  ctx.fillStyle = '#8fb873';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(vanishX - w * 0.04, horizonY);
  ctx.lineTo(vanishX + w * 0.04, horizonY);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 250, 235, 0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const t = ((i / 8 + scroll * 0.6) % 1 + 1) % 1;
    const depth = t * t;
    const y = horizonY + (h - horizonY) * depth;
    const half = (w * 0.04) + (w * 0.46) * depth;
    ctx.beginPath();
    ctx.moveTo(vanishX - half * 0.02, y);
    ctx.lineTo(vanishX + half * 0.02, y);
    ctx.stroke();
  }
}

function drawGate(ctx: CanvasRenderingContext2D, w: number, h: number, gate: Gate) {
  const depth = Math.min(1, Math.max(0, (gate.x - BALL_X) / (1 - BALL_X)));
  const scale = 1 - 0.45 * depth;
  const gx = gate.x * w;
  const postW = Math.max(6, w * 0.018 * scale);
  const gapTop = (gate.gapY - gate.gapH / 2) * h;
  const gapBottom = (gate.gapY + gate.gapH / 2) * h;
  const beamColor = gate.resolved ? (gate.passed ? '#7aa872' : '#c0664f') : '#b98a57';
  const woodDark = '#7a5530';

  ctx.fillStyle = woodDark;
  ctx.fillRect(gx - postW / 2, gapTop - h * 0.03 * scale, postW, h * 0.01);
  ctx.fillStyle = beamColor;
  ctx.fillRect(gx - w * 0.04 * scale, 0, w * 0.08 * scale, gapTop);
  ctx.fillRect(gx - w * 0.04 * scale, gapBottom, w * 0.08 * scale, h - gapBottom);

  ctx.strokeStyle = 'rgba(70, 45, 20, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const px = gx - w * 0.04 * scale + (w * 0.08 * scale * i) / 4;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, gapTop);
    ctx.moveTo(px, gapBottom);
    ctx.lineTo(px, h);
    ctx.stroke();
  }

  if (gate.noteLabel) {
    const labelY = Math.max(24, gapTop - 20 * scale);
    ctx.font = `600 ${Math.round(16 * scale + 6)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(gx - 34 * scale - 6, labelY - 18 * scale, 68 * scale + 12, 26 * scale + 6);
    ctx.fillStyle = '#3b2a18';
    ctx.fillText(gate.noteLabel, gx, labelY);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, w: number, h: number, ballY: number) {
  const r = BALL_RADIUS * h;
  const cx = BALL_X * w;
  const cy = ballY * h;

  ctx.fillStyle = 'rgba(40, 60, 30, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, h * HORIZON + (h - h * HORIZON) * 0.25, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  grad.addColorStop(0, '#ffc27a');
  grad.addColorStop(0.6, '#ef8a2e');
  grad.addColorStop(1, '#b85a14');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTarget(ctx: CanvasRenderingContext2D, w: number, h: number, target: { y: number; label: string }) {
  const y = target.y * h;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(40, 80, 60, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2f5a3e';
  ctx.fillText(target.label, 12, y - 8);
}

function drawFlash(ctx: CanvasRenderingContext2D, w: number, h: number, flash: NonNullable<SceneState['flash']>) {
  const alpha = Math.max(0, 0.35 - flash.age * 0.5);
  ctx.fillStyle = flash.kind === 'pass' ? `rgba(122, 168, 114, ${alpha})` : `rgba(192, 102, 79, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

export function drawPitchBall(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneState) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSky(ctx, w, h);
  drawClouds(ctx, w, h, scene.scroll);
  drawRoad(ctx, w, h, scene.scroll);
  for (const gate of scene.gates) {
    if (gate.x > -0.2 && gate.x < 1.2) drawGate(ctx, w, h, gate);
  }
  if (scene.showTarget) drawTarget(ctx, w, h, scene.showTarget);
  drawBall(ctx, w, h, scene.ballY);
  if (scene.flash) drawFlash(ctx, w, h, scene.flash);
}
