/**
 * Song Hub — rehearsal materials management inside the Choir Space.
 *
 * DIRECTOR WORKFLOW (auto-draft + review):
 * 1. Upload an audio file — stored against a unique song ID.
 * 2. Auto-draft phase (parallel):
 *    a. Melody extraction — runs in-browser using autocorrelation pitch
 *       detection on the decoded audio. Produces MIDI notes + confidence.
 *    b. Lyrics search — calls the song-analyze edge function, which searches
 *       the free lyrics.ovh API by artist + title.
 *    c. Key estimation — Krumhansl-Schmuckler algorithm on detected notes.
 *    d. Tonic solfa — derived from the estimated key + melody notes.
 * 3. Review panel shows all results with confidence indicators and
 *    source attribution. The director can edit, retry, or mark sections
 *    as unavailable. Lyrics and melody verification are independent.
 * 4. Director approves and publishes to the choir.
 *
 * MEMBER VIEW: Clean rehearsal player list with status badges.
 *
 * SECURITY:
 * - File uploads validated client-side for audio MIME types.
 * - Uploads go to Supabase Storage (choir-audio bucket) scoped by choir_id.
 * - Local fallback: uses URL.createObjectURL(file) for in-browser playback.
 * - All text rendered via React JSX (no dangerouslySetInnerHTML).
 * - Edge function handles lyrics search server-side with auth + rate limiting.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Music, Play, Pause, FileAudio, Loader2, Save, Trash2, Edit3, X,
  AlertCircle, CheckCircle2, Key, ListMusic, Search, RefreshCw, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { sanitizeText } from '@/lib/validation';
import { extractMelody, type MelodyExtractionResult } from '@/lib/melodyExtractor';
import { estimateKey, deriveSolfa, type KeyEstimate } from '@/lib/solfaUtils';

const ALLOWED_MIME = ['audio/mpeg', 'audio/mp3', 'audio/wav'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const LOCAL_SONGS_KEY = 'vocalis-local-choir-songs';

const MUSICAL_KEYS = [
  'C Major', 'G Major', 'D Major', 'A Major', 'E Major', 'F Major',
  'Bb Major', 'Eb Major', 'A Minor', 'E Minor', 'D Minor', 'G Minor',
  'F# Major', 'C# Major', 'B Major', 'A Minor', 'B Minor', 'F Minor',
];

interface ChoirSong {
  id: string;
  title: string;
  pedagogical_focus: string | null;
  lyrics: string;
  audio_path: string | null;
  processing_status: string;
  processing_error: string | null;
  lyrics_verified: boolean;
  melody_verified: boolean;
  confirmed_key: string | null;
  tonic_solfa: string[] | null;
  created_at: string;
}

interface LocalChoirSong {
  id: string;
  choir_id: string;
  title: string;
  lyrics: string;
  confirmed_key: string | null;
  tonic_solfa: string[] | null;
  processing_status: string;
  lyrics_verified: boolean;
  melody_verified: boolean;
  local_audio_url?: string;
  created_at: string;
}

function loadLocalSongs(choirId: string): LocalChoirSong[] {
  try {
    const raw = localStorage.getItem(LOCAL_SONGS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as LocalChoirSong[]).filter((s) => s.choir_id === choirId);
  } catch { return []; }
}

function saveLocalSong(song: LocalChoirSong): void {
  try {
    const raw = localStorage.getItem(LOCAL_SONGS_KEY);
    const all = raw ? JSON.parse(raw) as LocalChoirSong[] : [];
    const idx = all.findIndex((s) => s.id === song.id);
    if (idx >= 0) all[idx] = song; else all.push(song);
    localStorage.setItem(LOCAL_SONGS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function deleteLocalSong(id: string): void {
  try {
    const raw = localStorage.getItem(LOCAL_SONGS_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as LocalChoirSong[];
    localStorage.setItem(LOCAL_SONGS_KEY, JSON.stringify(all.filter((s) => s.id !== id)));
  } catch { /* ignore */ }
}

type UploadPhase = 'idle' | 'uploading' | 'analyzing' | 'review' | 'saving';

interface DraftResult {
  lyrics: string;
  lyricsSource: string | null;
  lyricsStatus: 'found' | 'not_found' | 'error' | 'pending';
  lyricsMessage: string;
  melodyResult: MelodyExtractionResult | null;
  keyEstimate: KeyEstimate | null;
  solfa: string[];
  artist: string;
}

interface SongHubProps {
  choirId: string;
  isDirector: boolean;
}

