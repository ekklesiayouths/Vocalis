/**
 * Account deletion edge function.
 *
 * Securely deletes a user's auth account and all associated data.
 * Uses the service-role key to call the Supabase admin API.
 * Requires a valid JWT from the authenticated user making the request.
 *
 * Security:
 * - Verifies the caller's JWT to identify the user
 * - Uses service-role key (never exposed to client) to delete the auth account
 * - The profiles row is deleted via ON DELETE CASCADE FK
 * - All other user data (scores, memberships, etc.) cascades from profiles
 * - Returns a generic error on failure to avoid leaking internals
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller's token to get their user ID
    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
      },
    });

    if (!verifyResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const user = await verifyResponse.json();
    const userId = user.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unable to identify user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete the auth user using the admin API
    // This cascades to profiles (ON DELETE CASCADE) and all dependent data
    const deleteResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
      },
    });

    if (!deleteResponse.ok) {
      const errorBody = await deleteResponse.text();
      console.error("Account deletion failed:", deleteResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: "Unable to delete account. Please contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Account deletion error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
