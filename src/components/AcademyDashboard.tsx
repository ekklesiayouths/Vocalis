/**
 * Academy Dashboard — comprehensive course catalog with diagnostic bar.
 * Warm notebook styling with dashed borders and paper-cutout shadows.
 *
 * SECURITY: Diagnostic input sanitized via sanitizeText(). All client-side.
 * Each module component handles its own score submission via submitScore RPC.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Ear, Wind, Zap, Users, Crown, Music,
  Search, ChevronLeft, Sparkles, CheckCircle2,
} from 'lucide-react';
import { sanitizeText } from '@/lib/validation';
import { CourseWrapper } from '@/components/CourseWrapper';
import { SongLearningLibrary } from '@/components/SongLearningLibrary';
import { IntervalRecognition } from '@/components/modules/IntervalRecognition';
import { FineTuningDrill } from '@/components/modules/FineTuningDrill';
import { ScaleDegrees } from '@/components/modules/ScaleDegrees';
import { BreathSupportTracker } from '@/components/modules/BreathSupportTracker';
import { RegisterBlending } from '@/components/modules/RegisterBlending';
import { DexterityDrills } from '@/components/modules/DexterityDrills';
import { ThirdFifthFinding } from '@/components/modules/ThirdFifthFinding';
import { VowelBlending } from '@/components/modules/VowelBlending';
import { ModulationMission } from '@/components/ModulationMission';
import { ACappellaKeyStarts } from '@/components/modules/ACappellaKeyStarts';

type ModuleId = 'modulation-mission' | 'intervals' | 'fine-tuning' | 'scale-degrees'
  | 'register-blending' | 'resonators' | 'breath-support'
  | 'dexterity-drills' | 'pentatonic-runs'
  | 'third-fifth-finding' | 'part-stability' | 'vowel-blending'
  | 'satb-arranging' | 'a-cappella-key-starts';

interface CatalogModule {
  id: ModuleId;
  name: string;
  description: string;
  difficulty: 'Beginner' | 'Foundation' | 'Singer' | 'Harmony' | 'Advanced';
  hasContent: boolean;
  keywords: string[];
}

interface CatalogCategory {
  id: string;
  label: string;
  icon: typeof Ear;
  color: string;
  bg: string;
  modules: CatalogModule[];
}

const CATEGORIES: CatalogCategory[] = [
  {
    id: 'pitch-ear', label: 'Pitch & Ear Precision', icon: Ear, color: 'text-sage-deep', bg: 'bg-sage-light',
    modules: [
      { id: 'intervals', name: 'Interval Recognition', description: 'Identify seconds, thirds, fifths, and octaves by ear.', difficulty: 'Beginner', hasContent: true, keywords: ['interval', 'ear', 'pitch', 'third', 'fifth', 'octave', 'second'] },
      { id: 'fine-tuning', name: 'Fine-Tuning Drill', description: 'Match pitches precisely with cent-level feedback.', difficulty: 'Foundation', hasContent: true, keywords: ['flat', 'sharp', 'tuning', 'tune', 'cents', 'pitch', 'off pitch'] },
      { id: 'scale-degrees', name: 'Scale Degrees', description: 'Hear a note and identify its place in the scale (1-7).', difficulty: 'Foundation', hasContent: true, keywords: ['scale', 'degree', 'do re mi', 'solfege'] },
    ],
  },
  {
    id: 'vocal-mechanics', label: 'Vocal Mechanics', icon: Wind, color: 'text-terracotta-deep', bg: 'bg-terracotta-light',
    modules: [
      { id: 'breath-support', name: 'Breath Support Tracker', description: 'Sustain a steady hiss and keep your airflow stable.', difficulty: 'Beginner', hasContent: true, keywords: ['breath', 'diaphragm', 'support', 'air', 'breathe', 'run out of air'] },
      { id: 'register-blending', name: 'Chest/Head/Mixed Blending', description: 'Sing a siren and watch your resonance zones light up.', difficulty: 'Singer', hasContent: true, keywords: ['chest', 'head', 'mixed', 'register', 'break', 'transition', 'voice break', 'resonance', 'resonator', 'buzz', 'mask', 'placement'] },
      { id: 'resonators', name: 'Resonators', description: 'Direct sound through chest, mask, and head resonance.', difficulty: 'Singer', hasContent: true, keywords: ['resonance', 'resonator', 'buzz', 'mask', 'placement'] },
    ],
  },
  {
    id: 'agility-runs', label: 'Agility & Runs', icon: Zap, color: 'text-mustard-deep', bg: 'bg-mustard-light',
    modules: [
      { id: 'dexterity-drills', name: 'Dexterity Drills', description: 'Sing back a rapid pentatonic run and hit each note.', difficulty: 'Singer', hasContent: true, keywords: ['agility', 'dexterity', 'fast', 'runs', 'quick', 'flexible'] },
      { id: 'pentatonic-runs', name: 'Pentatonic Scale Runs', description: 'Master the 5-note pentatonic across octaves.', difficulty: 'Harmony', hasContent: true, keywords: ['pentatonic', 'scale', 'run', 'five note'] },
    ],
  },
  {
    id: 'harmony-choral', label: 'Harmony & Choral Mastery', icon: Users, color: 'text-terracotta-deep', bg: 'bg-terracotta-light',
    modules: [
      { id: 'third-fifth-finding', name: '3rd/5th Finding', description: 'Sing harmony parts above and below a melody.', difficulty: 'Harmony', hasContent: true, keywords: ['harmony', 'third', 'fifth', 'part', 'above', 'below', 'harmonize', 'stability', 'hold', 'distracted', 'blend'] },
      { id: 'part-stability', name: 'Part Stability', description: 'Hold your line while others sing different parts.', difficulty: 'Harmony', hasContent: true, keywords: ['part', 'stability', 'hold', 'distracted', 'blend'] },
      { id: 'vowel-blending', name: 'Vowel Blending', description: 'Adjust vowel shapes to unify a chord.', difficulty: 'Harmony', hasContent: true, keywords: ['vowel', 'blend', 'unify', 'shape', 'section'] },
    ],
  },
  {
    id: 'director-suite', label: 'Music Director Suite', icon: Crown, color: 'text-mustard-deep', bg: 'bg-mustard-light',
    modules: [
      { id: 'modulation-mission', name: 'Modulation Missions', description: 'Identify key changes by ear — the flagship quiz.', difficulty: 'Advanced', hasContent: true, keywords: ['modulation', 'key change', 'key', 'modulate', 'transition'] },
      { id: 'satb-arranging', name: 'SATB Arranging', description: 'Practice giving SATB starting pitches on a virtual keyboard.', difficulty: 'Advanced', hasContent: true, keywords: ['satb', 'arrange', 'arranging', 'soprano', 'alto', 'tenor', 'bass', 'arrangement', 'keyboard', 'key start'] },
      { id: 'a-cappella-key-starts', name: 'A Cappella Key Starts', description: 'Give accurate starting pitches without instruments.', difficulty: 'Advanced', hasContent: true, keywords: ['a cappella', 'key start', 'starting pitch', 'pitch pipe', 'reference', 'drone'] },
    ],
  },
];

const ALL_MODULES = CATEGORIES.flatMap((cat) => cat.modules);

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-sage-light text-sage-deep border-sage-DEFAULT',
  Foundation: 'bg-cream-200 text-charcoal-light border-cream-400',
  Singer: 'bg-mustard-light text-mustard-deep border-mustard-DEFAULT',
  Harmony: 'bg-terracotta-light text-terracotta-deep border-terracotta-DEFAULT',
  Advanced: 'bg-cream-300 text-charcoal border-charcoal/20',
};

interface KeywordMatch {
  moduleId: ModuleId;
  matchedKeywords: string[];
}

function parseDiagnostic(input: string): KeywordMatch[] {
  const sanitized = sanitizeText(input, 300).toLowerCase();
  if (sanitized.length === 0) return [];
  const matches: KeywordMatch[] = [];
  for (const mod of ALL_MODULES) {
    const matched = mod.keywords.filter((kw) => sanitized.includes(kw));
    if (matched.length > 0) matches.push({ moduleId: mod.id, matchedKeywords: matched });
  }
  matches.sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length);
  return matches;
}

function renderModule(id: ModuleId) {
  switch (id) {
    case 'intervals': return <IntervalRecognition />;
    case 'fine-tuning': return <FineTuningDrill />;
    case 'scale-degrees': return <ScaleDegrees />;
    case 'breath-support': return <BreathSupportTracker />;
    case 'register-blending': return <RegisterBlending />;
    case 'resonators': return <RegisterBlending />;
    case 'dexterity-drills': return <DexterityDrills />;
    case 'pentatonic-runs': return <DexterityDrills />;
    case 'third-fifth-finding': return <ThirdFifthFinding />;
    case 'part-stability': return <ThirdFifthFinding />;
    case 'vowel-blending': return <VowelBlending />;
    case 'modulation-mission': return <ModulationMission />;
    case 'satb-arranging': return <ACappellaKeyStarts />;
    case 'a-cappella-key-starts': return <ACappellaKeyStarts />;
    default: return null;
  }
}

export function AcademyDashboard() {
  const [diagnosticInput, setDiagnosticInput] = useState('');
  const [diagnosticResults, setDiagnosticResults] = useState<KeywordMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'songs'>('catalog');

  const handleDiagnostic = useCallback(() => {
    setDiagnosticResults(parseDiagnostic(diagnosticInput));
    setHasSearched(true);
  }, [diagnosticInput]);

  const handleDiagnosticKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleDiagnostic(); }
  };

  const highlightedModuleIds = useMemo(
    () => new Set(diagnosticResults.map((m) => m.moduleId)),
    [diagnosticResults]
  );

  if (activeModule) {
    const mod = ALL_MODULES.find((m) => m.id === activeModule)!;
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <button
          onClick={() => setActiveModule(null)}
          className="flex items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal w-fit"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Catalog
        </button>
        <CourseWrapper
          moduleId={activeModule}
          moduleTitle={mod.name}
          onBack={() => setActiveModule(null)}
        >
          {renderModule(activeModule)}
        </CourseWrapper>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Tab selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'catalog' ? 'bg-sage-light text-sage-deep shadow-paper-sm' : 'text-charcoal-muted hover:bg-cream-200 hover:text-charcoal'
          }`}
        >
          <Ear className="h-4 w-4" /> Course Catalog
        </button>
        <button
          onClick={() => setActiveTab('songs')}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'songs' ? 'bg-sage-light text-sage-deep shadow-paper-sm' : 'text-charcoal-muted hover:bg-cream-200 hover:text-charcoal'
          }`}
        >
          <Music className="h-4 w-4" /> Song Learning Library
        </button>
      </div>

      {activeTab === 'songs' && <SongLearningLibrary />}

      {activeTab === 'catalog' && (
        <>
      {/* Diagnostic bar */}
      <div className="card p-5 staff-bg">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-mustard-DEFAULT" />
          <h3 className="font-semibold text-charcoal">What is your voice or choir struggling with today?</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={diagnosticInput}
            onChange={(e) => setDiagnosticInput(e.target.value)}
            onKeyDown={handleDiagnosticKeyDown}
            maxLength={300}
            placeholder="e.g. 'I keep singing flat on high notes' or 'struggling with harmony parts'"
            className="flex-1 rounded-xl bg-cream-50 border border-cream-400 px-4 py-3 text-sm text-charcoal placeholder-charcoal-muted/50 outline-none transition-all focus:border-sage-DEFAULT focus:bg-cream-50"
          />
          <button onClick={handleDiagnostic} disabled={diagnosticInput.trim().length === 0} className="btn-primary !px-4">
            <Search className="h-4 w-4" />
          </button>
        </div>

        {hasSearched && (
          <div className="mt-4 animate-fade-in">
            {diagnosticResults.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-charcoal-muted">Based on what you described, here are the modules I recommend:</p>
                <div className="flex flex-wrap gap-2">
                  {diagnosticResults.map((match) => {
                    const mod = ALL_MODULES.find((m) => m.id === match.moduleId)!;
                    return (
                      <button
                        key={match.moduleId}
                        onClick={() => setActiveModule(match.moduleId)}
                        className="flex items-center gap-2 rounded-xl bg-sage-light border border-sage-DEFAULT px-3 py-2 text-sm text-sage-deep transition-all hover:bg-sage-DEFAULT hover:text-cream-50 active:translate-y-0.5"
                      >
                        <CheckCircle2 className="h-4 w-4" /> {mod.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-charcoal-muted">
                I couldn't match that to a specific module. Try keywords like "flat", "high notes", "harmony", "breath", or "modulation".
              </p>
            )}
          </div>
        )}
      </div>

      {/* Course catalog */}
      {CATEGORIES.map((category) => {
        const Icon = category.icon;
        return (
          <div key={category.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${category.bg}`}>
                <Icon className={`h-4 w-4 ${category.color}`} />
              </div>
              <h3 className="font-semibold text-charcoal">{category.label}</h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.modules.map((mod) => {
                const isHighlighted = highlightedModuleIds.has(mod.id);
                return (
                  <button
                    key={mod.id}
                    onClick={() => setActiveModule(mod.id)}
                    className={`card-dashed-hover group flex flex-col gap-3 p-5 text-left transition-all ${
                      isHighlighted ? 'ring-2 ring-sage-DEFAULT bg-sage-light/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-charcoal">{mod.name}</h4>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium ${DIFFICULTY_COLORS[mod.difficulty] ?? 'bg-cream-200 text-charcoal-muted border-cream-400'}`}>
                        {mod.difficulty}
                      </span>
                    </div>
                    <p className="text-sm text-charcoal-muted">{mod.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-sage-deep opacity-0 transition-opacity group-hover:opacity-100">
                      Start lesson
                      <ChevronLeft className="h-3 w-3 rotate-180" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
        </>
      )}
    </div>
  );
}
