/**
 * Learning Map recommendation engine — deterministic, rule-based.
 *
 * Uses onboarding data, assessment results, and progress history to generate
 * a personalized learning map across 14 courses grouped into 5 categories.
 *
 * Rules are transparent and documented. No ML dependency.
 */

import type { OnboardingData, AssessmentResult, LearningMapData } from './profileService';
import type { ProgressSummary } from './progressService';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'unassessed';

export interface CourseInfo {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  prerequisites: string[];
  skillsAssessed: string[];
}

export const COURSES: CourseInfo[] = [
  // Pitch & Ear Precision
  { id: 'intervals', name: 'Interval Recognition', category: 'Pitch & Ear Precision', difficulty: 'Beginner', prerequisites: [], skillsAssessed: ['interval-recognition'] },
  { id: 'fine-tuning', name: 'Fine-Tuning Drill', category: 'Pitch & Ear Precision', difficulty: 'Foundation', prerequisites: ['intervals'], skillsAssessed: ['pitch-accuracy'] },
  { id: 'scale-degrees', name: 'Scale Degrees', category: 'Pitch & Ear Precision', difficulty: 'Foundation', prerequisites: ['intervals'], skillsAssessed: ['scale-degree-id'] },
  // Vocal Mechanics
  { id: 'breath-support', name: 'Breath Support Tracker', category: 'Vocal Mechanics', difficulty: 'Beginner', prerequisites: [], skillsAssessed: ['breath-control'] },
  { id: 'register-blending', name: 'Chest/Head/Mixed Blending', category: 'Vocal Mechanics', difficulty: 'Singer', prerequisites: ['breath-support'], skillsAssessed: ['register-transitions'] },
  { id: 'resonance', name: 'Resonators', category: 'Vocal Mechanics', difficulty: 'Singer', prerequisites: ['breath-support'], skillsAssessed: [] },
  // Agility & Runs
  { id: 'dexterity-drills', name: 'Dexterity Drills', category: 'Agility & Runs', difficulty: 'Singer', prerequisites: ['scale-degrees', 'register-blending'], skillsAssessed: ['agility'] },
  { id: 'pentatonic-runs', name: 'Pentatonic Scale Runs', category: 'Agility & Runs', difficulty: 'Singer', prerequisites: ['scale-degrees', 'dexterity-drills'], skillsAssessed: ['pentatonic-accuracy'] },
  // Harmony & Choral Mastery
  { id: 'third-fifth-finding', name: '3rd/5th Finding', category: 'Harmony & Choral Mastery', difficulty: 'Harmony', prerequisites: ['scale-degrees', 'fine-tuning'], skillsAssessed: ['harmony-intervals'] },
  { id: 'part-stability', name: 'Part Stability', category: 'Harmony & Choral Mastery', difficulty: 'Harmony', prerequisites: ['third-fifth-finding'], skillsAssessed: [] },
  { id: 'vowel-blending', name: 'Vowel Blending', category: 'Harmony & Choral Mastery', difficulty: 'Harmony', prerequisites: ['third-fifth-finding'], skillsAssessed: ['vowel-uniformity'] },
  // Music Director Suite
  { id: 'modulation-mission', name: 'Modulation Missions', category: 'Music Director Suite', difficulty: 'Advanced', prerequisites: ['scale-degrees', 'dexterity-drills'], skillsAssessed: ['modulation-recognition'] },
  { id: 'satb-arranging', name: 'SATB Arranging', category: 'Music Director Suite', difficulty: 'Advanced', prerequisites: ['modulation-mission', 'third-fifth-finding'], skillsAssessed: [] },
  { id: 'a-cappella-key-starts', name: 'A Cappella Key Starts', category: 'Music Director Suite', difficulty: 'Advanced', prerequisites: ['modulation-mission', 'fine-tuning'], skillsAssessed: ['key-start-selection'] },
];

const CATEGORY_ORDER = [
  'Pitch & Ear Precision',
  'Vocal Mechanics',
  'Agility & Runs',
  'Harmony & Choral Mastery',
  'Music Director Suite',
];

const DIRECTOR_COURSES = ['modulation-mission', 'satb-arranging', 'a-cappella-key-starts'];
const BEGINNER_START_COURSES = ['breath-support', 'intervals'];

function getAssessmentLevel(
  courseId: string,
  onboarding: OnboardingData | null,
  progress: ProgressSummary | null,
): SkillLevel {
  // Check measured assessment results from onboarding
  if (onboarding?.assessmentResults) {
    const course = COURSES.find((c) => c.id === courseId);
    if (course) {
      for (const skill of course.skillsAssessed) {
        const result = onboarding.assessmentResults[skill];
        if (result && result.source === 'measured') {
          if (result.accuracy >= 80) return 'advanced';
          if (result.accuracy >= 60) return 'intermediate';
          return 'beginner';
        }
      }
    }
  }

  // Check progress history from scores
  if (progress) {
    const courseName = COURSES.find((c) => c.id === courseId)?.name;
    if (courseName) {
      const stat = progress.modules.find((m) => m.module_name === courseName);
      if (stat) {
        if (stat.best_accuracy >= 80 && stat.attempts >= 3) return 'advanced';
        if (stat.best_accuracy >= 60) return 'intermediate';
        return 'beginner';
      }
    }
  }

  // Fall back to self-reported experience
  if (onboarding) {
    if (onboarding.experience === 'experienced' && !BEGINNER_START_COURSES.includes(courseId)) {
      return 'intermediate';
    }
    if (onboarding.experience === 'some-experience' && !BEGINNER_START_COURSES.includes(courseId)) {
      return onboarding.readsNotation ? 'intermediate' : 'beginner';
    }
  }

  return 'unassessed';
}

