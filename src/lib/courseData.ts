/**
 * Course content for each Academy module — the Read → Practice → Game workflow.
 *
 * Each course entry provides a structured learning experience:
 * - Section A (Read): A clear, functional explanation of the musical concept.
 * - Section B (Practice): Concrete practice methods and anchor song references.
 * - Section C (Game): Launches the interactive pitch detection game.
 *
 * Extended fields (Phase 1 rebuild):
 * - targetLevel, prerequisites, learningOutcomes: structured metadata
 * - commonMistakes: practical tips for what goes wrong
 * - masteryCriteria: how to know you're ready to move on
 * - nextSteps: what to study after this course
 *
 * Audio examples use MIDI note numbers played via the useTonePlayer hook.
 *
 * SECURITY: Static data — no user input, no I/O.
 */

import { midiToFrequency } from '@/lib/notes';

export interface CourseSection {
  /** Section A: conceptual explanation */
  readTitle: string;
  readBody: string;
  /** Audio examples for the Read section */
  readAudio: {
    label: string;
    notes: number[];
    oscillatorType: OscillatorType;
  }[];
  /** Section B: practice methods and anchor songs */
  practiceTitle: string;
  practiceMethods: string[];
  anchorSong: string;
  anchorDescription: string;
  /** Audio examples for the Practice section */
  practiceAudio: {
    label: string;
    notes: number[];
    oscillatorType: OscillatorType;
  }[];
  /** Structured metadata */
  targetLevel: string;
  prerequisites: string[];
  learningOutcomes: string[];
  commonMistakes: string[];
  masteryCriteria: string[];
  nextSteps: string[];
}

