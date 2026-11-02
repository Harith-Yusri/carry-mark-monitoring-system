const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  return new Response(JSON.stringify({
    code: "student_password_login_retired",
    error: "Student password login is no longer available. Continue with your UiTM student Google account.",
  }), { status: 410, headers });
});
