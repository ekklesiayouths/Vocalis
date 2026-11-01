import type { ComponentType } from 'react';
import { Activity, TrendingUp, Waves, Wind, type LucideIcon } from 'lucide-react';
import { BreathTracker } from '@/components/warmups/BreathTracker';
import { ResonanceTracker } from '@/components/warmups/ResonanceTracker';
import { SirenSlider } from '@/components/warmups/SirenSlider';
import { PitchTracker } from '@/components/warmups/PitchTracker';
import type { ExerciseCategory } from '@/lib/warmupCatalog';

export interface TrackerEntry {
  title: string;
  description: string;
  Component: ComponentType;
}

export interface WarmUpCategory {
  id: ExerciseCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  tracker: TrackerEntry;
}

export const WARMUP_CATEGORIES: WarmUpCategory[] = [
  {
    id: 'breath',
    label: 'Breath',
    description: 'Breath pacing and straw phonation for steady air',
    icon: Wind,
    color: 'text-sage-deep',
    bg: 'bg-sage-light',
    tracker: {
      title: 'Breath Support Check',
      description: 'Straw phonation & hiss test for breath control',
      Component: BreathTracker,
    },
  },
  {
    id: 'resonance',
    label: 'Resonance',
    description: 'Humming, lip trills, and vowels for a free, forward sound',
    icon: Waves,
    color: 'text-terracotta-deep',
    bg: 'bg-terracotta-light',
    tracker: {
      title: 'Resonance Trill',
      description: 'Lip trill & humming with fluid wave guidance',
      Component: ResonanceTracker,
    },
  },
  {
    id: 'agility',
    label: 'Agility',
    description: 'Arpeggios, glides, and clear diction for flexibility',
    icon: TrendingUp,
    color: 'text-mustard-deep',
    bg: 'bg-mustard-light',
    tracker: {
      title: 'Siren Slider',
      description: 'Siren slider across octaves for vocal flexibility',
      Component: SirenSlider,
    },
  },
  {
    id: 'pitch',
    label: 'Pitch',
    description: 'Scales and note matching with in-tune feedback',
    icon: Activity,
    color: 'text-charcoal',
    bg: 'bg-cream-300',
    tracker: {
      title: 'Pitch Tracker',
      description: 'Real-time pitch detection with sharp/flat feedback',
      Component: PitchTracker,
    },
  },
];

export function getWarmUpCategory(id: ExerciseCategory): WarmUpCategory {
  const category = WARMUP_CATEGORIES.find((entry) => entry.id === id);
  if (!category) throw new Error(`Unknown warm-up category: ${id}`);
  return category;
}