export const COURSES: Record<string, CourseSection> = {
  intervals: {
    readTitle: 'What Is an Interval?',
    readBody:
      'An interval is the distance between two pitches, measured in semitones (half steps). A semitone is the smallest distance in Western music — one piano key to the very next. A whole tone is two semitones. Common intervals: a major second spans two semitones, a major third spans four, a perfect fifth spans seven, and an octave spans twelve. The size of the gap determines how the two notes sound together — small intervals feel close and tense, large intervals feel open and stable.',
    readAudio: [
      { label: 'Play a Major 2nd (C4 to D4)', notes: [60, 62], oscillatorType: 'triangle' },
      { label: 'Play a Major 3rd (C4 to E4)', notes: [60, 64], oscillatorType: 'triangle' },
      { label: 'Play a Perfect 5th (C4 to G4)', notes: [60, 67], oscillatorType: 'triangle' },
      { label: 'Play an Octave (C4 to C5)', notes: [60, 72], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Intervals',
    practiceMethods: [
      'Sing the lower note first, hold it, then leap up to the upper note. Check if you arrived accurately.',
      'Practice ascending seconds (C-D-E-F-G) until each step feels automatic, then try skipping to thirds and fifths.',
      'Practice descending intervals too — they often feel harder than ascending ones.',
    ],
    anchorSong: 'Joy to the World',
    anchorDescription: 'The opening phrase ("Joy to the World, the Lord is come") descends a full octave from D5 down to D4 — the largest common interval in a melody.',
    practiceAudio: [
      { label: 'Play the Joy to the World opening (descending octave)', notes: [74, 72, 71, 69, 67, 65, 64, 62], oscillatorType: 'triangle' },
    ],
    targetLevel: 'Beginner',
    prerequisites: ['None — this is the starting point for ear training.'],
    learningOutcomes: [
      'Identify major seconds, thirds, fifths, and octaves by ear.',
      'Sing a named interval accurately after hearing a reference note.',
      'Understand semitone counting for any interval.',
    ],
    commonMistakes: [
      'Confusing ascending and descending intervals — a descending major third sounds different from an ascending one.',
      'Singing the upper note too flat after a large leap — check with a reference tone.',
    ],
    masteryCriteria: [
      'Correctly identify 8 out of 10 intervals in the game.',
      'Sing a major third, perfect fifth, and octave within 10 cents of the target.',
    ],
    nextSteps: ['Fine-Tuning Drill', 'Scale Degrees'],
  },
  'fine-tuning': {
    readTitle: 'What Is Pitch Accuracy?',
    readBody:
      'Pitch accuracy means landing exactly on the correct frequency. In music, we measure small deviations in "cents" — 100 cents equals one semitone. If you sing 10 cents sharp, you are slightly above the target note; 10 cents flat means slightly below. Most people can hear deviations of 15 cents or more. The goal is to sing within about 5 cents of the target, which sounds "in tune" to a choir.',
    readAudio: [
      { label: 'Play a reference A4 (440 Hz)', notes: [69], oscillatorType: 'sine' },
      { label: 'Play A4 then A4+10 cents (slightly sharp)', notes: [69, 69], oscillatorType: 'sine' },
    ],
    practiceTitle: 'How to Practice Fine-Tuning',
    practiceMethods: [
      'Sing a sustained note against a reference tone and listen for "beats" — a wobble in the sound means you are slightly off.',
      'When you hear beats, nudge your pitch slightly up or down until the wobble disappears.',
      'Practice with a tuning app or drone tone, holding each note for 5+ seconds and adjusting mid-note.',
    ],
    anchorSong: 'A tuning fork at A4 (440 Hz)',
    anchorDescription: 'This is the standard reference pitch that orchestras tune to before performing.',
    practiceAudio: [
      { label: 'Play a sustained A4 drone', notes: [69], oscillatorType: 'sine' },
    ],
    targetLevel: 'Foundation',
    prerequisites: ['Interval Recognition (or basic pitch matching ability).'],
    learningOutcomes: [
      'Match a reference pitch within 5 cents.',
      'Hear and identify whether you are sharp or flat relative to a target.',
      'Correct pitch mid-note using auditory feedback.',
    ],
    commonMistakes: [
      'Singing slightly flat on descending notes — the voice tends to settle under pitch.',
      'Overcorrecting — making too large an adjustment instead of a small nudge.',
    ],
    masteryCriteria: [
      'Hold a target note within 5 cents for 5 seconds.',
      'Identify sharp vs. flat correctly 8 out of 10 times.',
    ],
    nextSteps: ['Scale Degrees', 'Register Blending'],
  },
  'scale-degrees': {
    readTitle: 'What Are Scale Degrees?',
    readBody:
      'A scale is a sequence of notes ordered by pitch, typically seven steps plus the octave repeat. Each step has a number (1 through 7) and a solfege name (Do, Re, Mi, Fa, Sol, La, Ti). Scale degree 1 (Do) is the home note — it feels resolved and final. Scale degree 5 (Sol) is the dominant — it feels stable but open. Scale degree 7 (Ti) is the leading tone — it pulls strongly toward 1. Recognizing scale degrees by ear lets you identify any note within a key.',
    readAudio: [
      { label: 'Play the full C major scale (Do through Do)', notes: [60, 62, 64, 65, 67, 69, 71, 72], oscillatorType: 'triangle' },
      { label: 'Play Scale Degree 1 (Do)', notes: [60], oscillatorType: 'triangle' },
      { label: 'Play Scale Degree 5 (Sol)', notes: [67], oscillatorType: 'triangle' },
      { label: 'Play Scale Degree 7 (Ti)', notes: [71], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Scale Degrees',
    practiceMethods: [
      'Sing the scale up and down while naming each degree number aloud ("1, 2, 3, 4, 5, 6, 7, 8").',
      'Have someone play a random scale degree and try to identify it by number.',
      'Listen to a familiar melody and label each note with its scale degree number.',
    ],
    anchorSong: 'As the Deer',
    anchorDescription: 'The opening phrase walks up through consecutive scale degrees — sing and label each one.',
    practiceAudio: [
      { label: 'Play the As the Deer opening', notes: [69, 71, 72, 74, 72, 71, 69, 67], oscillatorType: 'triangle' },
    ],
    targetLevel: 'Foundation',
    prerequisites: ['Interval Recognition (or basic pitch matching ability).'],
    learningOutcomes: [
      'Identify all seven scale degrees by ear in a major key.',
      'Sing any scale degree after hearing the tonic (Do).',
      'Understand the functional roles of 1, 5, and 7.',
    ],
    commonMistakes: [
      'Confusing scale degree 4 (Fa) with scale degree 2 (Re) — both are close to the tonic but Fa feels more suspended.',
      'Forgetting that scale degrees are relative to the key, not absolute pitches.',
    ],
    masteryCriteria: [
      'Correctly identify 8 out of 10 scale degrees in the game.',
      'Sing any requested scale degree within 10 cents of the target.',
    ],
    nextSteps: ['Third/Fifth Finding', 'Modulation Missions'],
  },
  'breath-support': {
    readTitle: 'What Is Breath Support?',
    readBody:
      'Breath support is the controlled, steady release of air during singing. The diaphragm and abdominal muscles regulate air pressure so the tone stays even from start to finish. Good support means no sudden bursts of air at the start, no trailing off at the end, and consistent volume throughout. The exercise in this module is a sustained "sss" hiss — the microphone detects how steadily you can maintain an audible sound. Note: the mic hears sound consistency, not airflow or lung capacity. Start with the Beginner target (8 seconds) and work your way up.',
    readAudio: [],
    practiceTitle: 'How to Practice Breath Support',
    practiceMethods: [
      'Inhale comfortably through the nose (4 counts), then exhale a steady "sss" hiss for as long as comfortable.',
      'Keep the hiss at a consistent volume — not louder at the start, not quieter at the end.',
      'Time yourself: aim for 8 seconds first, then 15, then 25. The goal is steadiness, not maximum duration.',
    ],
    anchorSong: 'A slow candle blow (ssss)',
    anchorDescription: 'Pretend you are keeping a candle flame flickering but not blowing it out — steady, gentle air.',
    practiceAudio: [],
    targetLevel: 'Beginner',
    prerequisites: ['None — this is a foundational skill for all singing.'],
    learningOutcomes: [
      'Sustain a consistent "sss" hiss for 8+ seconds (Beginner target).',
      'Understand that the mic measures sound consistency, not breath capacity.',
      'Recognize when your sound level is dropping or fluctuating.',
    ],
    commonMistakes: [
      'Starting too loud and running out of air quickly — begin at a moderate, sustainable level.',
      'Thinking the mic measures lung capacity — it only detects audible sound consistency.',
      'Pushing or forcing — the goal is a comfortable, even hiss, not maximum effort.',
    ],
    masteryCriteria: [
      'Sustain a steady hiss in the target zone for 8 seconds (Beginner).',
      'Keep the floating note mostly in the sage zone without large drops.',
    ],
    nextSteps: ['Register Blending', 'Vowel Blending'],
  },
  'register-blending': {
    readTitle: 'What Are Vocal Registers?',
    readBody:
      'Vocal registers are different modes of vibration in your vocal folds. Chest voice is the lower, heavier register used for speaking. Head voice is the lighter, higher register used for high notes. Mixed voice is the smooth transition between them. The "break" or "passaggio" is where the voice tends to crack when shifting from chest to head. Blending registers means singing through the break smoothly, without a sudden change in volume or quality.',
    readAudio: [
      { label: 'Play a siren (smooth chest-to-head glide)', notes: [60, 64, 67, 72, 67, 64, 60], oscillatorType: 'sine' },
    ],
    practiceTitle: 'How to Practice Register Blending',
    practiceMethods: [
      'Sing a slow "oooh" glide from your lowest note to your highest and back, keeping the volume even.',
      'Notice where the voice wants to "flip" — that is your passaggio. Practice slowing down through that spot.',
      'Use a lip trill (rolling lips) while gliding up and down — it reduces pressure and helps smooth the transition.',
    ],
    anchorSong: 'A vocal siren (smooth oooh glide)',
    anchorDescription: 'Like a fire truck siren but with your voice — smooth up and down with no breaks.',
    practiceAudio: [
      { label: 'Play a siren example', notes: [60, 64, 67, 72, 67, 64, 60], oscillatorType: 'sine' },
    ],
    targetLevel: 'Singer',
    prerequisites: ['Breath Support Tracker (steady airflow needed for smooth glides).'],
    learningOutcomes: [
      'Identify your chest voice, head voice, and passaggio by feel.',
      'Glide between registers without a sudden break or volume change.',
      'Use a lip trill to smooth the transition through the passaggio.',
    ],
    commonMistakes: [
      'Pushing chest voice too high instead of allowing the transition — this causes strain.',
      'Flipping abruptly to head voice with a volume drop — aim for a gradual blend.',
    ],
    masteryCriteria: [
      'Complete a full siren glide with no audible break.',
      'Maintain consistent volume across the passaggio.',
    ],
    nextSteps: ['Resonators', 'Vowel Blending'],
  },
  'dexterity-drills': {
    readTitle: 'What Is Vocal Dexterity?',
    readBody:
      'Vocal dexterity is the ability to sing rapid, precise sequences of notes cleanly and in tune. It requires coordination between breath, pitch, and articulation. The pentatonic scale (notes 1, 2, 3, 5, 6 of the major scale) is the most common framework for agility drills because it avoids semitone intervals that are harder to navigate at speed. Practicing short patterns slowly, then gradually increasing tempo, builds the muscle memory for fast runs.',
    readAudio: [
      { label: 'Play a pentatonic run (C4-D4-E4-G4-A4-G4-E4-D4-C4)', notes: [60, 62, 64, 67, 69, 67, 64, 62, 60], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Dexterity',
    practiceMethods: [
      'Start slow: sing the 5-note pentatonic pattern at half speed, making sure each note is clean and accurate.',
      'Gradually speed up only when the slow version is perfect — speed without accuracy builds bad habits.',
      'Practice the same pattern in different keys to build transferable muscle memory.',
    ],
    anchorSong: 'Amazing Grace',
    anchorDescription: 'Amazing Grace uses only pentatonic notes — it never sounds wrong and builds agility naturally.',
    practiceAudio: [
      { label: 'Play the Amazing Grace melody', notes: [67, 72, 67, 64, 65, 67, 72, 67, 64, 65, 67, 72, 74, 72, 67, 72, 67, 64, 65, 67, 72, 67, 64, 62, 60], oscillatorType: 'triangle' },
    ],
    targetLevel: 'Singer',
    prerequisites: ['Scale Degrees (need to know scale notes)', 'Fine-Tuning Drill (need pitch accuracy).'],
    learningOutcomes: [
      'Sing a 5-note pentatonic pattern cleanly at moderate tempo.',
      'Increase speed gradually while maintaining accuracy.',
      'Transfer the pattern to different starting notes.',
    ],
    commonMistakes: [
      'Rushing to fast tempos before the slow version is clean — speed without accuracy embeds mistakes.',
      'Sliding between notes instead of hitting each one distinctly — each note should be a clear target.',
    ],
    masteryCriteria: [
      'Sing the pentatonic pattern accurately at the game target tempo.',
      'Hit 8 out of 10 notes within 10 cents in the game.',
    ],
    nextSteps: ['Pentatonic Scale Runs', 'Part Stability'],
  },
  'third-fifth-finding': {
    readTitle: 'What Is Harmony?',
    readBody:
      'Harmony is the art of singing a different note that sounds good alongside the melody. The two most common harmony notes are the third (3 scale steps above the melody) and the fifth (5 steps above). A third above the melody creates a sweet, full sound. A fifth above creates a grounded, open sound. The challenge is holding your harmony note steady while the melody moves around you — your ear wants to follow the melody, but your job is to stay on your own path.',
    readAudio: [
      { label: 'Play a C major chord (root, 3rd, 5th)', notes: [60, 64, 67], oscillatorType: 'triangle' },
      { label: 'Play the root then the third above', notes: [60, 64], oscillatorType: 'triangle' },
      { label: 'Play the root then the fifth above', notes: [60, 67], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice 3rd/5th Finding',
    practiceMethods: [
      'Have someone sing or play a melody note, then sing the note a third above it. Check if you are in tune.',
      'Practice holding a single harmony note (e.g., E) while the melody moves (C, D, E, F, G) — do not follow.',
      'Practice both thirds and fifths above and below the melody to build flexibility.',
    ],
    anchorSong: 'Lean on Me',
    anchorDescription: 'The melody moves through chord roots — sing a third above each note for instant harmony.',
    practiceAudio: [
      { label: 'Play the Lean on Me melody', notes: [60, 60, 60, 60, 65, 65, 65, 65, 67, 67, 67, 67], oscillatorType: 'sine' },
    ],
    targetLevel: 'Harmony',
    prerequisites: ['Scale Degrees (need to know scale positions)', 'Interval Recognition.'],
    learningOutcomes: [
      'Sing a third or fifth above a given melody note.',
      'Hold a harmony note steady while the melody moves.',
      'Choose between thirds and fifths based on the desired sound.',
    ],
    commonMistakes: [
      'Following the melody instead of holding your harmony note — this is the #1 harmony mistake.',
      'Singing the harmony too loud — it should blend, not overpower the melody.',
    ],
    masteryCriteria: [
      'Sing a third above 8 out of 10 melody notes correctly in the game.',
      'Hold a harmony note for 10 seconds without drifting toward the melody.',
    ],
    nextSteps: ['Part Stability', 'Vowel Blending'],
  },
  'vowel-blending': {
    readTitle: 'What Is Vowel Blending?',
    readBody:
      'Vowel blending is the process of unifying vowel shapes across a choir so the sound merges into one. Every vowel has a specific mouth shape: "Ah" is round and open, "Ee" is narrow and bright, "Oh" is tall and oval. When singers use slightly different shapes, the frequencies do not align and the chord sounds rough. The goal is for every singer to match the same vowel shape at the same time, creating a unified, resonant sound.',
    readAudio: [
      { label: 'Play a blended C major chord', notes: [60, 64, 67], oscillatorType: 'sine' },
    ],
    practiceTitle: 'How to Practice Vowel Blending',
    practiceMethods: [
      'Sing a sustained "Ah" on a single note and have a partner match your exact mouth shape — tall and round.',
      'Transition slowly between Ah → Oh → Ee on one sustained note, keeping the throat open.',
      'In a group, sing a chord on "Ah" and listen for any roughness — adjust your vowel until it smooths out.',
    ],
    anchorSong: 'A unified Ah vowel',
    anchorDescription: 'The round "Ah" is the most blended vowel sound for choirs — start here.',
    practiceAudio: [
      { label: 'Play a sustained chord for vowel practice', notes: [60, 64, 67], oscillatorType: 'sine' },
    ],
    targetLevel: 'Harmony',
    prerequisites: ['Third/Fifth Finding (need to hold a harmony note first).'],
    learningOutcomes: [
      'Understand the three primary vowel shapes (Ah, Oh, Ee) and their resonant characteristics.',
      'Match a unified vowel shape with other singers.',
      'Hear and correct roughness caused by mismatched vowels in a chord.',
    ],
    commonMistakes: [
      'Spreading "Ah" too wide horizontally — aim for a tall, vertical shape instead.',
      'Letting "Ee" get nasal and thin — keep the throat open even on bright vowels.',
    ],
    masteryCriteria: [
      'Sustain a unified vowel on a chord with no audible roughness.',
      'Transition between vowels smoothly without pitch drift.',
    ],
    nextSteps: ['Part Stability', 'SATB Arranging'],
  },
  'modulation-mission': {
    readTitle: 'What Is a Modulation?',
    readBody:
      'A modulation is a key change within a piece of music. The most common type is moving up a whole tone (e.g., from C major to D major) for the final chorus of a pop song — it creates a lift in energy. To identify a modulation by ear, listen for the moment when the "home note" (the tonic) shifts. The melody will start resolving to a new pitch instead of the original one. The feeling is like the floor moving beneath you — the same melody, but a new gravitational center.',
    readAudio: [
      { label: 'Play C major scale then D major scale (modulation up)', notes: [60, 62, 64, 65, 67, 69, 71, 72, 62, 64, 66, 67, 69, 71, 73, 74], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Identifying Modulations',
    practiceMethods: [
      'Listen to pop songs and identify the moment the key shifts up — usually before the final chorus.',
      'Sing the home note of the song, then notice when that home note changes — that is the modulation point.',
      'Practice singing a simple melody in C, then immediately singing the same melody in D — feel the shift.',
    ],
    anchorSong: 'Modulation in pop songs',
    anchorDescription: 'Many pop songs shift up a key for the final chorus — it feels like the energy lifts.',
    practiceAudio: [
      { label: 'Play a whole-step modulation (C to D)', notes: [60, 60, 62], oscillatorType: 'triangle' },
    ],
    targetLevel: 'Advanced',
    prerequisites: ['Scale Degrees (must recognize the tonic by ear)', 'Interval Recognition.'],
    learningOutcomes: [
      'Identify when a modulation occurs in a piece of music.',
      'Determine the direction of the modulation (up or down) and the interval.',
      'Sing the same melody in two different keys back-to-back.',
    ],
    commonMistakes: [
      'Confusing a modulation with a temporary key change (tonicization) — a true modulation stays in the new key.',
      'Not noticing the modulation because the melody repeats — listen for where "home" has moved.',
    ],
    masteryCriteria: [
      'Correctly identify 7 out of 10 modulations in the game.',
      'Identify both the direction and interval of the modulation.',
    ],
    nextSteps: ['A Cappella Key Starts', 'SATB Arranging'],
  },
  'a-cappella-key-starts': {
    readTitle: 'What Is a Key Start?',
    readBody:
      'In a cappella singing, the music director gives starting pitches — the notes that tell each voice part where "home" is before they begin. Without an instrument, the director must produce these pitches from memory or a pitch pipe. The skill is hearing a target note in your head and singing it accurately. Practice by learning the relationship between a reference note (like C4) and the note you need, then singing the target without the reference.',
    readAudio: [
      { label: 'Play a C4 reference drone', notes: [60], oscillatorType: 'sine' },
      { label: 'Play C4 then G4 (a perfect 5th)', notes: [60, 67], oscillatorType: 'sine' },
    ],
    practiceTitle: 'How to Practice Key Starts',
    practiceMethods: [
      'Memorize the sound of C4 (261.6 Hz). Practice singing it from silence, then check with a tuner.',
      'Learn intervals from C4: a fifth up is G4, a fourth up is F4, a third up is E4.',
      'Practice giving SATB starting pitches: sing the root, third, fifth, and octave for a given key.',
    ],
    anchorSong: 'A pitch pipe drone',
    anchorDescription: 'A pitch pipe gives one steady note so the whole choir knows where to start.',
    practiceAudio: [
      { label: 'Play a C4 drone for practice', notes: [60], oscillatorType: 'sine' },
    ],
    targetLevel: 'Advanced',
    prerequisites: ['Scale Degrees', 'Interval Recognition', 'Fine-Tuning Drill.'],
    learningOutcomes: [
      'Sing a target pitch from memory within 10 cents of the correct frequency.',
      'Give starting pitches for all four SATB parts in a given key.',
      'Internalize the sound of a reference pitch (e.g., C4) reliably.',
    ],
    commonMistakes: [
      'Singing the starting pitch slightly flat — check with a tuner before the choir begins.',
      'Giving pitches in the wrong order — start with the lowest part (Bass) and go up.',
    ],
    masteryCriteria: [
      'Sing a target pitch from silence within 10 cents, 8 out of 10 times.',
      'Give all four SATB starting pitches for a key within 10 cents each.',
    ],
    nextSteps: ['SATB Arranging', 'Modulation Missions'],
  },
  'resonators': {
    readTitle: 'What Are Vocal Resonators?',
    readBody:
      'Resonance is how your voice amplifies and colors sound. The three main resonators are chest (low, warm tones), mask (the buzzy forward placement around the nose and lips), and head (bright, high frequencies). By directing your sound into different resonators, you can change the tone color without changing the pitch. The goal is awareness of where you feel vibration — chest buzz on low notes, mask buzz on mid notes, head buzz on high notes.',
    readAudio: [
      { label: 'Play a low note (C3 — chest resonance)', notes: [48], oscillatorType: 'sine' },
      { label: 'Play a mid note (E4 — mask resonance)', notes: [64], oscillatorType: 'sine' },
      { label: 'Play a high note (A4 — head resonance)', notes: [69], oscillatorType: 'sine' },
    ],
    practiceTitle: 'How to Practice Resonance Awareness',
    practiceMethods: [
      'Place a hand on your chest and sing a low note — feel the vibration. Then move up and notice when it shifts to your face.',
      'Hum with lips closed on a mid-range note — the buzzy feeling in your lips and nose is mask resonance.',
      'Sing a high "ooo" and feel the vibration move behind your eyes and in the top of your head — that is head resonance.',
    ],
    anchorSong: 'A humming warm-up',
    anchorDescription: 'Humming on different pitches helps you feel each resonator in turn.',
    practiceAudio: [
      { label: 'Play a resonance sweep (low to high)', notes: [48, 52, 55, 60, 64, 67, 69], oscillatorType: 'sine' },
    ],
    targetLevel: 'Singer',
    prerequisites: ['Breath Support Tracker (need steady air for sustained tones).'],
    learningOutcomes: [
      'Identify chest, mask, and head resonance by physical sensation.',
      'Shift resonance placement deliberately without changing pitch.',
      'Understand how resonance affects tone color.',
    ],
    commonMistakes: [
      'Trying to force chest resonance too high — each register has a natural range.',
      'Confusing loudness with resonance — resonance is about placement, not volume.',
    ],
    masteryCriteria: [
      'Demonstrate a resonance sweep from chest to head with clear placement shifts.',
      'Sustain a note in each resonator for 5 seconds with consistent placement.',
    ],
    nextSteps: ['Register Blending', 'Vowel Blending'],
  },
  'pentatonic-runs': {
    readTitle: 'What Is the Pentatonic Scale?',
    readBody:
      'The pentatonic scale is a five-note scale (notes 1, 2, 3, 5, and 6 of the major scale). Because it avoids semitone intervals, it always sounds consonant — you can sing almost any pattern with it and it will sound good. The pentatonic scale is the foundation for vocal agility training because the gaps between notes (whole tones and minor thirds) are comfortable to sing at speed. Master the 5-note pattern in one octave, then extend it across two octaves.',
    readAudio: [
      { label: 'Play the C major pentatonic (C4-D4-E4-G4-A4)', notes: [60, 62, 64, 67, 69], oscillatorType: 'triangle' },
      { label: 'Play a two-octave pentatonic run', notes: [60, 62, 64, 67, 69, 72, 74, 76, 79, 81], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Pentatonic Runs',
    practiceMethods: [
      'Sing the 5-note ascending and descending pattern slowly: C-D-E-G-A-G-E-D-C. Repeat until every note is clean.',
      'Gradually increase speed only when the slow version is accurate — speed without accuracy builds bad habits.',
      'Try the same pattern starting on different notes (D, E, F, G) to build transferable muscle memory.',
    ],
    anchorSong: 'Amazing Grace',
    anchorDescription: 'Amazing Grace uses only pentatonic notes — practice singing it fast for agility training.',
    practiceAudio: [
      { label: 'Play a fast pentatonic run', notes: [60, 62, 64, 67, 69, 67, 64, 62, 60], oscillatorType: 'triangle' },
    ],
    targetLevel: 'Harmony',
    prerequisites: ['Dexterity Drills (basic agility at slow tempo)', 'Scale Degrees.'],
    learningOutcomes: [
      'Sing the pentatonic scale accurately across one and two octaves.',
      'Improvise simple melodic patterns using only pentatonic notes.',
      'Transfer the pentatonic pattern to any starting note.',
    ],
    commonMistakes: [
      'Adding non-pentatonic notes (F or B) by habit — check that you are only using 1, 2, 3, 5, 6.',
      'Rushing tempo before the pattern is clean at slow speed.',
    ],
    masteryCriteria: [
      'Sing a two-octave pentatonic run with 8 out of 10 notes within 10 cents.',
      'Improvise a 4-note pentatonic pattern that stays in key.',
    ],
    nextSteps: ['Part Stability', 'Modulation Missions'],
  },
  'part-stability': {
    readTitle: 'What Is Part Stability?',
    readBody:
      'Part stability is the ability to hold your own harmony line while other singers around you sing different notes. The challenge is that your ear naturally wants to follow the melody — if the melody goes up, you instinctively go up too. To stay stable, you must internalize your part so deeply that it becomes automatic. The key skill is singing your line while a different line plays, without drifting toward it.',
    readAudio: [
      { label: 'Play a melody (C4-E4-G4)', notes: [60, 64, 67], oscillatorType: 'triangle' },
      { label: 'Play a harmony a third above (E4-G4-B4)', notes: [64, 67, 71], oscillatorType: 'sine' },
      { label: 'Play both together', notes: [60, 64, 64, 67, 67, 71], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Part Stability',
    practiceMethods: [
      'Sing a single sustained note (e.g., E4) while a melody plays on a keyboard or recording — do not follow the melody.',
      'Practice with a partner: one sings the melody, the other holds a harmony note. Switch roles.',
      'Record yourself singing your part against the melody, then listen back — did you drift?',
    ],
    anchorSong: 'Lean on Me',
    anchorDescription: 'Sing a third above the melody and hold your line even as the melody moves.',
    practiceAudio: [
      { label: 'Play the Lean on Me melody for stability practice', notes: [60, 60, 60, 60, 65, 65, 65, 65, 67, 67, 67, 67], oscillatorType: 'sine' },
    ],
    targetLevel: 'Harmony',
    prerequisites: ['Third/Fifth Finding (must be able to find and hold a harmony note).'],
    learningOutcomes: [
      'Hold a harmony note for 15+ seconds while a contrasting melody plays.',
      'Resist the instinct to follow the melody when it moves.',
      'Self-monitor for drift and correct mid-phrase.',
    ],
    commonMistakes: [
      "Following the melody unconsciously — record yourself to catch drift you don't notice in the moment.",
      'Tensing up when the melody moves — stay relaxed and trust your part.',
    ],
    masteryCriteria: [
      'Hold a harmony note for 15 seconds with no more than 10 cents of drift.',
      'Stay on your part through a full melodic phrase without following.',
    ],
    nextSteps: ['Vowel Blending', 'SATB Arranging'],
  },
  'satb-arranging': {
    readTitle: 'What Is SATB Arranging?',
    readBody:
      'SATB stands for Soprano, Alto, Tenor, and Bass — the four standard voice parts in a choir. Soprano sings the melody (highest), Alto harmonizes below, Tenor sings the lower harmony, and Bass provides the foundation. As a music director, you need to give each section their starting pitch before a piece begins. This means knowing the chord tones (root, third, fifth) and mapping them to the appropriate voice range. Soprano typically sings the root or melody, Alto the third, Tenor the fifth, and Bass the root an octave down.',
    readAudio: [
      { label: 'Play a C major SATB chord (Bass C3, Tenor G3, Alto E4, Soprano C5)', notes: [48, 55, 64, 72], oscillatorType: 'triangle' },
      { label: 'Play each part separately (Bass, Tenor, Alto, Soprano)', notes: [48, 55, 64, 72], oscillatorType: 'sine' },
    ],
    practiceTitle: 'How to Practice SATB Arranging',
    practiceMethods: [
      'Pick a key (e.g., C major) and sing the root, third, fifth, and octave from memory — these are your SATB pitches.',
      'Practice giving pitches in the correct order: Bass first (lowest), then Tenor, Alto, and Soprano last.',
      'Try arranging a simple melody: assign the melody to Soprano, then find Alto, Tenor, and Bass parts that fit.',
    ],
    anchorSong: 'A C major chord',
    anchorDescription: 'The simplest SATB chord — Soprano on C5, Alto on E4, Tenor on G3, Bass on C3.',
    practiceAudio: [
      { label: 'Play SATB starting pitches for C major (B, T, A, S)', notes: [48, 55, 64, 72], oscillatorType: 'sine' },
    ],
    targetLevel: 'Advanced',
    prerequisites: ['A Cappella Key Starts (must give accurate pitches)', 'Third/Fifth Finding', 'Part Stability.'],
    learningOutcomes: [
      'Map chord tones (root, third, fifth) to SATB voice parts.',
      'Give starting pitches in the correct order and correct octave for each part.',
      'Arrange a simple melody for four voices with proper voice leading.',
    ],
    commonMistakes: [
      'Putting voice parts in the wrong octave — Tenor should be above Bass but below Alto, Soprano on top.',
      'Giving pitches out of order — always start with the lowest part (Bass) so the choir stacks from the bottom up.',
      'Assigning the same chord tone to two parts — each part should have a distinct chord tone.',
    ],
    masteryCriteria: [
      'Give all four SATB starting pitches for a key within 10 cents each.',
      'Arrange a 4-bar melody for SATB with correct voice ranges.',
    ],
    nextSteps: ['Modulation Missions', 'A Cappella Key Starts'],
  },
};

/** Convert a MIDI note array into playable tone sequence entries. */
export function getCourseAudioEntries(
  notes: number[],
  oscillatorType: OscillatorType,
  tempoBpm: number = 120
): { frequency: number; durationMs: number; type: OscillatorType; volume: number }[] {
  const noteDurationMs = (60 / tempoBpm) * 1000 * 0.8;
  return notes.map((midi) => ({
    frequency: midiToFrequency(midi),
    durationMs: noteDurationMs,
    type: oscillatorType,
    volume: 0.2,
  }));
}
