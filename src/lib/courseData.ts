/**
 * Course content for each Academy module — the Read → Practice → Game workflow.
 *
 * Each course entry replaces the old "storybook tutorial" with a structured
 * three-section learning experience:
 * - Section A (Read): A clear, functional explanation of the musical concept.
 *   Not child-like, not clinical — practical and concise.
 * - Section B (Practice): Concrete practice methods and anchor song references.
 * - Section C (Game): Launches the interactive pitch detection game.
 *
 * Audio examples use MIDI note arrays played via the useTonePlayer hook.
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
}

export const COURSES: Record<string, CourseSection> = {
  intervals: {
    readTitle: 'What Is an Interval?',
    readBody:
      'An interval is the physical distance between two pitches, measured in whole steps and half steps. A half step is the smallest distance in Western music (one piano key to the very next key). A whole step is two half steps. Common intervals: a second spans two adjacent scale notes, a third spans three, a fifth spans five, and an octave spans eight. The size of the gap determines how the two notes sound together — small intervals feel close and tense, large intervals feel open and stable.',
    readAudio: [
      { label: 'Play a Major 2nd (C to D)', notes: [60, 62], oscillatorType: 'triangle' },
      { label: 'Play a Major 3rd (C to E)', notes: [60, 64], oscillatorType: 'triangle' },
      { label: 'Play a Perfect 5th (C to G)', notes: [60, 67], oscillatorType: 'triangle' },
      { label: 'Play an Octave (C to C)', notes: [60, 72], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Intervals',
    practiceMethods: [
      'Sing the lower note first, hold it, then leap up to the upper note. Check if you arrived accurately.',
      'Use the opening of "Joy to the World" — the first two notes descend a full octave. Practice singing that descending leap.',
      'Practice ascending seconds (C-D-E-F-G) until each step feels automatic, then try skipping to thirds and fifths.',
    ],
    anchorSong: 'Joy to the World',
    anchorDescription: 'The opening phrase ("Joy to the World") descends a full octave — the largest common interval.',
    practiceAudio: [
      { label: 'Play the Joy to the World opening', notes: [74, 72, 71, 69, 67, 65, 64, 62, 60], oscillatorType: 'triangle' },
    ],
  },
  'fine-tuning': {
    readTitle: 'What Is Pitch Accuracy?',
    readBody:
      'Pitch accuracy means landing exactly on the correct frequency. In music, we measure small deviations in "cents" — 100 cents equals one semitone (a half step). If you sing 10 cents sharp, you are slightly above the target note; 10 cents flat means slightly below. Most people can hear deviations of 15 cents or more. The goal is to sing within about 5 cents of the target, which sounds "in tune" to a choir.',
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
  },
  'scale-degrees': {
    readTitle: 'What Are Scale Degrees?',
    readBody:
      'A scale is a sequence of notes ordered by pitch, typically seven steps plus the octave repeat. Each step has a number (1 through 7) and a solfege name (Do, Re, Mi, Fa, Sol, La, Ti). Scale degree 1 (Do) is the home note — it feels resolved and final. Scale degree 5 (Sol) is the dominant — it feels stable but open. Scale degree 7 (Ti) is the leading tone — it pulls strongly toward 1. Recognizing scale degrees by ear lets you identify any note within a key.',
    readAudio: [
      { label: 'Play the full scale (Do through Do)', notes: [60, 62, 64, 65, 67, 69, 71, 72], oscillatorType: 'triangle' },
      { label: 'Play Scale Degree 1 (Do)', notes: [60], oscillatorType: 'triangle' },
      { label: 'Play Scale Degree 5 (Sol)', notes: [67], oscillatorType: 'triangle' },
      { label: 'Play Scale Degree 7 (Ti)', notes: [71], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Scale Degrees',
    practiceMethods: [
      'Sing the scale up and down while naming each degree number aloud ("1, 2, 3, 4, 5, 6, 7, 8").',
      'Have someone play a random scale degree and try to identify it by number.',
      'Use "As the Deer" — the opening notes move through steps 3-4-5-6, making it a clear scale-degree reference.',
    ],
    anchorSong: 'As the Deer',
    anchorDescription: 'The opening phrase walks up through consecutive scale degrees — sing and label each one.',
    practiceAudio: [
      { label: 'Play the As the Deer opening', notes: [69, 71, 72, 74, 72, 71, 69, 67], oscillatorType: 'triangle' },
    ],
  },
  'breath-support': {
    readTitle: 'What Is Breath Support?',
    readBody:
      'Breath support is the controlled, steady release of air during singing. The diaphragm and abdominal muscles regulate air pressure so the tone stays even from start to finish. Good support means no sudden bursts of air at the start, no trailing off at the end, and consistent volume throughout. The exercise is a sustained "sss" hiss — if the volume stays level for 15+ seconds, your support is working.',
    readAudio: [],
    practiceTitle: 'How to Practice Breath Support',
    practiceMethods: [
      'Inhale deeply through the nose (4 counts), then exhale a steady "sss" hiss for as long as possible.',
      'Keep the hiss at a consistent volume — not louder at the start, not quieter at the end.',
      'Time yourself: aim for 15 seconds, then 20, then 30. The goal is steadiness, not just duration.',
    ],
    anchorSong: 'A slow candle blow (ssss)',
    anchorDescription: 'Pretend you are keeping a candle flame flickering but not blowing it out — steady, gentle air.',
    practiceAudio: [],
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
  },
  'dexterity-drills': {
    readTitle: 'What Is Vocal Dexterity?',
    readBody:
      'Vocal dexterity is the ability to sing rapid, precise sequences of notes cleanly and in tune. It requires coordination between breath, pitch, and articulation. The pentatonic scale (notes 1, 2, 3, 5, 6 of the major scale) is the most common framework for agility drills because it avoids half-step intervals that are harder to navigate at speed. Practicing short patterns slowly, then gradually increasing tempo, builds the muscle memory for fast runs.',
    readAudio: [
      { label: 'Play a pentatonic run (C-D-E-G-A-G-E-D-C)', notes: [60, 62, 64, 67, 69, 67, 64, 62, 60], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Dexterity',
    practiceMethods: [
      'Start slow: sing the 5-note pentatonic pattern at half speed, making sure each note is clean and accurate.',
      'Gradually speed up only when the slow version is perfect — speed without accuracy builds bad habits.',
      'Use "Amazing Grace" — it uses only pentatonic notes, so practicing it builds the same muscle memory.',
    ],
    anchorSong: 'Amazing Grace',
    anchorDescription: 'Amazing Grace uses only the five pentatonic notes — it never sounds wrong and builds agility naturally.',
    practiceAudio: [
      { label: 'Play the Amazing Grace melody', notes: [67, 72, 67, 64, 65, 67, 72, 67, 64, 65, 67, 72, 74, 72, 67, 72, 67, 64, 65, 67, 72, 67, 64, 62, 60], oscillatorType: 'triangle' },
    ],
  },
  'third-fifth-finding': {
    readTitle: 'What Is Harmony?',
    readBody:
      'Harmony is the art of singing a different note that sounds good alongside the melody. The two most common harmony notes are the third (3 scale steps above the melody) and the fifth (5 steps above). A third above the melody creates a sweet, full sound. A fifth below creates a grounded, open sound. The challenge is holding your harmony note steady while the melody moves around you — your ear wants to follow the melody, but your job is to stay on your own path.',
    readAudio: [
      { label: 'Play a C major chord (root, 3rd, 5th)', notes: [60, 64, 67], oscillatorType: 'triangle' },
      { label: 'Play the root then the third above', notes: [60, 64], oscillatorType: 'triangle' },
      { label: 'Play the root then the fifth above', notes: [60, 67], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice 3rd/5th Finding',
    practiceMethods: [
      'Have someone sing or play a melody note, then sing the note a third above it. Check if you are in tune.',
      'Practice holding a single harmony note (e.g., E) while the melody moves (C, D, E, F, G) — do not follow.',
      'Use "Lean on Me" — the melody outlines chord roots, so singing a third or fifth above each note creates instant harmony.',
    ],
    anchorSong: 'Lean on Me',
    anchorDescription: 'The melody moves through chord roots — sing a third above each note for instant harmony.',
    practiceAudio: [
      { label: 'Play the Lean on Me melody', notes: [60, 60, 60, 60, 65, 65, 65, 65, 67, 67, 67, 67], oscillatorType: 'sine' },
    ],
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
  },
  'modulation-mission': {
    readTitle: 'What Is a Modulation?',
    readBody:
      'A modulation is a key change within a piece of music. The most common type is moving up a whole step (e.g., from C major to D major) for the final chorus of a pop song — it creates a lift in energy. To identify a modulation by ear, listen for the moment when the "home note" (the tonic) shifts. The melody will start resolving to a new pitch instead of the original one. The feeling is like the floor moving beneath you — the same melody, but a new gravitational center.',
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
  },
  'pentatonic-runs': {
    readTitle: 'What Is the Pentatonic Scale?',
    readBody:
      'The pentatonic scale is a five-note scale (notes 1, 2, 3, 5, and 6 of the major scale). Because it avoids half-step intervals, it always sounds consonant — you can sing almost any pattern with it and it will sound good. The pentatonic scale is the foundation for vocal agility training because the gaps between notes (whole steps and minor thirds) are comfortable to sing at speed. Master the 5-note pattern in one octave, then extend it across two octaves.',
    readAudio: [
      { label: 'Play the C major pentatonic (C-D-E-G-A)', notes: [60, 62, 64, 67, 69], oscillatorType: 'triangle' },
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
  },
  'part-stability': {
    readTitle: 'What Is Part Stability?',
    readBody:
      'Part stability is the ability to hold your own harmony line while other singers around you sing different notes. The challenge is that your ear naturally wants to follow the melody — if the melody goes up, you instinctively go up too. To stay stable, you must internalize your part so deeply that it becomes automatic. The key skill is singing your line while a different line plays, without drifting toward it.',
    readAudio: [
      { label: 'Play a melody (C-E-G)', notes: [60, 64, 67], oscillatorType: 'triangle' },
      { label: 'Play a harmony a third above (E-G-B)', notes: [64, 67, 71], oscillatorType: 'sine' },
      { label: 'Play both together', notes: [60, 64, 64, 67, 67, 71], oscillatorType: 'triangle' },
    ],
    practiceTitle: 'How to Practice Part Stability',
    practiceMethods: [
      'Sing a single sustained note (e.g., E) while a melody plays on a keyboard or recording — do not follow the melody.',
      'Practice with a partner: one sings the melody, the other holds a harmony note. Switch roles.',
      'Record yourself singing your part against the melody, then listen back — did you drift?',
    ],
    anchorSong: 'Lean on Me',
    anchorDescription: 'Sing a third above the melody and hold your line even as the melody moves.',
    practiceAudio: [
      { label: 'Play the Lean on Me melody for stability practice', notes: [60, 60, 60, 60, 65, 65, 65, 65, 67, 67, 67, 67], oscillatorType: 'sine' },
    ],
  },
  'satb-arranging': {
    readTitle: 'What Is SATB Arranging?',
    readBody:
      'SATB stands for Soprano, Alto, Tenor, and Bass — the four standard voice parts in a choir. Soprano sings the melody (highest), Alto harmonizes below, Tenor sings the lower harmony, and Bass provides the foundation. As a music director, you need to give each section their starting pitch before a piece begins. This means knowing the chord tones (root, third, fifth) and mapping them to the appropriate voice range. Soprano typically sings the root or melody, Alto the third, Tenor the fifth, and Bass the root an octave down.',
    readAudio: [
      { label: 'Play a C major SATB chord (C4-E4-G4-C3)', notes: [48, 67, 64, 60], oscillatorType: 'triangle' },
      { label: 'Play each part separately (Bass, Tenor, Alto, Soprano)', notes: [48, 55, 64, 72], oscillatorType: 'sine' },
    ],
    practiceTitle: 'How to Practice SATB Arranging',
    practiceMethods: [
      'Pick a key (e.g., C major) and sing the root, third, fifth, and octave from memory — these are your SATB pitches.',
      'Practice giving pitches in the correct order: Bass first (lowest), then Tenor, Alto, and Soprano last.',
      'Try arranging a simple melody: assign the melody to Soprano, then find Alto, Tenor, and Bass parts that fit.',
    ],
    anchorSong: 'A C major chord',
    anchorDescription: 'The simplest SATB chord — Soprano on C, Alto on E, Tenor on G, Bass on low C.',
    practiceAudio: [
      { label: 'Play SATB starting pitches for C major', notes: [48, 55, 64, 72], oscillatorType: 'sine' },
    ],
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
