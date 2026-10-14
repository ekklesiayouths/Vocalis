/**
 * CourseWrapper — the Read → Practice → Game workflow for Academy modules.
 *
 * Replaces the old StorybookTutorial with a structured three-section experience:
 * - Section A (Read): Functional explanation with inline audio play buttons.
 * - Section B (Practice): Concrete practice methods and anchor song references.
 * - Section C (Game): A tactile launch button that opens the interactive game.
 *
 * SECURITY: Course data is static. Audio uses useTonePlayer (native Web Audio).
 * No user input is stored.
 */

import { useState, type ReactNode } from 'react';
import {
  BookOpen, Headphones, Play, ArrowRight, RotateCcw, Music, ChevronRight,
} from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { COURSES, getCourseAudioEntries, type CourseSection } from '@/lib/courseData';

type CoursePhase = 'read' | 'practice' | 'game';

interface CourseWrapperProps {
  moduleId: string;
  moduleTitle: string;
  onBack: () => void;
  children: ReactNode;
}

export function CourseWrapper({ moduleId, moduleTitle, onBack, children }: CourseWrapperProps) {
  const { playSequence, cleanup } = useTonePlayer();
  const [phase, setPhase] = useState<CoursePhase>('read');

  const course: CourseSection | undefined = COURSES[moduleId];

  if (!course) {
    return <>{children}</>;
  }

  const handlePlayAudio = (notes: number[], oscillatorType: OscillatorType) => {
    playSequence(getCourseAudioEntries(notes, oscillatorType), { gapMs: 150 });
  };

  const handleStartGame = () => {
    cleanup();
    setPhase('game');
  };

  if (phase === 'game') {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <button
          onClick={() => { cleanup(); setPhase('read'); }}
          className="flex items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal w-fit"
        >
          <RotateCcw className="h-3 w-3" /> Back to Course
        </button>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => { cleanup(); onBack(); }}
        className="flex items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal w-fit"
      >
        <RotateCcw className="h-3 w-3" /> Back to Catalog
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-light border border-sage-DEFAULT shadow-paper-sm">
          <BookOpen className="h-6 w-6 text-sage-deep" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-charcoal">{moduleTitle}</h3>
          <p className="text-sm text-charcoal-muted">Read, practice, then play</p>
        </div>
      </div>

      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        {(['read', 'practice', 'game'] as CoursePhase[]).map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                phase === p
                  ? 'bg-sage-DEFAULT text-cream-50 shadow-paper-sm'
                  : 'bg-cream-200 text-charcoal-muted border border-cream-400'
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <ChevronRight className="h-4 w-4 text-charcoal-muted/40" />}
          </div>
        ))}
      </div>

      {/* Section A: Read */}
      {phase === 'read' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div className="rounded-xl bg-cream-200 border border-cream-400 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wide text-sage-deep">Section A — The Course</span>
            </div>
            <h4 className="text-base font-semibold text-charcoal mb-3">{course.readTitle}</h4>
            <p className="text-charcoal-light leading-relaxed">{course.readBody}</p>
          </div>

          {course.readAudio.length > 0 && (
            <div className="rounded-xl bg-cream-50 border border-cream-400 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Headphones className="h-4 w-4 text-mustard-deep" />
                <span className="text-xs font-bold uppercase tracking-wide text-mustard-deep">Listen to Examples</span>
              </div>
              <div className="flex flex-col gap-2">
                {course.readAudio.map((audio, i) => (
                  <button
                    key={i}
                    onClick={() => handlePlayAudio(audio.notes, audio.oscillatorType)}
                    className="flex items-center gap-2 rounded-xl bg-cream-200 border border-cream-400 px-4 py-2.5 text-sm text-charcoal transition-all hover:bg-sage-light hover:border-sage-DEFAULT hover:text-sage-deep active:translate-y-0.5"
                  >
                    <Play className="h-4 w-4 text-sage-deep" />
                    {audio.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setPhase('practice')}
            className="btn-primary max-w-xs w-full"
          >
            Continue to Practice <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Section B: Practice */}
      {phase === 'practice' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div className="rounded-xl bg-cream-50 border border-cream-400 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wide text-mustard-deep">Section B — Practice</span>
            </div>
            <h4 className="text-base font-semibold text-charcoal mb-3">{course.practiceTitle}</h4>
            <ul className="flex flex-col gap-3">
              {course.practiceMethods.map((method, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-charcoal-light">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mustard-light text-xs font-bold text-mustard-deep mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{method}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-sage-light/40 border border-sage-DEFAULT/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Music className="h-4 w-4 text-sage-deep" />
              <span className="text-xs font-bold uppercase tracking-wide text-sage-deep">Anchor Song</span>
            </div>
            <p className="font-medium text-charcoal">{course.anchorSong}</p>
            <p className="text-sm text-charcoal-muted mt-1">{course.anchorDescription}</p>

            {course.practiceAudio.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {course.practiceAudio.map((audio, i) => (
                  <button
                    key={i}
                    onClick={() => handlePlayAudio(audio.notes, audio.oscillatorType)}
                    className="flex items-center gap-2 rounded-xl bg-cream-100 border border-sage-DEFAULT/50 px-4 py-2.5 text-sm text-charcoal transition-all hover:bg-sage-light hover:text-sage-deep active:translate-y-0.5"
                  >
                    <Play className="h-4 w-4 text-sage-deep" />
                    {audio.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPhase('read')}
              className="btn-secondary"
            >
              <RotateCcw className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleStartGame}
              className="btn-primary flex-1 max-w-xs"
            >
              Start the Game <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
