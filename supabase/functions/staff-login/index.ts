import { createClient } from "npm:@supabase/supabase-js@2.114.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const denied = () => reply(401, { error: "Invalid staff ID or password, or too many attempts. If needed, wait 15 minutes before trying again." });
const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  try {
    let body;
    try { body = await request.json(); } catch { return denied(); }
    if (typeof body?.staffNo !== "string" || !/^[a-z0-9._-]{1,100}$/i.test(body.staffNo.trim()) ||
        typeof body?.password !== "string" || !body.password || body.password.length > 4096) return denied();
    const url = requiredEnv("SUPABASE_URL");
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(url, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), options);
    const { data: email, error: lookupError } = await admin.rpc("resolve_staff_login_email", { target_staff_no: body.staffNo });
    if (lookupError) throw new Error(`Staff login lookup failed (${lookupError.code}): ${lookupError.message}`);
    if (!email) return denied();
    // Password verification remains with Supabase Auth; never log credentials.
    const auth = createClient(url, requiredEnv("SUPABASE_ANON_KEY"), options);
    const { data, error } = await auth.auth.signInWithPassword({ email, password: body.password });
    if (error || !data.session) return denied();
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("staff_no,role,is_active").eq("id", data.user.id).single();
    if (profileError || !profile?.is_active || !["admin", "lecturer"].includes(profile.role) ||
        profile.staff_no.toLowerCase() !== body.staffNo.trim().toLowerCase()) return denied();
    return reply(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (error) {
    console.error("staff-login unexpected failure", error instanceof Error ? error.message : String(error));
    return reply(503, { error: "Sign in is temporarily unavailable. Please try again." });
  }
});
