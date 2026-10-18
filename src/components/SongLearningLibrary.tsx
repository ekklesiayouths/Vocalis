/**
 * Song Learning Library — embedded in the Academy with Tonic Sol-fa notation.
 *
 * Displays the 4 core reference songs with:
 * - Sol-fa syllable notation for each melody
 * - Clickable play buttons next to each Sol-fa syllable
 * - Pedagogical focus and lyrics
 *
 * MELODY SOURCE: Data in coreSongs.ts is verified against standard
 * hymn arrangements. Amazing Grace uses the NEW BRITAIN tune in G major.
 * Joy to the World uses the ANTIOCH arrangement in C major.
 *
 * SECURITY: Static data with Sol-fa mappings. Audio uses useTonePlayer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Music, Play, Pause, BookOpen } from 'lucide-react';
import { useTonePlayer } from '@/hooks/useTonePlayer';
import { midiToFrequency } from '@/lib/notes';
import { CORE_SONGS, type CoreSong } from '@/lib/coreSongs';

interface SolFaSong {
  id: string;
  title: string;
  pedagogicalFocus: string;
  lyrics: string;
  /** Sol-fa syllables mapped to MIDI notes for the opening line */
  solfaLine: { syllable: string; midi: number }[];
  fullMelodyMidi: number[];
  tempoBpm: number;
  oscillatorType: OscillatorType;
}

const SOLFA_SONGS: SolFaSong[] = CORE_SONGS.map((song: CoreSong) => ({
  id: song.id,
  title: song.title,
  pedagogicalFocus: song.pedagogicalFocus,
  lyrics: song.lyrics,
  solfaLine: song.melodyMidi.slice(0, 12).map((midi, i) => ({
    syllable: song.solfa[i] ?? '',
    midi,
  })),
  fullMelodyMidi: song.melodyMidi,
  tempoBpm: song.melodyTempoBpm,
  oscillatorType: song.melodyOscillatorType,
}));

function getToneEntries(notes: number[], oscillatorType: OscillatorType, tempoBpm: number) {
  const dur = (60 / tempoBpm) * 1000 * 0.8;
  return notes.map((midi) => ({
    frequency: midiToFrequency(midi),
    durationMs: dur,
    type: oscillatorType,
    volume: 0.2,
  }));
}

export function SongLearningLibrary() {
  const { playSequence, cleanup } = useTonePlayer();
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [playingSyllable, setPlayingSyllable] = useState<string | null>(null);
  const fullTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syllableTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (fullTimeoutRef.current) clearTimeout(fullTimeoutRef.current);
      if (syllableTimeoutRef.current) clearTimeout(syllableTimeoutRef.current);
    };
  }, []);

  const handlePlayFull = useCallback((song: SolFaSong) => {
    const id = `song-${song.id}`;
    if (fullTimeoutRef.current) { clearTimeout(fullTimeoutRef.current); fullTimeoutRef.current = null; }
    if (playingSongId === id) {
      cleanup();
      setPlayingSongId(null);
      return;
    }
    cleanup();
    setPlayingSongId(id);
    const noteDurMs = (60 / song.tempoBpm) * 1000 * 0.8;
    const gapMs = 100;
    playSequence(getToneEntries(song.fullMelodyMidi, song.oscillatorType, song.tempoBpm), { gapMs });
    // Match the actual playback timing (0.8x note duration + gap per note)
    const totalMs = song.fullMelodyMidi.length * (noteDurMs + gapMs);
    fullTimeoutRef.current = setTimeout(() => setPlayingSongId(null), totalMs);
  }, [playingSongId, playSequence, cleanup]);

  const handlePlaySyllable = useCallback((song: SolFaSong, syllable: { syllable: string; midi: number }, index: number) => {
    const id = `${song.id}-${index}`;
    if (syllableTimeoutRef.current) { clearTimeout(syllableTimeoutRef.current); syllableTimeoutRef.current = null; }
    if (playingSyllable === id) {
      cleanup();
      setPlayingSyllable(null);
      return;
    }
    cleanup();
    setPlayingSyllable(id);
    playSequence(getToneEntries([syllable.midi], song.oscillatorType, song.tempoBpm), { gapMs: 0 });
    syllableTimeoutRef.current = setTimeout(() => setPlayingSyllable(null), 800);
  }, [playingSyllable, playSequence, cleanup]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-sage-deep" />
        <h3 className="font-semibold text-charcoal">Song Learning Library</h3>
      </div>
      <p className="text-sm text-charcoal-muted">
        Learn reference songs with Tonic Sol-fa notation. Tap any syllable to hear its pitch, then play the full melody.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SOLFA_SONGS.map((song) => (
          <div key={song.id} className="card flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-charcoal">{song.title}</h4>
              <button
                onClick={() => handlePlayFull(song)}
                className="flex items-center gap-1.5 rounded-xl bg-sage-light border border-sage-DEFAULT px-3 py-1.5 text-xs font-medium text-sage-deep transition-all hover:bg-sage-DEFAULT hover:text-cream-50 active:translate-y-0.5"
              >
                {playingSongId === `song-${song.id}` ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playingSongId === `song-${song.id}` ? 'Stop' : 'Play Full'}
              </button>
            </div>
            <p className="text-xs text-charcoal-muted leading-relaxed">{song.pedagogicalFocus}</p>

            {/* Sol-fa syllable buttons */}
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-cream-100 border border-cream-400/50 p-3">
              {song.solfaLine.map((syllable, i) => {
                const id = `${song.id}-${i}`;
                return (
                  <button
                    key={i}
                    onClick={() => handlePlaySyllable(song, syllable, i)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all active:translate-y-0.5 ${
                      playingSyllable === id
                        ? 'bg-sage-DEFAULT text-cream-50 shadow-paper-sm'
                        : 'bg-cream-50 border border-cream-400 text-sage-deep hover:bg-sage-light'
                    }`}
                  >
                    <span>{syllable.syllable}</span>
                  </button>
                );
              })}
            </div>

            <pre className="whitespace-pre-wrap font-sans text-xs text-charcoal-light bg-cream-100 rounded-lg p-3 border border-cream-400/50">{song.lyrics}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
