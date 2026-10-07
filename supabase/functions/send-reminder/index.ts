import { createClient } from "npm:@supabase/supabase-js@2.114.0";
import { pendingSections, reminderText } from "./email.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, { error: "Please sign in again." });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return reply(401, { error: "Please sign in again." });
    const { data: admin, error: adminError } = await db.from("profiles")
      .select("role,is_active").eq("id", user.id).single();
    if (adminError || admin?.role !== "admin" || !admin.is_active) {
      return reply(403, { error: "Only active administrators can send reminders." });
    }
    let body;
    try { body = await request.json(); } catch { return reply(400, { error: "Invalid request." }); }
    if (typeof body?.staffNo !== "string" || !body.staffNo.trim() || body.staffNo.length > 100) {
      return reply(400, { error: "A lecturer staff ID is required." });
    }
    const { data: lecturer, error: lecturerError } = await db.from("profiles")
      .select("id,full_name").eq("staff_no", body.staffNo).eq("role", "lecturer").eq("is_active", true).maybeSingle();
    if (lecturerError) throw lecturerError;
    if (!lecturer) return reply(404, { error: "Lecturer not found." });
    // Resolve the recipient from Auth only after verifying administrator access.
    // The privileged key stays on the server; all submission queries still use RLS.
    const authAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: account, error: accountError } = await authAdmin.auth.admin.getUserById(lecturer.id);
    if (accountError) throw accountError;
    const recipient = account.user?.email;
    if (!recipient) return reply(422, { error: "This lecturer has no registered email in Supabase Authentication." });
    const { data: offerings, error: offeringError } = await db.from("subject_offerings")
      .select("id,subject_name_override,programmes(code),subjects(code,name),class_sections(id,label,programmes(code),submissions(status))").eq("lecturer_id", lecturer.id).order("id");
    if (offeringError) throw offeringError;
    const sections = pendingSections(offerings ?? []).sort();
    if (!sections.length) return reply(409, { error: "There are no outstanding class submissions for this lecturer." });
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("REMINDER_FROM_EMAIL");
    if (!apiKey || !from) return reply(503, { error: "Email delivery is not configured. Set RESEND_API_KEY and REMINDER_FROM_EMAIL in Supabase function secrets." });

    // An hourly key prevents duplicate sends on retries, reloads, and concurrent clicks.
    const idempotencyKey = `carry-reminder/${lecturer.id}/${Math.floor(Date.now() / 3600000)}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from, to: [recipient], subject: "Reminder: outstanding carry mark submission", text: reminderText(lecturer.full_name, sections) }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || !result.id) {
      console.error("Reminder provider rejected request", response.status, result.name);
      return reply(502, { error: "Email provider did not accept the reminder. Check the sender verification and recipient in Resend. If their details just changed, try again next hour." });
    }
    return reply(200, { accepted: true, recipient });
  } catch (error) {
    console.error("Reminder failed", error instanceof Error ? error.message : "Database or network error");
    return reply(500, { error: "Unable to send the reminder. Please try again. If this continues, check the function configuration." });
  }
});
