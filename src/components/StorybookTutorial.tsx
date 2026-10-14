/**
 * StorybookTutorial — interactive tutorial screen before each module.
 *
 * Follows the "Show, Play, Anchor, Then Try" framework:
 * - Show: A warm analogy explaining the concept in human terms
 * - Play: A "Listen to Example" button using Web Audio API
 * - Anchor: A culturally accessible melody reference
 * - Then Try: A "Start Exercise" button to begin the actual module
 *
 * SECURITY: Tutorial data is static. Audio playback uses useTonePlayer
 * (native Web Audio, cleaned up on unmount). No user input is stored.
 */

import { useState, type ReactNode } from 'react';
import { BookOpen, Headphones, Music, ArrowRight, RotateCcw } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { TUTORIALS, getTutorialNotes, type TutorialData } from '@/lib/tutorialData';

interface StorybookTutorialProps {
  moduleId: string;
  moduleTitle: string;
  onStart: () => void;
  onBack?: () => void;
}

export function StorybookTutorial({ moduleId, moduleTitle, onStart, onBack }: StorybookTutorialProps) {
  const { playSequence, cleanup } = useTonePlayer();
  const [hasListened, setHasListened] = useState(false);

  const tutorial: TutorialData | undefined = TUTORIALS[moduleId];

  const handleListen = () => {
    if (!tutorial || tutorial.listenNotes.length === 0) return;
    setHasListened(true);
    playSequence(getTutorialNotes(tutorial), { gapMs: 150 });
  };

  if (!tutorial) {
    // No tutorial for this module — skip straight to the exercise
    return null;
  }

  return (
    <div className="card flex flex-col gap-6 p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-light border border-sage-DEFAULT shadow-paper-sm">
          <BookOpen className="h-6 w-6 text-sage-deep" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-charcoal">{tutorial.title}</h3>
          <p className="text-sm text-charcoal-muted">A quick story before we play</p>
        </div>
      </div>

      {/* Show: Analogy */}
      <div className="rounded-xl bg-cream-200 border border-cream-400 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wide text-sage-deep">The Story</span>
        </div>
        <p className="text-charcoal-light leading-relaxed">{tutorial.analogy}</p>
      </div>

      {/* Play: Listen to Example */}
      <div className="rounded-xl bg-cream-50 border border-cream-400 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Headphones className="h-4 w-4 text-mustard-deep" />
          <span className="text-xs font-bold uppercase tracking-wide text-mustard-deep">Listen First</span>
        </div>
        <p className="text-sm text-charcoal-muted mb-3">
          {tutorial.listenLabel}
        </p>
        {tutorial.listenNotes.length > 0 ? (
          <button onClick={handleListen} className="btn-mustard">
            <Headphones className="h-5 w-5" /> Play Example
          </button>
        ) : (
          <p className="text-sm text-charcoal-muted italic">This is a microphone exercise — you will use your voice directly!</p>
        )}
        {hasListened && (
          <p className="mt-2 text-xs text-sage-deep animate-fade-in">Heard it? Great — let's anchor it next!</p>
        )}
      </div>

      {/* Anchor: Practice Song Reference */}
      <div className="rounded-xl bg-sage-light/40 border border-sage-DEFAULT/50 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Music className="h-4 w-4 text-sage-deep" />
          <span className="text-xs font-bold uppercase tracking-wide text-sage-deep">Anchor Song</span>
        </div>
        <p className="font-medium text-charcoal">{tutorial.anchorSong}</p>
        <p className="text-sm text-charcoal-muted mt-1">{tutorial.anchorDescription}</p>
      </div>

      {/* Then Try: Start button */}
      <div className="flex flex-col items-center gap-3">
        <button onClick={() => { cleanup(); onStart(); }} className="btn-primary max-w-xs w-full">
          Let's Try It! <ArrowRight className="h-5 w-5" />
        </button>
        {onBack && (
          <button onClick={() => { cleanup(); onBack(); }} className="text-sm text-charcoal-muted transition-colors hover:text-charcoal flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> Back to Catalog
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Wrapper that shows the tutorial first, then the module component.
 * Used by AcademyDashboard to wrap each module.
 */
interface TutorialWrapperProps {
  moduleId: string;
  moduleTitle: string;
  onBack: () => void;
  children: ReactNode;
}

export function TutorialWrapper({ moduleId, moduleTitle, onBack, children }: TutorialWrapperProps) {
  const [showTutorial, setShowTutorial] = useState(true);

  if (showTutorial) {
    return (
      <StorybookTutorial
        moduleId={moduleId}
        moduleTitle={moduleTitle}
        onStart={() => setShowTutorial(false)}
        onBack={onBack}
      />
    );
  }

  return <>{children}</>;
}
