/**
 * Playground — pressure-free games hub.
 * Now with Pitch Flyer and Harmony Echo replacing old placeholders.
 */

import { useState } from 'react';
import { Bird, AudioLines, ChevronLeft, Music } from 'lucide-react';
import { PitchFlyer } from '@/components/playground/PitchFlyer';
import { HarmonyEcho } from '@/components/playground/HarmonyEcho';
import { PitchQuest } from '@/components/playground/PitchQuest';

type GameId = 'pitch-flyer' | 'harmony-echo' | 'pitch-quest' | null;

interface GameCard {
  id: GameId;
  label: string;
  description: string;
  icon: typeof Bird;
  color: string;
  bg: string;
}

const GAMES: GameCard[] = [
  { id: 'pitch-quest', label: 'Pitch Quest', description: 'Sing Do-Re-Mi-Fa-Sol to guide your character through five musical gates!', icon: Music, color: 'text-sage-deep', bg: 'bg-sage-light' },
  { id: 'pitch-flyer', label: 'Pitch Flyer', description: 'Sing higher to fly up, lower to dive. Guide your bird through the gaps!', icon: Bird, color: 'text-terracotta-deep', bg: 'bg-terracotta-light' },
  { id: 'harmony-echo', label: 'Harmony Echo', description: 'Sing a phrase back and hear yourself with a harmony layer added on top!', icon: AudioLines, color: 'text-mustard-deep', bg: 'bg-mustard-light' },
];

export function Playground() {
  const [activeGame, setActiveGame] = useState<GameId>(null);

  if (activeGame) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <button
          onClick={() => setActiveGame(null)}
          className="flex items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal w-fit"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Playground
        </button>
        {activeGame === 'pitch-flyer' && <PitchFlyer />}
        {activeGame === 'harmony-echo' && <HarmonyEcho />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-charcoal">The Playground</h2>
        <p className="mt-1 text-sm text-charcoal-muted">No scores. No pressure. Just play with your voice!</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <button
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className="card-dashed-hover group flex flex-col gap-3 p-6 text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${game.bg} transition-transform group-hover:scale-110`}>
                  <Icon className={`h-5 w-5 ${game.color}`} />
                </div>
                <h3 className="font-semibold text-charcoal">{game.label}</h3>
              </div>
              <p className="text-sm text-charcoal-muted">{game.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
