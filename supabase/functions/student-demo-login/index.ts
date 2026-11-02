import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  if (Deno.env.get("DEMO_LOGIN_ENABLED")?.trim().toLowerCase() !== "true") {
    return reply(404, { error: "Demo login is disabled." });
  }

  try {
    const client = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: requiredEnv("DEMO_STUDENT_EMAIL").toLowerCase(),
      password: requiredEnv("DEMO_STUDENT_PASSWORD"),
    });
    if (error || !data.session) {
      console.error("Demo student authentication failed", error?.message ?? "No session returned");
      return reply(503, { error: "The prepared demo account is unavailable." });
    }

    const { data: portal, error: portalError } = await client.rpc("get_my_mobile_portal");
    if (portalError || !portal?.student) {
      console.error("Demo student profile validation failed", portalError?.message ?? "No student profile returned");
      return reply(503, { error: "The prepared demo student profile is unavailable." });
    }

    return reply(200, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (reason) {
    console.error("Demo login configuration failure", reason instanceof Error ? reason.message : String(reason));
    return reply(503, { error: "Demo login is not configured." });
  }
});