export function SongHub({ choirId, isDirector }: SongHubProps) {
  const [choirSongs, setChoirSongs] = useState<ChoirSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSongId, setPendingSongId] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState('');
  const [pendingArtist, setPendingArtist] = useState('');
  const [pendingLyrics, setPendingLyrics] = useState('');
  const [pendingKey, setPendingKey] = useState('');
  const [pendingSolfa, setPendingSolfa] = useState('');
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [pendingStoragePath, setPendingStoragePath] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editLyrics, setEditLyrics] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editSolfa, setEditSolfa] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [lyricsApproved, setLyricsApproved] = useState(false);
  const [melodyApproved, setMelodyApproved] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const loadChoirSongs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        setUsingLocalFallback(true);
        const local = loadLocalSongs(choirId);
        setChoirSongs(local.map((s) => ({
          id: s.id, title: s.title, pedagogical_focus: null, lyrics: s.lyrics,
          audio_path: s.local_audio_url ?? null, processing_status: s.processing_status ?? 'completed',
          processing_error: null, lyrics_verified: s.lyrics_verified ?? false,
          melody_verified: s.melody_verified ?? false, confirmed_key: s.confirmed_key ?? null,
          tonic_solfa: s.tonic_solfa ?? null, created_at: s.created_at,
        })));
        return;
      }
      if (!supabase) { setChoirSongs([]); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setUsingLocalFallback(true);
        const local = loadLocalSongs(choirId);
        setChoirSongs(local.map((s) => ({
          id: s.id, title: s.title, pedagogical_focus: null, lyrics: s.lyrics,
          audio_path: s.local_audio_url ?? null, processing_status: s.processing_status ?? 'completed',
          processing_error: null, lyrics_verified: s.lyrics_verified ?? false,
          melody_verified: s.melody_verified ?? false, confirmed_key: s.confirmed_key ?? null,
          tonic_solfa: s.tonic_solfa ?? null, created_at: s.created_at,
        })));
        return;
      }
      const { data, error: queryError } = await supabase
        .from('choir_songs')
        .select('id, title, pedagogical_focus, lyrics, audio_path, processing_status, processing_error, lyrics_verified, melody_verified, confirmed_key, tonic_solfa, created_at')
        .eq('choir_id', choirId)
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setUsingLocalFallback(false);
      setChoirSongs(data || []);
    } catch {
      setUsingLocalFallback(true);
      const local = loadLocalSongs(choirId);
      setChoirSongs(local.map((s) => ({
        id: s.id, title: s.title, pedagogical_focus: null, lyrics: s.lyrics,
        audio_path: s.local_audio_url ?? null, processing_status: s.processing_status ?? 'completed',
        processing_error: null, lyrics_verified: s.lyrics_verified ?? false,
        melody_verified: s.melody_verified ?? false, confirmed_key: s.confirmed_key ?? null,
        tonic_solfa: s.tonic_solfa ?? null, created_at: s.created_at,
      })));
    } finally {
      setLoading(false);
    }
  }, [choirId]);

  useEffect(() => {
    loadChoirSongs();
  }, [loadChoirSongs]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    };
  }, []);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME.includes(file.type) && !file.name.match(/\.(mp3|wav)$/i)) {
      return 'Only audio files (MP3, WAV) are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) return 'File is too large. Maximum size is 50MB.';
    return null;
  };

  const handleFileSelected = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) { setError(validationError); return; }
    setError(null);

    const songId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'song-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    setPendingFile(file);
    setPendingSongId(songId);
    setPendingTitle(file.name.replace(/\.[^/.]+$/, ''));
    setPendingArtist('');
    setPendingLyrics('');
    setPendingKey('');
    setPendingSolfa('');
    setDraft(null);
    setLyricsApproved(false);
    setMelodyApproved(false);
    setUploadPhase('uploading');

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objUrl = URL.createObjectURL(file);
    objectUrlRef.current = objUrl;
    setPendingAudioUrl(objUrl);

    try {
      if (!supabase) {
        setUsingLocalFallback(true);
        setPendingStoragePath(null);
        await runAutoDraft(file, songId, file.name.replace(/\.[^/.]+$/, ''), '');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setUsingLocalFallback(true);
        setPendingStoragePath(null);
        await runAutoDraft(file, songId, file.name.replace(/\.[^/.]+$/, ''), '');
        return;
      }

      const filePath = `${choirId}/${songId}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('choir-audio')
        .upload(filePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      setPendingStoragePath(filePath);
    } catch (uploadErr) {
      console.warn('Remote upload failed, using local fallback:', uploadErr);
      setUsingLocalFallback(true);
      setPendingStoragePath(null);
    }

    // Run auto-draft analysis regardless of upload method
    await runAutoDraft(file, songId, file.name.replace(/\.[^/.]+$/, ''), '');
  }, [choirId]);

  /**
   * Run the auto-draft analysis pipeline:
   * 1. Extract melody from the audio file (in-browser pitch detection)
   * 2. Estimate the musical key from the detected notes
   * 3. Derive tonic solfa from the key + melody
   * 4. Search for lyrics via the edge function (if title is provided)
   *
   * All results are associated with the specific songId to prevent
   * cross-contamination between songs.
   */
  const runAutoDraft = useCallback(async (file: File, songId: string, title: string, artist: string) => {
    setUploadPhase('analyzing');
    setAnalyzeProgress('Extracting melody from audio...');

    // 1. Melody extraction (in-browser)
    let melodyResult: MelodyExtractionResult | null = null;
    try {
      melodyResult = await extractMelody(file);
    } catch (err) {
      console.warn('Melody extraction failed:', err);
      melodyResult = {
        notes: [],
        averageClarity: 0,
        voicingRatio: 0,
        confidence: 'unreliable',
        assessment: `Melody extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      };
    }

    // 2. Key estimation from detected notes
    setAnalyzeProgress('Estimating musical key...');
    const midiNotes = melodyResult.notes.map((n) => n.midi);
    const keyEstimate = midiNotes.length > 0 ? estimateKey(midiNotes) : null;

    // 3. Derive tonic solfa
    setAnalyzeProgress('Deriving tonic solfa...');
    let solfa: string[] = [];
    if (keyEstimate && midiNotes.length > 0) {
      solfa = deriveSolfa(midiNotes, keyEstimate.key);
    }

    // 4. Lyrics search (edge function) — only if title is provided
    setAnalyzeProgress('Searching for lyrics...');
    let draftResult: DraftResult = {
      lyrics: '',
      lyricsSource: null,
      lyricsStatus: 'pending',
      lyricsMessage: '',
      melodyResult,
      keyEstimate,
      solfa,
      artist,
    };

    if (title.trim().length > 0) {
      try {
        if (!supabase || usingLocalFallback) {
          draftResult.lyricsStatus = 'not_found';
          draftResult.lyricsMessage = 'Sign in to search for lyrics online. You can enter lyrics manually.';
        } else {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            const { data: responseData, error: fnError } = await supabase.functions
              .invoke('song-analyze', {
                body: { songId, title, artist },
              });

            if (fnError) {
              draftResult.lyricsStatus = 'error';
              draftResult.lyricsMessage = `Lyrics search failed: ${fnError.message}`;
            } else if (responseData) {
              if (responseData.status === 'lyrics_found' && responseData.lyrics) {
                draftResult.lyrics = responseData.lyrics;
                draftResult.lyricsSource = responseData.lyricsSource;
                draftResult.lyricsStatus = 'found';
                draftResult.lyricsMessage = responseData.message || 'Lyrics found. Review and approve.';
              } else if (responseData.status === 'lyrics_not_found') {
                draftResult.lyricsStatus = 'not_found';
                draftResult.lyricsMessage = responseData.message || 'Lyrics not found. Enter them manually.';
              } else if (responseData.status === 'needs_input') {
                draftResult.lyricsStatus = 'not_found';
                draftResult.lyricsMessage = responseData.message || 'Enter a title to search for lyrics.';
              }
            }
          } else {
            draftResult.lyricsStatus = 'not_found';
            draftResult.lyricsMessage = 'Sign in to search for lyrics online. You can enter lyrics manually.';
          }
        }
      } catch (err) {
        draftResult.lyricsStatus = 'error';
        draftResult.lyricsMessage = `Lyrics search error: ${err instanceof Error ? err.message : 'unknown'}`;
      }
    } else {
      draftResult.lyricsStatus = 'not_found';
      draftResult.lyricsMessage = 'Enter a song title to search for lyrics.';
    }

    // Populate the editable fields with the draft results
    setPendingLyrics(draftResult.lyrics);
    setPendingKey(keyEstimate?.key ?? '');
    setPendingSolfa(solfa.join('\n'));
    setDraft(draftResult);
    setAnalyzeProgress('');
    setUploadPhase('review');
  }, [usingLocalFallback]);

  const handleSearchLyrics = useCallback(async () => {
    if (!pendingSongId || !pendingTitle.trim()) {
      setError('Enter a song title and artist to search for lyrics.');
      return;
    }
    setAnalyzeProgress('Searching for lyrics...');

    try {
      if (!supabase) {
        setError('Sign in to search for lyrics online.');
        setAnalyzeProgress('');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError('Sign in to search for lyrics online.');
        setAnalyzeProgress('');
        return;
      }

      const { data: responseData, error: fnError } = await supabase.functions
        .invoke('song-analyze', {
          body: { songId: pendingSongId, title: pendingTitle, artist: pendingArtist },
        });

      if (fnError) {
        setError(`Lyrics search failed: ${fnError.message}`);
      } else if (responseData?.status === 'lyrics_found' && responseData.lyrics) {
        setPendingLyrics(responseData.lyrics);
        setDraft((prev) => prev ? {
          ...prev,
          lyrics: responseData.lyrics,
          lyricsSource: responseData.lyricsSource,
          lyricsStatus: 'found',
          lyricsMessage: responseData.message,
        } : null);
        setLyricsApproved(false);
      } else {
        setError(responseData?.message || 'Lyrics not found. Enter them manually.');
      }
    } catch {
      setError('Could not search for lyrics. Please try again.');
    }
    setAnalyzeProgress('');
  }, [pendingSongId, pendingTitle, pendingArtist]);

  const handleReextractMelody = useCallback(async () => {
    if (!pendingFile) return;
    setAnalyzeProgress('Re-extracting melody...');
    try {
      const melodyResult = await extractMelody(pendingFile);
      const midiNotes = melodyResult.notes.map((n) => n.midi);
      const keyEstimate = midiNotes.length > 0 ? estimateKey(midiNotes) : null;
      const solfa = keyEstimate && midiNotes.length > 0 ? deriveSolfa(midiNotes, keyEstimate.key) : [];

      setPendingKey(keyEstimate?.key ?? '');
      setPendingSolfa(solfa.join('\n'));
      setDraft((prev) => prev ? { ...prev, melodyResult, keyEstimate, solfa } : null);
      setMelodyApproved(false);
    } catch {
      setError('Could not re-extract melody. The file may be unsupported.');
    }
    setAnalyzeProgress('');
  }, [pendingFile]);

  const handleSaveAndDeploy = useCallback(async () => {
    if (!pendingFile || !pendingSongId) return;
    const cleanTitle = sanitizeText(pendingTitle, 200);
    if (cleanTitle.length === 0) { setError('Please enter a song title.'); return; }
    setUploadPhase('saving');

    const solfaArray = pendingSolfa
      ? pendingSolfa.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
      : [];

    // Lyrics are verified only if the director explicitly approved them
    const isLyricsVerified = lyricsApproved && pendingLyrics.trim().length > 0;
    // Melody is verified only if the director explicitly approved it
    const isMelodyVerified = melodyApproved && solfaArray.length > 0 && !!pendingKey;
    // Song is completed only if at least lyrics are verified
    const newStatus = isLyricsVerified ? 'completed' : 'review';

    if (usingLocalFallback) {
      const localSong: LocalChoirSong = {
        id: pendingSongId, choir_id: choirId, title: cleanTitle, lyrics: pendingLyrics,
        confirmed_key: pendingKey || null,
        tonic_solfa: solfaArray.length > 0 ? solfaArray : null,
        processing_status: newStatus, lyrics_verified: isLyricsVerified,
        melody_verified: isMelodyVerified,
        local_audio_url: pendingAudioUrl ?? undefined,
        created_at: new Date().toISOString(),
      };
      saveLocalSong(localSong);
      resetPending();
      loadChoirSongs();
      return;
    }

    try {
      if (!supabase) throw new Error('Not connected');
      const { error: insertError } = await supabase
        .from('choir_songs')
        .insert({
          id: pendingSongId, choir_id: choirId, title: cleanTitle, lyrics: pendingLyrics,
          audio_path: pendingStoragePath, confirmed_key: pendingKey || null,
          tonic_solfa: solfaArray.length > 0 ? solfaArray : null,
          processing_status: newStatus, lyrics_verified: isLyricsVerified,
          melody_verified: isMelodyVerified,
        });
      if (insertError) throw insertError;
      resetPending();
      loadChoirSongs();
    } catch (saveErr) {
      console.warn('DB save failed, using local fallback:', saveErr);
      const localSong: LocalChoirSong = {
        id: pendingSongId, choir_id: choirId, title: cleanTitle, lyrics: pendingLyrics,
        confirmed_key: pendingKey || null,
        tonic_solfa: solfaArray.length > 0 ? solfaArray : null,
        processing_status: newStatus, lyrics_verified: isLyricsVerified,
        melody_verified: isMelodyVerified,
        local_audio_url: pendingAudioUrl ?? undefined,
        created_at: new Date().toISOString(),
      };
      saveLocalSong(localSong);
      setUsingLocalFallback(true);
      resetPending();
      loadChoirSongs();
    }
  }, [pendingFile, pendingSongId, pendingTitle, pendingLyrics, pendingKey, pendingSolfa,
      pendingAudioUrl, pendingStoragePath, choirId, loadChoirSongs, usingLocalFallback,
      lyricsApproved, melodyApproved]);

  const resetPending = useCallback(() => {
    setUploadPhase('idle');
    setPendingFile(null);
    setPendingSongId(null);
    setPendingTitle('');
    setPendingArtist('');
    setPendingLyrics('');
    setPendingKey('');
    setPendingSolfa('');
    setPendingAudioUrl(null);
    setPendingStoragePath(null);
    setDraft(null);
    setLyricsApproved(false);
    setMelodyApproved(false);
  }, []);

  const handleCancelUpload = useCallback(() => {
    resetPending();
    setError(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, [resetPending]);

  const handleDeleteSong = useCallback(async (songId: string, audioPath: string | null) => {
    if (usingLocalFallback) {
      deleteLocalSong(songId);
      setChoirSongs((prev) => prev.filter((s) => s.id !== songId));
      return;
    }
    try {
      if (!supabase) throw new Error('Not connected');
      if (audioPath) await supabase.storage.from('choir-audio').remove([audioPath]);
      const { error: deleteError } = await supabase.from('choir_songs').delete().eq('id', songId);
      if (deleteError) throw deleteError;
      setChoirSongs((prev) => prev.filter((s) => s.id !== songId));
    } catch {
      setError('Could not remove the song. Please try again.');
    }
  }, [usingLocalFallback]);

  const handlePlayChoirSong = useCallback(async (song: ChoirSong) => {
    if (playingSongId === song.id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPlayingSongId(null);
      return;
    }
    if (usingLocalFallback || (song.audio_path && song.audio_path.startsWith('blob:'))) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(song.audio_path ?? '');
      audio.onended = () => { setPlayingSongId(null); };
      audio.play().catch(() => setError('Could not play the audio file.'));
      audioRef.current = audio;
      setPlayingSongId(song.id);
      return;
    }
    if (!song.audio_path) { setError('Audio file not available.'); return; }
    try {
      if (!supabase) throw new Error('Not connected');
      const { data, error: urlError } = await supabase.storage
        .from('choir-audio').createSignedUrl(song.audio_path, 3600);
      if (urlError || !data) throw urlError;
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(data.signedUrl);
      audio.onended = () => { setPlayingSongId(null); };
      audio.play();
      audioRef.current = audio;
      setPlayingSongId(song.id);
    } catch {
      setError('Could not play the audio file.');
    }
  }, [playingSongId, usingLocalFallback]);

  const startEditSong = useCallback((song: ChoirSong) => {
    setEditingSongId(song.id);
    setEditLyrics(song.lyrics);
    setEditKey(song.confirmed_key ?? '');
    setEditSolfa(song.tonic_solfa?.join('\n') ?? '');
  }, []);

  const cancelEditSong = useCallback(() => {
    setEditingSongId(null);
    setEditLyrics('');
    setEditKey('');
    setEditSolfa('');
  }, []);

  const saveEditSong = useCallback(async (songId: string) => {
    setSavingEdit(true);
    const solfaArray = editSolfa.split('\n').map((s) => s.trim()).filter(Boolean);
    const newStatus = editLyrics.trim().length > 0 ? 'completed' : 'review';

    // Editing content revokes director verification — re-approval happens
    // through the upload/review flow, not implicitly by saving an edit.
    // Flags are only preserved when the relevant content is unchanged.
    const preserveFlags = (song: { lyrics: string; lyrics_verified: boolean; confirmed_key: string | null; tonic_solfa: string[] | null; melody_verified: boolean }) => {
      const lyricsUnchanged = song.lyrics === editLyrics;
      const melodyUnchanged = song.confirmed_key === (editKey || null) &&
        JSON.stringify(song.tonic_solfa ?? []) === JSON.stringify(solfaArray);
      return {
        lyrics_verified: lyricsUnchanged ? song.lyrics_verified : false,
        melody_verified: melodyUnchanged ? song.melody_verified : false,
      };
    };

    if (usingLocalFallback) {
      const local = loadLocalSongs(choirId);
      const song = local.find((s) => s.id === songId);
      if (song) {
        const flags = preserveFlags(song);
        song.lyrics = editLyrics;
        song.confirmed_key = editKey || null;
        song.tonic_solfa = solfaArray.length > 0 ? solfaArray : null;
        song.processing_status = newStatus;
        song.lyrics_verified = flags.lyrics_verified;
        song.melody_verified = flags.melody_verified;
        saveLocalSong(song);
      }
      setEditingSongId(null);
      setSavingEdit(false);
      loadChoirSongs();
      return;
    }
    try {
      if (!supabase) throw new Error('Not connected');
      const { data: existing, error: fetchError } = await supabase
        .from('choir_songs')
        .select('lyrics, lyrics_verified, confirmed_key, tonic_solfa, melody_verified')
        .eq('id', songId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      const flags = existing ? preserveFlags(existing as { lyrics: string; lyrics_verified: boolean; confirmed_key: string | null; tonic_solfa: string[] | null; melody_verified: boolean }) : { lyrics_verified: false, melody_verified: false };
      const { error: updateError } = await supabase
        .from('choir_songs')
        .update({
          lyrics: editLyrics, confirmed_key: editKey || null,
          tonic_solfa: solfaArray.length > 0 ? solfaArray : null,
          processing_status: newStatus,
          lyrics_verified: flags.lyrics_verified,
          melody_verified: flags.melody_verified,
        }).eq('id', songId);
      if (updateError) throw updateError;
      setEditingSongId(null);
      setSavingEdit(false);
      loadChoirSongs();
    } catch {
      setError('Could not save changes. Please try again.');
      setSavingEdit(false);
    }
  }, [editLyrics, editKey, editSolfa, usingLocalFallback, choirId, loadChoirSongs]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  };

  const statusBadge = (status: string) => {
    if (status === 'completed') return (
      <span className="flex items-center gap-1 rounded-md bg-sage-light border border-sage-DEFAULT px-2 py-0.5 text-[10px] font-medium text-sage-deep">
        <CheckCircle2 className="h-3 w-3" /> Verified
      </span>
    );
    if (status === 'review' || status === 'pending') return (
      <span className="flex items-center gap-1 rounded-md bg-mustard-light border border-mustard-DEFAULT px-2 py-0.5 text-[10px] font-medium text-mustard-deep">
        <AlertCircle className="h-3 w-3" /> Needs review
      </span>
    );
    if (status === 'failed') return (
      <span className="flex items-center gap-1 rounded-md bg-terracotta-light border border-terracotta-DEFAULT px-2 py-0.5 text-[10px] font-medium text-terracotta-deep">
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    );
    return null;
  };

  const confidenceColor = (c: string) => {
    if (c === 'high') return 'text-sage-deep bg-sage-light border-sage-DEFAULT';
    if (c === 'medium') return 'text-mustard-deep bg-mustard-light border-mustard-DEFAULT';
    if (c === 'low') return 'text-terracotta-deep bg-terracotta-light border-terracotta-DEFAULT';
    return 'text-charcoal-muted bg-cream-100 border-cream-400';
  };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep animate-fade-in">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-terracotta-deep/60 hover:text-terracotta-deep">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {usingLocalFallback && isDirector && (
        <div className="rounded-xl bg-mustard-light border border-mustard-DEFAULT px-4 py-2.5 text-xs text-mustard-deep animate-fade-in">
          <strong>Dev Mode:</strong> Songs are saved locally. Melody extraction works, but lyrics search requires sign-in.
        </div>
      )}

      {/* Upload Zone */}
      {isDirector && uploadPhase === 'idle' && (
        <div className="card flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-mustard-deep" />
            <h3 className="font-semibold text-charcoal">Upload Rehearsal Track</h3>
          </div>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              dragActive
                ? 'border-sage-DEFAULT bg-sage-light/30 scale-[1.01]'
                : 'border-cream-400 bg-cream-50 hover:border-sage-DEFAULT/50 hover:bg-cream-100'
            }`}
          >
            <FileAudio className="mx-auto h-10 w-10 text-charcoal-muted/40 mb-3" />
            <p className="text-sm font-medium text-charcoal">Drop an audio file here, or click to browse</p>
            <p className="text-xs text-charcoal-muted mt-1">MP3 or WAV, up to 50MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      )}

      {/* Analyzing phase — shows real progress */}
      {isDirector && uploadPhase === 'analyzing' && (
        <div className="card flex flex-col items-center gap-4 p-8 animate-fade-in">
          <Loader2 className="h-10 w-10 text-sage-deep animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-charcoal">{analyzeProgress || 'Analyzing...'}</p>
            <p className="text-xs text-charcoal-muted mt-1">Extracting melody, estimating key, and searching for lyrics.</p>
          </div>
          {pendingAudioUrl && (
            <audio controls src={pendingAudioUrl} className="w-full mt-2" />
          )}
        </div>
      )}

      {/* Review Panel — auto-draft results with director editing */}
      {isDirector && (uploadPhase === 'review' || uploadPhase === 'saving') && (
        <div className="card flex flex-col gap-5 p-6 animate-fade-in">
          <div className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-mustard-deep" />
            <h3 className="font-semibold text-charcoal">Review & Edit Song</h3>
          </div>

          {/* Song identification section */}
          <div className="rounded-xl bg-cream-100 border border-cream-400/50 p-3 text-xs text-charcoal-muted flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Auto-draft results are shown below. Review each section, edit as needed, and approve
              before publishing. Lyrics and melody are verified independently.
            </span>
          </div>

          {pendingAudioUrl && (
            <audio controls src={pendingAudioUrl} className="w-full" />
          )}

          {/* Title + Artist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal-muted">Song Title</label>
              <input
                type="text"
                value={pendingTitle}
                onChange={(e) => setPendingTitle(e.target.value)}
                maxLength={200}
                className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-charcoal outline-none focus:border-sage-DEFAULT"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal-muted">Artist / Composer (for lyrics search)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pendingArtist}
                  onChange={(e) => setPendingArtist(e.target.value)}
                  maxLength={200}
                  placeholder="e.g., John Newton"
                  className="flex-1 rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-charcoal outline-none focus:border-sage-DEFAULT"
                />
                <button
                  onClick={handleSearchLyrics}
                  disabled={!pendingTitle.trim() || !pendingArtist.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-sage-light border border-sage-DEFAULT px-3 py-2.5 text-xs font-medium text-sage-deep transition-all hover:bg-sage-DEFAULT hover:text-cream-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Search className="h-3.5 w-3.5" /> Search
                </button>
              </div>
            </div>
          </div>

          {/* Lyrics section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-charcoal-muted">Lyrics</label>
              <div className="flex items-center gap-2">
                {draft && draft.lyricsStatus === 'found' && (
                  <span className="text-[10px] text-charcoal-muted">Source: {draft.lyricsSource}</span>
                )}
                {draft && draft.lyricsStatus === 'found' && (
                  <span className="flex items-center gap-1 rounded-md bg-sage-light border border-sage-DEFAULT px-2 py-0.5 text-[10px] font-medium text-sage-deep">
                    <CheckCircle2 className="h-3 w-3" /> Found
                  </span>
                )}
                {draft && draft.lyricsStatus === 'not_found' && (
                  <span className="flex items-center gap-1 rounded-md bg-mustard-light border border-mustard-DEFAULT px-2 py-0.5 text-[10px] font-medium text-mustard-deep">
                    <AlertCircle className="h-3 w-3" /> Not found
                  </span>
                )}
                {draft && draft.lyricsStatus === 'error' && (
                  <span className="flex items-center gap-1 rounded-md bg-terracotta-light border border-terracotta-DEFAULT px-2 py-0.5 text-[10px] font-medium text-terracotta-deep">
                    <AlertCircle className="h-3 w-3" /> Error
                  </span>
                )}
              </div>
            </div>
            <textarea
              value={pendingLyrics}
              onChange={(e) => { setPendingLyrics(e.target.value); setLyricsApproved(false); }}
              rows={8}
              placeholder="Lyrics will appear here after search, or enter them manually..."
              className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-3 text-sm text-charcoal leading-relaxed outline-none focus:border-sage-DEFAULT resize-y"
            />
            {draft && draft.lyricsMessage && (
              <p className="text-[10px] text-charcoal-muted">{draft.lyricsMessage}</p>
            )}
            <label className="flex items-center gap-2 text-xs text-charcoal-muted">
              <input
                type="checkbox"
                checked={lyricsApproved}
                onChange={(e) => setLyricsApproved(e.target.checked)}
                disabled={pendingLyrics.trim().length === 0}
                className="rounded border-cream-400"
              />
              I have reviewed these lyrics and confirm they are correct
            </label>
          </div>

          {/* Melody & Key section */}
          <div className="flex flex-col gap-3 rounded-xl bg-cream-100 border border-cream-400/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-sage-deep" />
                <span className="text-xs font-medium text-charcoal">Melody Analysis</span>
              </div>
              <button
                onClick={handleReextractMelody}
                disabled={!pendingFile}
                className="flex items-center gap-1 text-[10px] text-charcoal-muted hover:text-sage-deep transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Re-extract
              </button>
            </div>

            {draft?.melodyResult ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-medium rounded-md px-2 py-0.5 border ${confidenceColor(draft.melodyResult.confidence)}`}>
                    {draft.melodyResult.confidence} confidence
                  </span>
                  <span className="text-[10px] text-charcoal-muted">
                    {draft.melodyResult.notes.length} notes, {Math.round(draft.melodyResult.averageClarity * 100)}% avg clarity
                  </span>
                </div>
                <p className="text-[10px] text-charcoal-muted leading-relaxed">{draft.melodyResult.assessment}</p>
              </>
            ) : (
              <p className="text-[10px] text-charcoal-muted">No melody analysis available.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-charcoal-muted">Musical Key</label>
                <select
                  value={pendingKey}
                  onChange={(e) => { setPendingKey(e.target.value); setMelodyApproved(false); }}
                  className="rounded-lg bg-cream-50 border border-cream-400 px-3 py-2 text-sm text-charcoal outline-none focus:border-sage-DEFAULT"
                >
                  <option value="">— Select key —</option>
                  {MUSICAL_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                {draft?.keyEstimate && (
                  <p className="text-[10px] text-charcoal-muted">
                    Detected: {draft.keyEstimate.key} ({Math.round(draft.keyEstimate.confidence * 100)}% confidence)
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-charcoal-muted flex items-center gap-1">
                  <ListMusic className="h-3 w-3" /> Tonic Sol-fa (one per line)
                </label>
                <textarea
                  value={pendingSolfa}
                  onChange={(e) => { setPendingSolfa(e.target.value); setMelodyApproved(false); }}
                  rows={4}
                  placeholder={'Doh\nRe\nMi\nSoh\n...'}
                  className="rounded-lg bg-cream-50 border border-cream-400 px-3 py-2 text-sm text-charcoal outline-none focus:border-sage-DEFAULT resize-y font-mono"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-charcoal-muted mt-1">
              <input
                type="checkbox"
                checked={melodyApproved}
                onChange={(e) => setMelodyApproved(e.target.checked)}
                disabled={pendingSolfa.trim().length === 0 || !pendingKey}
                className="rounded border-cream-400"
              />
              I have reviewed the melody and solfa and confirm they are correct
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={handleCancelUpload} className="btn-secondary">
              <X className="h-4 w-4" /> Cancel
            </button>
            <button
              onClick={handleSaveAndDeploy}
              disabled={uploadPhase === 'saving' || pendingTitle.trim().length === 0}
              className="btn-primary flex-1"
            >
              {uploadPhase === 'saving' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save & Deploy to Choir Space
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Rehearsal Player List */}
      <div className="card flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-sage-deep" />
          <h3 className="font-semibold text-charcoal">Rehearsal Materials</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-charcoal-muted animate-spin" />
          </div>
        ) : choirSongs.length === 0 ? (
          <div className="text-center py-8">
            <Music className="mx-auto h-10 w-10 text-charcoal-muted/30 mb-3" />
            <p className="text-sm text-charcoal-muted">
              {isDirector
                ? 'No rehearsal tracks uploaded yet. Drop an audio file above to get started.'
                : 'Your Music Director has not uploaded any rehearsal tracks yet. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {choirSongs.map((song) => (
              <div key={song.id} className="rounded-xl bg-cream-50 border border-cream-400 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlayChoirSong(song)}
                      disabled={!song.audio_path}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-light border border-sage-DEFAULT text-sage-deep transition-all hover:bg-sage-DEFAULT hover:text-cream-50 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {playingSongId === song.id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-charcoal">{song.title}</h4>
                        {statusBadge(song.processing_status)}
                      </div>
                      <div className="flex items-center gap-3">
                        {song.confirmed_key && (
                          <span className="text-[10px] text-charcoal-muted flex items-center gap-0.5">
                            <Key className="h-2.5 w-2.5" /> {song.confirmed_key}
                          </span>
                        )}
                        {song.lyrics_verified && (
                          <span className="text-[10px] text-sage-deep flex items-center gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Lyrics verified
                          </span>
                        )}
                        {song.melody_verified && (
                          <span className="text-[10px] text-sage-deep flex items-center gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Solfa verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isDirector && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditSong(song)}
                        className="text-charcoal-muted hover:text-mustard-deep transition-colors p-1"
                        title="Edit song details"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSong(song.id, song.audio_path)}
                        className="text-charcoal-muted hover:text-terracotta-deep transition-colors p-1"
                        title="Delete song"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {editingSongId === song.id ? (
                  <div className="flex flex-col gap-3 rounded-lg bg-cream-100 border border-cream-400 p-3 animate-fade-in">
                    <div>
                      <label className="text-xs font-medium text-charcoal-muted block mb-1">Lyrics</label>
                      <textarea
                        value={editLyrics}
                        onChange={(e) => setEditLyrics(e.target.value)}
                        rows={6}
                        className="w-full rounded-lg bg-cream-50 border border-cream-400 px-3 py-2 text-sm text-charcoal outline-none focus:border-sage-DEFAULT resize-y"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-charcoal-muted block mb-1">Key</label>
                      <select
                        value={editKey}
                        onChange={(e) => setEditKey(e.target.value)}
                        className="w-full rounded-lg bg-cream-50 border border-cream-400 px-3 py-2 text-sm text-charcoal outline-none focus:border-sage-DEFAULT"
                      >
                        <option value="">— Select key —</option>
                        {MUSICAL_KEYS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-charcoal-muted block mb-1">Tonic Sol-fa (one per line)</label>
                      <textarea
                        value={editSolfa}
                        onChange={(e) => setEditSolfa(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg bg-cream-50 border border-cream-400 px-3 py-2 text-sm text-charcoal outline-none focus:border-sage-DEFAULT resize-y font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={cancelEditSong} className="btn-secondary !py-2 !text-xs">
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                      <button
                        onClick={() => saveEditSong(song.id)}
                        disabled={savingEdit}
                        className="btn-primary !py-2 !text-xs flex-1"
                      >
                        {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {song.audio_path && playingSongId === song.id && (
                      <audio controls src={song.audio_path} autoPlay className="w-full" onEnded={() => setPlayingSongId(null)} />
                    )}
                    {song.lyrics && song.lyrics_verified ? (
                      <pre className="whitespace-pre-wrap font-sans text-xs text-charcoal-light bg-cream-100 rounded-lg p-3 border border-cream-400/50 max-h-40 overflow-y-auto">{song.lyrics}</pre>
                    ) : song.lyrics ? (
                      <div className="rounded-lg bg-mustard-light/30 border border-mustard-DEFAULT/30 p-3 text-xs text-charcoal-muted">
                        Lyrics entered but not yet verified by the director.
                      </div>
                    ) : (
                      <div className="rounded-lg bg-cream-100 border border-cream-400/50 p-3 text-xs text-charcoal-muted">
                        No lyrics entered yet. {isDirector ? 'Click the edit icon to add them.' : 'Ask your Music Director to add lyrics.'}
                      </div>
                    )}
                    {song.tonic_solfa && song.tonic_solfa.length > 0 && song.melody_verified && (
                      <div className="flex flex-wrap gap-1.5 rounded-lg bg-cream-100 border border-cream-400/50 p-2">
                        {song.tonic_solfa.map((s, i) => (
                          <span key={i} className="rounded px-2 py-1 text-[10px] font-medium bg-cream-50 border border-cream-400 text-sage-deep">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {song.processing_status === 'failed' && song.processing_error && (
                      <div className="flex items-start gap-2 rounded-lg bg-terracotta-light border border-terracotta-DEFAULT px-3 py-2 text-xs text-terracotta-deep">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{song.processing_error}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
