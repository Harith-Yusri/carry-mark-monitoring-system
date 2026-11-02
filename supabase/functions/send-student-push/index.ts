import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

type PushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Use POST." });

  try {
    const supabaseUrl = required("SUPABASE_URL");
    const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authorization = request.headers.get("authorization") ?? "";
    const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
    const payload = await request.json().catch(() => ({})) as {
      action?: string;
      type?: string;
      table?: string;
      schema?: string;
      record?: { id?: string; type?: string };
    };

    let notificationId: string | null = null;
    if (payload.action === "test") {
      if (Deno.env.get("PUSH_TEST_ENABLED")?.toLowerCase() !== "true") {
        return json(404, { error: "Push testing is disabled." });
      }
      if (!bearer || bearer === serviceRoleKey) return json(401, { error: "Student authentication is required." });
      const { data: userData, error: userError } = await admin.auth.getUser(bearer);
      if (userError || !userData.user) return json(401, { error: "Student authentication is required." });

      const { data: student } = await admin.from("students")
        .select("id, notification_alerts_enabled")
        .eq("auth_user_id", userData.user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!student) return json(403, { error: "An active student account is required." });
      if (!student.notification_alerts_enabled) return json(409, { error: "Enable Push Notifications in Settings before testing." });

      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: recent } = await admin.from("notifications")
        .select("id")
        .eq("student_id", student.id)
        .eq("type", "push_test")
        .gte("created_at", oneMinuteAgo)
        .limit(1);
      if (recent?.length) return json(429, { error: "Please wait one minute before sending another test." });

      const { data: testNotification, error: insertError } = await admin.from("notifications")
        .insert({
          recipient_id: null,
          student_id: student.id,
          type: "push_test",
          title: "CAMS Test Notification",
          body: "Push notifications are configured for this device.",
          data: { route: "/progress", test: true },
          delivery_status: "pending",
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      notificationId = testNotification.id;
    } else {
      const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET")?.trim();
      if (!bearer || (bearer !== serviceRoleKey && (!webhookSecret || bearer !== webhookSecret))) {
        return json(401, { error: "Webhook authentication failed." });
      }
      if (payload.type !== "INSERT" || payload.schema !== "public" || payload.table !== "notifications") {
        return json(202, { ignored: true });
      }
      if (payload.record?.type !== "marks_released" || !payload.record.id) {
        return json(202, { ignored: true });
      }
      notificationId = payload.record.id;
    }

    const result = await deliverNotification(admin, notificationId);
    if (payload.action === "test" && result.failed) {
      return json(502, { error: "Expo rejected the test push. Check the delivery error in student_push_deliveries and the EAS push credentials.", ...result });
    }
    return json(200, result);
  } catch (reason) {
    console.error("Student push delivery failed", reason instanceof Error ? reason.message : String(reason));
    return json(500, { error: "Push delivery could not be completed." });
  }
});

async function deliverNotification(admin: ReturnType<typeof createClient>, notificationId: string) {
  const { data: notification, error: notificationError } = await admin.from("notifications")
    .select("id, student_id, type, title, body, data")
    .eq("id", notificationId)
    .single();
  if (notificationError || !notification?.student_id) throw notificationError ?? new Error("Student notification not found");

  const { data: student, error: studentError } = await admin.from("students")
    .select("notification_alerts_enabled")
    .eq("id", notification.student_id)
    .eq("is_active", true)
    .single();
  if (studentError) throw studentError;

  const { data: devices, error: deviceError } = await admin.from("student_push_devices")
    .select("id, expo_push_token")
    .eq("student_id", notification.student_id)
    .eq("active", true);
  if (deviceError) throw deviceError;

  if (!student.notification_alerts_enabled || !devices?.length) {
    if (devices?.length) {
      await admin.from("student_push_deliveries").upsert(
        devices.map(device => ({ notification_id: notification.id, device_id: device.id, status: "skipped" })),
        { onConflict: "notification_id,device_id", ignoreDuplicates: true },
      );
    }
    await admin.from("notifications").update({ delivery_status: "skipped" }).eq("id", notification.id);
    return { sent: 0, skipped: devices?.length ?? 0, reason: student.notification_alerts_enabled ? "no_devices" : "preference_disabled" };
  }

  const claimed: { deliveryId: string; deviceId: string; token: string }[] = [];
  for (const device of devices) {
    const { data: delivery, error } = await admin.from("student_push_deliveries")
      .insert({ notification_id: notification.id, device_id: device.id, status: "pending" })
      .select("id")
      .maybeSingle();
    if (!error && delivery) claimed.push({ deliveryId: delivery.id, deviceId: device.id, token: device.expo_push_token });
    else if (error?.code !== "23505") throw error;
  }
  if (!claimed.length) return { sent: 0, duplicate: true };

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN")?.trim();
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(expoAccessToken ? { "Authorization": `Bearer ${expoAccessToken}` } : {}),
    },
    body: JSON.stringify(claimed.map(item => ({
      to: item.token,
      title: notification.title,
      body: notification.body,
      sound: "default",
      priority: "high",
      channelId: "marks-released",
      data: notification.data,
    }))),
  });
  const responseBody = await response.json().catch(() => null) as { data?: PushTicket[] | PushTicket; errors?: unknown } | null;
  if (!response.ok || !responseBody?.data) {
    const message = `Expo Push Service rejected the request (${response.status}).`;
    await Promise.all(claimed.map(item => admin.from("student_push_deliveries").update({
      status: "failed", error_code: "expo_request_failed", error_message: message, updated_at: new Date().toISOString(),
    }).eq("id", item.deliveryId)));
    await admin.from("notifications").update({ delivery_status: "failed" }).eq("id", notification.id);
    throw new Error(message);
  }

  const tickets = Array.isArray(responseBody.data) ? responseBody.data : [responseBody.data];
  let sent = 0;
  for (let index = 0; index < claimed.length; index += 1) {
    const item = claimed[index];
    const ticket = tickets[index];
    const ok = ticket?.status === "ok";
    if (ok) sent += 1;
    await admin.from("student_push_deliveries").update({
      status: ok ? "sent" : "failed",
      expo_ticket_id: ticket?.id ?? null,
      error_code: ticket?.details?.error ?? null,
      error_message: ticket?.message ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", item.deliveryId);
    if (ticket?.details?.error === "DeviceNotRegistered") {
      await admin.from("student_push_devices").update({
        active: false, last_error: "DeviceNotRegistered", updated_at: new Date().toISOString(),
      }).eq("id", item.deviceId);
    }
  }

  await admin.from("notifications").update({
    delivery_status: sent > 0 ? "sent" : "failed",
    sent_at: sent > 0 ? new Date().toISOString() : null,
  }).eq("id", notification.id);
  return { sent, failed: claimed.length - sent };
}
