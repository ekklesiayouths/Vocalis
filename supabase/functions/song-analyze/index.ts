/**
 * Song Analyze edge function — server-side song identification and
 * lyrics retrieval.
 *
 * LYRICS RETRIEVAL:
 * Uses the lyrics.ovh API (free, no API key required) to search for
 * lyrics by artist and title. If lyrics are found, they are returned
 * as a draft for director review. If not found, the function returns
 * a "not_found" status so the client can prompt the director to enter
 * lyrics manually.
 *
 * COPYRIGHT:
 * - lyrics.ovh is a free public API. Lyrics returned are for review
 *   purposes only. The director is responsible for verifying they have
 *   the right to distribute lyrics to their choir.
 * - When lyrics are not available, the function provides source links
 *   so the director can find and enter authorized lyrics.
 *
 * ARCHITECTURE:
 * - This function is called AFTER the audio file is uploaded to Supabase
 *   Storage. It does not handle file uploads directly.
 * - The client provides the song title, artist (optional), and song ID.
 * - Results are associated with the song ID to prevent cross-contamination.
 *
 * SECURITY:
 * - CORS headers on every response.
 * - Authentication required (JWT verified by Supabase).
 * - Input is sanitized server-side.
 * - No external API keys stored — lyrics.ovh requires none.
 * - Rate limited to 10 requests per user per hour.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TITLE_LENGTH = 200;
const MAX_ARTIST_LENGTH = 200;
const RATE_LIMIT_PER_HOUR = 10;

interface AnalyzeRequest {
  songId?: string;
  title?: string;
  artist?: string;
}

function sanitize(input: string, maxLength: number): string {
  return input.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000)
  );

  const { data: existing } = await supabase
    .from("ai_tutor_rate_limits")
    .select("id, request_count")
    .eq("user_id", userId)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (existing) {
    const newCount = existing.request_count + 1;
    if (newCount > RATE_LIMIT_PER_HOUR) return false;
    await supabase
      .from("ai_tutor_rate_limits")
      .update({ request_count: newCount })
      .eq("id", existing.id);
    return true;
  }

  await supabase.from("ai_tutor_rate_limits").insert({
    user_id: userId,
    window_start: windowStart.toISOString(),
    request_count: 1,
  });
  return true;
}

/**
 * Search for lyrics using the free lyrics.ovh API.
 * No API key required. Returns plain text lyrics or null if not found.
 */
async function searchLyrics(
  artist: string,
  title: string,
): Promise<{ lyrics: string | null; source: string; error?: string }> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      return {
        lyrics: null,
        source: "lyrics.ovh",
        error: `Search returned status ${response.status}`,
      };
    }

    const data = await response.json();
    const lyrics = data?.lyrics;

    if (lyrics && typeof lyrics === "string" && lyrics.trim().length > 0) {
      return {
        lyrics: lyrics.trim(),
        source: "lyrics.ovh",
      };
    }

    return {
      lyrics: null,
      source: "lyrics.ovh",
      error: "No lyrics found for this artist/title combination.",
    };
  } catch (err) {
    return {
      lyrics: null,
      source: "lyrics.ovh",
      error: `Search request failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Authentication ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // --- Rate limiting ---
    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const allowed = await checkRateLimit(adminClient, userId);
      if (!allowed) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. You can analyze up to 10 songs per hour.",
            rate_limited: true,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- Input validation ---
    const body = await req.json() as AnalyzeRequest;
    const songId = sanitize(body.songId ?? "", 100);
    const title = sanitize(body.title ?? "", MAX_TITLE_LENGTH);
    const artist = sanitize(body.artist ?? "", MAX_ARTIST_LENGTH);

    if (!songId) {
      return new Response(
        JSON.stringify({ error: "Song ID is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!title) {
      return new Response(
        JSON.stringify({
          songId,
          status: "needs_input",
          message: "A song title is required to search for lyrics. Please enter a title.",
          lyrics: null,
          lyricsSource: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Lyrics search ---
    // Try with the provided artist, or with a generic search if no artist
    const searchArtist = artist || "";

    let lyricsResult: { lyrics: string | null; source: string; error?: string };

    if (searchArtist) {
      lyricsResult = await searchLyrics(searchArtist, title);
    } else {
      // Without an artist, try a few common gospel/choral artists as fallback
      // This is limited — lyrics.ovh requires an artist name
      lyricsResult = {
        lyrics: null,
        source: "lyrics.ovh",
        error: "An artist name is required for lyrics search. Please provide the artist or composer.",
      };
    }

    // --- Build response ---
    if (lyricsResult.lyrics) {
      return new Response(
        JSON.stringify({
          songId,
          status: "lyrics_found",
          lyrics: lyricsResult.lyrics,
          lyricsSource: lyricsResult.source,
          lyricsVerified: false,
          message: "Lyrics retrieved from " + lyricsResult.source + ". Review and approve before publishing.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lyrics not found — provide guidance
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(title + " " + (artist || "") + " lyrics")}`;
    return new Response(
      JSON.stringify({
        songId,
        status: "lyrics_not_found",
        lyrics: null,
        lyricsSource: null,
        searchUrl,
        message: lyricsResult.error ||
          "Lyrics not found in the free lyrics database. You can search for lyrics online or enter them manually.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Something went wrong during song analysis." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
