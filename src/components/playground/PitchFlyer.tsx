/**
 * Pitch Flyer — interactive mini-game where mic pitch controls vertical height.
 *
 * The user sings higher to move up, lower to move down, navigating a
 * whimsical icon through gaps between obstacle bars that scroll left.
 * No scoring penalty — just playful fun!
 *
 * SECURITY: Uses useAudioInput (native Web Audio, no raw audio stored).
 * Canvas rendering is purely client-side. No data transmitted.
 */

import { useEffect, useRef, useState } from 'react';
import { Bird, Square } from 'lucide-react';
import { useAudioInput, type AudioMetrics } from '@/hooks/useAudioInput';
import { MicPermission } from '@/components/MicPermission';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 300;
const MIN_HZ = 180;
const MAX_HZ = 600;
const BIRD_X = 80;
const BIRD_SIZE = 24;
const OBSTACLE_WIDTH = 40;
const GAP_SIZE = 120;
const OBSTACLE_SPEED = 2;
const OBSTACLE_SPACING = 200;

function freqToY(hz: number): number {
  const logMin = Math.log2(MIN_HZ);
  const logMax = Math.log2(MAX_HZ);
  const logHz = Math.log2(Math.max(MIN_HZ, Math.min(MAX_HZ, hz)));
  const ratio = (logHz - logMin) / (logMax - logMin);
  return CANVAS_HEIGHT * (1 - ratio);
}

interface Obstacle {
  x: number;
  gapY: number;
  passed: boolean;
}