function isDirectorGoal(onboarding: OnboardingData | null): boolean {
  if (!onboarding) return false;
  return onboarding.goals.some((g) => g === 'lead-choir' || g === 'music-direction') ||
    onboarding.role === 'choir-director' || onboarding.role === 'worship-leader';
}

function shouldIncludeCourse(courseId: string, onboarding: OnboardingData | null): boolean {
  if (isDirectorGoal(onboarding)) return true;
  // Non-directors still get director courses but they're lower priority
  return true;
}

function getReasonForCourse(courseId: string, level: SkillLevel, onboarding: OnboardingData | null): string {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) return '';

  if (level === 'unassessed') {
    return `Not yet assessed — recommended to establish your baseline in ${course.name}`;
  }
  if (level === 'beginner') {
    if (course.prerequisites.length === 0) return 'Starting point — builds foundational skills';
    return `Needs work — prerequisite skills detected but ${course.name} accuracy is below 60%`;
  }
  if (level === 'intermediate') {
    return `Making progress — accuracy 60–79%. Continue to strengthen ${course.name}`;
  }
  return `Strong — accuracy 80%+. Consider this a confirmed strength`;
}

export function generateLearningMap(
  onboarding: OnboardingData | null,
  progress: ProgressSummary | null,
  completedModules: string[],
): LearningMapData {
  const levels: Record<string, SkillLevel> = {};
  const reasons: Record<string, string> = {};

  for (const course of COURSES) {
    if (!shouldIncludeCourse(course.id, onboarding)) continue;
    levels[course.id] = getAssessmentLevel(course.id, onboarding, progress);
    reasons[course.id] = getReasonForCourse(course.id, levels[course.id], onboarding);
  }

  // Determine recommended starting course
  let recommendedStart = BEGINNER_START_COURSES[0];

  // If experienced and reads notation, can start with intervals or fine-tuning
  if (onboarding?.experience === 'experienced' && onboarding.readsNotation) {
    const intervalLevel = levels['intervals'];
    if (intervalLevel === 'advanced' || intervalLevel === 'intermediate') {
      recommendedStart = 'fine-tuning';
    } else {
      recommendedStart = 'intervals';
    }
  }

  // If goal is ear training, start with intervals
  if (onboarding?.goals.includes('ear-training')) {
    recommendedStart = 'intervals';
  }

  // If goal is singing/vocal development, start with breath support
  if (onboarding?.goals.includes('sing-better') || onboarding?.goals.includes('vocal-development')) {
    const breathLevel = levels['breath-support'];
    if (breathLevel === 'advanced') {
      recommendedStart = 'register-blending';
    } else {
      recommendedStart = 'breath-support';
    }
  }

  // If director, ensure director courses are in sequence
  if (isDirectorGoal(onboarding)) {
    const modulationLevel = levels['modulation-mission'];
    if (modulationLevel !== 'unassessed' && modulationLevel !== 'beginner') {
      recommendedStart = 'a-cappella-key-starts';
    }
  }

  // Build sequence respecting prerequisites and levels
  const sequence = buildSequence(levels, completedModules, isDirectorGoal(onboarding));

  const practicePlan = {
    frequency: onboarding?.practiceFrequency ?? 'daily',
    duration: onboarding?.practiceDuration ?? '15-min',
  };

  return {
    recommendedStart,
    sequence,
    levels,
    reasons,
    practicePlan,
    generatedAt: new Date().toISOString(),
  };
}

function buildSequence(
  levels: Record<string, SkillLevel>,
  completedModules: string[],
  isDirector: boolean,
): string[] {
  // Topological sort respecting prerequisites
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(courseId: string) {
    if (visited.has(courseId)) return;
    const course = COURSES.find((c) => c.id === courseId);
    if (!course) return;
    visited.add(courseId);
    for (const prereq of course.prerequisites) {
      visit(prereq);
    }
    result.push(courseId);
  }

  // Visit in category order, director courses last for non-directors
  for (const category of CATEGORY_ORDER) {
    if (!isDirector && category === 'Music Director Suite') continue;
    for (const course of COURSES) {
      if (course.category === category) {
        visit(course.id);
      }
    }
  }

  // For non-directors, add director courses at the end
  if (!isDirector) {
    for (const course of COURSES) {
      if (course.category === 'Music Director Suite') {
        visit(course.id);
      }
    }
  }

  return result;
}

export function getCategoryOrder(): string[] {
  return CATEGORY_ORDER;
}

export function getCoursesByCategory(): Record<string, CourseInfo[]> {
  const byCategory: Record<string, CourseInfo[]> = {};
  for (const category of CATEGORY_ORDER) {
    byCategory[category] = COURSES.filter((c) => c.category === category);
  }
  return byCategory;
}
