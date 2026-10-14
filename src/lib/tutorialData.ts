/**
 * Tutorial data for each Academy module.
 *
 * Each tutorial follows the "Show, Play, Anchor, Then Try" framework:
 * - title: Friendly lesson name
 * - analogy: A warm, human explanation using everyday imagery
 * - anchorSong: A culturally accessible melody reference
 * - listenNotes: MIDI note frequencies to play as an audio example
 * - listenLabel: What the "Listen to Example" button plays
 *
 * SECURITY: This is static data — no user input, no I/O. The listenNotes
 * are played via the secure useTonePlayer hook (native Web Audio, cleaned up).
 */

import { midiToFrequency } from '@/lib/notes';

export interface TutorialData {
  title: string;
  analogy: string;
  anchorSong: string;
  anchorDescription: string;
  listenNotes: number[];
  listenLabel: string;
  listenType: OscillatorType;
}

const C4 = 60;
const D4 = 62;
const E4 = 64;
const F4 = 65;
const G4 = 67;
const A4 = 69;
const C5 = 72;

export const TUTORIALS: Record<string, TutorialData> = {
  intervals: {
    title: "Steps and Skips",
    analogy: "Imagine walking up stairs. A step is just one stair — a tiny hop. A skip is leaping over a stair — a bigger jump. A 5th is like jumping halfway across the room. And an octave? That is jumping to the very same step on the next flight of stairs — the same note, just higher!",
    anchorSong: "Twinkle Twinkle Little Star",
    anchorDescription: "The first two notes (Twin-kle, twin-kle) are a perfect 5th leap!",
    listenNotes: [C4, G4],
    listenLabel: "Play the Twinkle 5th",
    listenType: "triangle",
  },
  "fine-tuning": {
    title: "Finding the Sweet Spot",
    analogy: "Think of tuning a guitar string like adjusting a picture frame on the wall. Too far left, it looks crooked. Too far right, also crooked. Right in the middle? Perfect and straight! When you sing, your voice can be a tiny bit too high (sharp) or too low (flat). We are looking for that perfect middle spot.",
    anchorSong: "A tuning fork at A4 (440 Hz)",
    anchorDescription: "This is the note orchestras tune to before playing together.",
    listenNotes: [A4],
    listenLabel: "Play the Reference Tone",
    listenType: "sine",
  },
  "scale-degrees": {
    title: "The 7 Steps Home",
    analogy: "Think of a scale like a staircase with 7 steps. Step 1 is your home — it feels like arriving. Step 5 is the middle — it feels like you could go anywhere from here. Step 7 is tiptoes — it is desperate to step up to home (Step 1 again, but higher). Each step has its own personality!",
    anchorSong: "Do-Re-Mi from The Sound of Music",
    anchorDescription: "Each Do-Re-Mi-Fa-Sol-La-Ti-Do walks up all 7 steps.",
    listenNotes: [C4, D4, E4, F4, G4, A4, C5],
    listenLabel: "Play the Full Scale",
    listenType: "triangle",
  },
  "breath-support": {
    title: "The Slow Leak",
    analogy: "Imagine blowing up a balloon, but then letting the air out super slowly through a tiny gap — ssssss. If you push too hard, it bursts out fast. If you do not push enough, it trickles out and stops. We want a nice, steady, slow leak that lasts and lasts. That is breath support!",
    anchorSong: "A slow candle blow (ssss)",
    anchorDescription: "Pretend you are keeping a candle flame flickering but not blowing it out.",
    listenNotes: [],
    listenLabel: "No audio example — this is a mic exercise",
    listenType: "sine",
  },
  "register-blending": {
    title: "The Voice Elevator",
    analogy: "Your voice has floors like a building. The ground floor is your chest voice — deep and strong. The middle floor is your mixed voice — smooth and connected. The top floor is your head voice — light and airy. A great singer can ride the elevator smoothly between all floors without the doors jamming!",
    anchorSong: "A vocal siren (smooth oooh glide)",
    anchorDescription: "Like a fire truck siren but with your voice — smooth up and down.",
    listenNotes: [C4, E4, G4, C5, G4, E4, C4],
    listenLabel: "Play a Siren Example",
    listenType: "sine",
  },
  "dexterity-drills": {
    title: "Vocal Gymnastics",
    analogy: "Think of a pentatonic run like a quick hopscotch game. You only use 5 special squares: 1, 2, 3, 5, and 6. You hop up and then hop back down, fast and light. The more you practice, the faster and smoother your hops become — like a dancer!",
    anchorSong: "Amazing Grace",
    anchorDescription: "Amazing Grace uses only the 5 pentatonic notes — it never sounds wrong!",
    listenNotes: [C4, D4, E4, G4, A4, G4, E4, D4, C4],
    listenLabel: "Play the Pentatonic Run",
    listenType: "triangle",
  },
  "third-fifth-finding": {
    title: "Singing the Other Voice",
    analogy: "Imagine two friends walking together. One walks on the sidewalk (the lead melody). The other walks on the grass, a few steps to the side (the harmony). They are walking at the same pace but on different paths. If the friend on the grass accidentally steps onto the sidewalk, they have lost their own path! We want to stay on the grass — your own harmony line.",
    anchorSong: "Row Row Row Your Boat",
    anchorDescription: "When sung as a round, each voice enters on a different path — that is harmony!",
    listenNotes: [C4, E4, G4],
    listenLabel: "Play a C Major Chord (Root, 3rd, 5th)",
    listenType: "triangle",
  },
  "vowel-blending": {
    title: "Matching Voices",
    analogy: "Imagine a choir where everyone is saying Ah but one person is saying Aee. It sounds like one squeaky wheel in a smooth car. When everyone shapes their mouth the same way — round and warm — the sound blends together like mixing paint into one beautiful color.",
    anchorSong: "A unified Ah vowel",
    anchorDescription: "The round Ah is the most blended vowel sound for choirs.",
    listenNotes: [C4, E4, G4],
    listenLabel: "Play a Blended Chord",
    listenType: "sine",
  },
  "modulation-mission": {
    title: "The Key Change Adventure",
    analogy: "Imagine you are dancing in your living room (that is Key C). Suddenly the music shifts and you feel like you are dancing in the kitchen (that is Key D). The furniture is different, the feeling is different, but you are still dancing! A modulation is when the music packs up and moves to a new home key.",
    anchorSong: "Modulation in pop songs",
    anchorDescription: "Many pop songs shift up a key for the final chorus — it feels like the energy lifts!",
    listenNotes: [C4, C4 + 2],
    listenLabel: "Play C then D (a Whole Step Modulation)",
    listenType: "triangle",
  },
  "a-cappella-key-starts": {
    title: "Finding the First Note",
    analogy: "Imagine you are the leader of a hiking group. Before everyone starts walking, you need to point and say We start here! In a cappella singing, the music director gives the starting pitch — the note that tells everyone where home is before they begin. You can learn to find these notes in your head!",
    anchorSong: "A pitch pipe drone",
    anchorDescription: "A pitch pipe gives one steady note so the whole choir knows where to start.",
    listenNotes: [C4],
    listenLabel: "Play a C4 Reference Drone",
    listenType: "sine",
  },
};

export function getTutorialNotes(tutorial: TutorialData): { frequency: number; durationMs: number; type: OscillatorType; volume: number }[] {
  return tutorial.listenNotes.map((midi) => ({
    frequency: midiToFrequency(midi),
    durationMs: 400,
    type: tutorial.listenType,
    volume: 0.2,
  }));
}