export function PitchFlyer() {
  const { permission, errorMessage, isActive, isReceiving, metrics, start, stop } = useAudioInput({
    minFrequency: 100,
    maxFrequency: 800,
  });

  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const birdYRef = useRef(CANVAS_HEIGHT / 2);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const scoreRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastObstacleXRef = useRef(CANVAS_WIDTH);
  const bestScoreRef = useRef(0);

  // Keep latest metrics in a ref so the game loop reads from it without
  // re-creating the loop on every metrics update (~60fps).
  const metricsRef = useRef<AudioMetrics>(metrics);
  metricsRef.current = metrics;

  const resetGame = () => {
    birdYRef.current = CANVAS_HEIGHT / 2;
    obstaclesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    lastObstacleXRef.current = CANVAS_WIDTH;
  };

  const startGame = () => {
    resetGame();
    setGameStarted(true);
  };

  // Game loop — depends only on gameStarted/gameOver, reads metrics from ref
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const loop = () => {
      const m = metricsRef.current;

      // Update bird Y from pitch
      if (m.frequency && m.clarity > 0.3) {
        const targetY = freqToY(m.frequency);
        birdYRef.current = birdYRef.current * 0.7 + targetY * 0.3;
      }

      // Move obstacles
      obstaclesRef.current.forEach((obs) => { obs.x -= OBSTACLE_SPEED; });

      // Remove off-screen obstacles
      obstaclesRef.current = obstaclesRef.current.filter((obs) => obs.x > -OBSTACLE_WIDTH);

      // Spawn new obstacles
      const lastObs = obstaclesRef.current[obstaclesRef.current.length - 1];
      if (!lastObs || lastObs.x < CANVAS_WIDTH - OBSTACLE_SPACING) {
        const gapY = 60 + Math.random() * (CANVAS_HEIGHT - GAP_SIZE - 120);
        obstaclesRef.current.push({ x: CANVAS_WIDTH, gapY, passed: false });
      }

      // Collision detection
      const birdY = birdYRef.current;
      for (const obs of obstaclesRef.current) {
        if (obs.x < BIRD_X + BIRD_SIZE && obs.x + OBSTACLE_WIDTH > BIRD_X - BIRD_SIZE) {
          if (birdY - BIRD_SIZE / 2 < obs.gapY || birdY + BIRD_SIZE / 2 > obs.gapY + GAP_SIZE) {
            setGameOver(true);
            if (scoreRef.current > bestScoreRef.current) {
              bestScoreRef.current = scoreRef.current;
              setBestScore(scoreRef.current);
            }
            return;
          }
        }
        // Score for passing
        if (!obs.passed && obs.x + OBSTACLE_WIDTH < BIRD_X - BIRD_SIZE) {
          obs.passed = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
        }
      }

      // Boundaries
      if (birdY < BIRD_SIZE / 2 || birdY > CANVAS_HEIGHT - BIRD_SIZE / 2) {
        setGameOver(true);
        if (scoreRef.current > bestScoreRef.current) {
          bestScoreRef.current = scoreRef.current;
          setBestScore(scoreRef.current);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameStarted, gameOver]);

  const handleStop = () => {
    stop();
    setGameStarted(false);
    setGameOver(false);
  };

  // Render from refs — re-rendered on every metrics update (intended for display)
  const obstacles = obstaclesRef.current;
  const birdY = birdYRef.current;

  return (
    <div className="card flex flex-col items-center gap-4 p-6">
      <div className="flex items-center gap-3">
        <Bird className="h-5 w-5 text-sage-deep" />
        <h3 className="text-lg font-semibold text-charcoal">Pitch Flyer</h3>
      </div>

      <p className="max-w-sm text-center text-sm text-charcoal-muted">
        Sing higher to fly up, lower to dive down. Guide your bird through the gaps!
      </p>

      {permission !== 'granted' && (
        <MicPermission permission={permission} errorMessage={errorMessage} onStart={start} isActive={isActive} isReceiving={isReceiving} />
      )}

      {permission === 'granted' && (
        <>
          {/* Game canvas */}
          <div className="relative overflow-hidden rounded-2xl bg-cream-50 border border-cream-400 shadow-paper-sm" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
            {/* Obstacles */}
            {obstacles.map((obs, i) => (
              <div key={i}>
                <div className="absolute bg-cream-300 border-2 border-cream-400 rounded-lg" style={{ left: obs.x, top: 0, width: OBSTACLE_WIDTH, height: obs.gapY }} />
                <div className="absolute bg-cream-300 border-2 border-cream-400 rounded-lg" style={{ left: obs.x, top: obs.gapY + GAP_SIZE, width: OBSTACLE_WIDTH, height: CANVAS_HEIGHT - obs.gapY - GAP_SIZE }} />
              </div>
            ))}

            {/* Bird */}
            <div
              className="absolute flex items-center justify-center transition-all duration-75"
              style={{
                left: BIRD_X - BIRD_SIZE / 2,
                top: birdY - BIRD_SIZE / 2,
                width: BIRD_SIZE,
                height: BIRD_SIZE,
              }}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-sage-DEFAULT border-2 border-sage-deep shadow-paper-sage">
                <Bird className="h-4 w-4 text-cream-50" />
              </div>
            </div>

            {/* Score overlay */}
            <div className="absolute top-2 right-3 text-2xl font-bold text-charcoal/40">{score}</div>

            {/* Game over overlay */}
            {gameOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream-50/80 backdrop-blur-sm animate-fade-in">
                <p className="text-2xl font-bold text-charcoal">Score: {score}</p>
                {bestScore > 0 && <p className="text-sm text-charcoal-muted">Best: {bestScore}</p>}
                <button onClick={startGame} className="btn-primary mt-3 max-w-[180px] w-full">
                  Play Again
                </button>
              </div>
            )}

            {/* Start overlay */}
            {!gameStarted && !gameOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream-50/80 backdrop-blur-sm">
                <p className="text-sm text-charcoal-muted mb-3">Sing to control your bird!</p>
                <button onClick={startGame} className="btn-primary max-w-[180px] w-full">
                  Start Flying
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <span className="text-charcoal-muted">Score: <span className="font-bold text-charcoal">{score}</span></span>
            <span className="text-charcoal-muted">Best: <span className="font-bold text-charcoal">{bestScore}</span></span>
            <span className="text-charcoal-muted">Note: <span className="font-bold text-charcoal">{metrics.noteLabel ?? '—'}</span></span>
          </div>

          <button onClick={handleStop} className="btn-terracotta max-w-xs w-full">
            <Square className="h-4 w-4" /> Stop
          </button>
        </>
      )}
    </div>
  );
}
