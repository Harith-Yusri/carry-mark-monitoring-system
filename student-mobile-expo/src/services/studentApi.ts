import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { clearStoredAuth, hasExpiredPersistedSession, recordAuthActivity, setSessionPersistence } from "@/lib/authStorage";
import { configurationError, supabase } from "@/lib/supabase";
import { logOAuthError } from "@/lib/oauthDiagnostics";
import { StudentPortalPayload } from "@/types/portal";

WebBrowser.maybeCompleteAuthSession();

const oauthCompletions = new Map<string, Promise<void>>();

export type RegistrationProgramme = { id: string; code: string; name: string };
export const demoModeEnabled = process.env.EXPO_PUBLIC_DEMO_MODE === "true";
export type StudentOnboardingState = {
  auth_user_id: string;
  email: string;
  student_id: string;
  full_name: string;
  programme_id: string | null;
  current_semester: number | null;
  profile_complete: boolean;
};

export function isStudentEmail(value: string) {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1) === "student.uitm.edu.my";
}

function requireConfiguration() {
  if (configurationError) throw new Error(configurationError);
}

async function requireSession(trace?: <T>(stage: string, operation: () => Promise<T>) => Promise<T>) {
  requireConfiguration();
  const run = trace ?? (async <T>(_stage: string, operation: () => Promise<T>) => operation());
  if (await run("session inactivity check", hasExpiredPersistedSession)) {
    await supabase.auth.signOut({ scope: "local" });
    await clearStoredAuth();
    throw new Error("Your session expired after 7 days of inactivity.");
  }
  const { data, error } = await run("Supabase Auth getSession", () => supabase.auth.getSession());
  if (error) throw error;
  if (!data.session) throw new Error("Your session has expired.");
}

export function getMobileAuthRedirectUri() {
  const configuredScheme = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme;
  if (!scheme) throw new Error("The CAMS mobile authentication scheme is not configured.");
  return Linking.createURL("auth/callback", { scheme });
}

function callbackParams(url: string) {
  const values = new URLSearchParams();
  const queryStart = url.indexOf("?");
  const hashStart = url.indexOf("#");
  if (queryStart >= 0) {
    const queryEnd = hashStart > queryStart ? hashStart : url.length;
    new URLSearchParams(url.slice(queryStart + 1, queryEnd)).forEach((value, key) => values.set(key, value));
  }
  if (hashStart >= 0) {
    new URLSearchParams(url.slice(hashStart + 1)).forEach((value, key) => values.set(key, value));
  }
  return values;
}

function oauthCallback(url: string) {
  const params = callbackParams(url);
  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  {
    let scheme: string | null = null;
    let path: string | null = null;
    try {
      const parsed = new URL(url);
      scheme = parsed.protocol.replace(":", "");
      path = `${parsed.hostname}${parsed.pathname}`;
    } catch { /* The parameter-presence diagnostics below remain useful. */ }
    console.info("[CAMS OAuth] callback", {
      scheme,
      path,
      hasCode: Boolean(code),
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      hasError: params.has("error") || params.has("error_description"),
    });
  }
  return { params, code, accessToken, refreshToken };
}

async function establishGoogleSession(url: string) {
  requireConfiguration();
  const { params, code, accessToken, refreshToken } = oauthCallback(url);
  const callbackError = params.get("error_description") ?? params.get("error");
  if (callbackError) {
    logOAuthError("Provider returned an OAuth callback error", {
      code: params.get("error_code") ?? params.get("error"), message: callbackError,
    });
    if (/UiTM student Google account/i.test(callbackError)) {
      throw new Error("Please sign in using your UiTM student Google account.");
    }
    throw new Error(callbackError);
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logOAuthError("PKCE code exchange failed", error);
      throw error;
    }
    if (!data.session) throw new Error("Supabase did not return a session after the Google code exchange.");
  } else if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      logOAuthError("Implicit token session setup failed", error);
      throw error;
    }
    if (!data.session) throw new Error("Supabase did not establish a session from the Google tokens.");
  } else {
    throw new Error("The Google sign-in response is incomplete. Please try again.");
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    if (error) logOAuthError("Authenticated Google user lookup failed", error);
    throw error ?? new Error("The Google account could not be loaded.");
  }
  const providers = data.user.app_metadata?.providers as string[] | undefined;
  const provider = data.user.app_metadata?.provider as string | undefined;
  if (!isStudentEmail(data.user.email) || (provider !== "google" && !providers?.includes("google"))) {
    await signOut();
    throw new Error("Please sign in using your UiTM student Google account.");
  }
  await recordAuthActivity();
}

export function completeGoogleOAuth(url: string) {
  const params = callbackParams(url);
  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const callbackKey = code ? `code:${code}` : accessToken && refreshToken ? `tokens:${accessToken}:${refreshToken}` : `url:${url}`;
  const existing = oauthCompletions.get(callbackKey);
  if (existing) {
    if (__DEV__) console.info("[CAMS OAuth] duplicate callback ignored");
    return existing;
  }
  const completion = establishGoogleSession(url).catch(reason => {
    logOAuthError("callback processing failed", reason);
    throw reason;
  });
  oauthCompletions.set(callbackKey, completion);
  return completion;
}

export async function signInWithGoogle() {
  requireConfiguration();
  await setSessionPersistence(true);
  const redirectTo = getMobileAuthRedirectUri();
  console.info("[CAMS OAuth] redirectTo", redirectTo);
  console.info("[CAMS OAuth] configuration", {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim(),
    scheme: Constants.expoConfig?.scheme,
    executionEnvironment: Constants.executionEnvironment,
    development: __DEV__,
  });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { hd: "student.uitm.edu.my", prompt: "select_account" },
    },
  });
  if (error) {
    logOAuthError("Authorize URL creation failed", error);
    if (/UiTM student Google account/i.test(error.message)) {
      throw new Error("Please sign in using your UiTM student Google account.");
    }
    throw error;
  }
  if (!data.url) throw new Error("Google sign-in could not be started.");
  {
    const authorizeUrl = new URL(data.url);
    console.info("[CAMS OAuth] authorize", {
      endpoint: `${authorizeUrl.origin}${authorizeUrl.pathname}`,
      provider: authorizeUrl.searchParams.get("provider"),
      redirectTo: authorizeUrl.searchParams.get("redirect_to"),
    });
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.info("[CAMS OAuth] browser result", { type: result.type });
  if (result.type === "cancel" || result.type === "dismiss") return false;
  if (result.type !== "success") throw new Error("Google sign-in did not complete. Please try again.");
  await completeGoogleOAuth(result.url);
  return true;
}

export async function signInAsDemoStudent() {
  requireConfiguration();
  if (!demoModeEnabled) throw new Error("Demo login is disabled.");
  await setSessionPersistence(true);

  const { data, error } = await supabase.functions.invoke("student-demo-login", { body: {} });
  if (error) {
    const details = error.context instanceof Response
      ? await error.context.json().catch(() => null) as { error?: string } | null
      : null;
    throw new Error(details?.error ?? "Demo login is unavailable. Please try again.");
  }
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error("Demo login did not return a valid session.");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError) throw sessionError;
  await recordAuthActivity();
}

export async function loadRegistrationProgrammes() {
  requireConfiguration();
  const { data, error } = await supabase.rpc("get_registration_programmes");
  if (error) throw error;
  return (data ?? []) as RegistrationProgramme[];
}

export async function loadStudentBootstrap() {
  requireConfiguration();
  const { data, error } = await supabase.rpc("get_my_student_bootstrap");
  if (error) throw error;
  const bootstrap = data as unknown as {
    onboarding: StudentOnboardingState | null;
    portal: StudentPortalPayload | null;
  };
  if (!bootstrap?.onboarding) throw new Error("Unable to load your CAMS student profile.");
  return bootstrap;
}

export async function completeStudentProfile(programmeId: string, currentSemester: number) {
  requireConfiguration();
  const { error } = await supabase.rpc("complete_my_student_profile", {
    p_programme_id: programmeId,
    p_current_semester: currentSemester,
  });
  if (error) throw error;
}

export async function signOut() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } finally {
    await clearStoredAuth();
  }
}

export async function loadPortal(signal?: AbortSignal): Promise<StudentPortalPayload> {
  const started = Date.now();
  const trace = async <T>(stage: string, operation: () => Promise<T>): Promise<T> => {
    if (signal?.aborted) throw new Error(`Student portal cancelled before ${stage}`);
    if (__DEV__) console.info("[CAMS Portal] start", { stage, elapsedMs: Date.now() - started });
    try {
      const result = await operation();
      if (signal?.aborted) throw new Error(`Student portal cancelled during ${stage}`);
      if (__DEV__) console.info("[CAMS Portal] resolved", { stage, elapsedMs: Date.now() - started });
      return result;
    } catch (reason) {
      if (__DEV__) console.warn("[CAMS Portal] rejected", {
        stage, elapsedMs: Date.now() - started,
        message: reason instanceof Error ? reason.message : String(reason),
      });
      throw reason;
    }
  };
  await requireSession(trace);
  const { data, error } = await trace("RPC get_my_mobile_portal", async () => {
    const request = supabase.rpc("get_my_mobile_portal");
    const response = await (signal ? request.abortSignal(signal) : request);
    if (response.error) throw response.error;
    return response;
  });
  if (error) throw error;
  if (__DEV__) console.info("[CAMS Portal] payload", {
    elapsedMs: Date.now() - started,
    subjects: (data as StudentPortalPayload)?.subjects?.map(subject => ({
      code: subject.code,
      finalised: subject.is_finalised,
      hasReleasedMarks: subject.is_finalised && subject.carry_mark !== null,
    })),
  });
  // Activity storage must not hold a successfully loaded academic payload back.
  void trace("record auth activity", recordAuthActivity).catch(() => undefined);
  return data as StudentPortalPayload;
}

export async function setNotificationAlertsEnabled(enabled: boolean) {
  await requireSession();
  const { data, error } = await supabase.rpc("set_my_notification_alerts_enabled", { p_enabled: enabled });
  if (error) throw error;
  await recordAuthActivity();
  return data;
}

export async function registerPushDevice(installationId: string, expoPushToken: string, platform: "android" | "ios") {
  await requireSession();
  const { data, error } = await supabase.rpc("register_my_push_device", {
    p_installation_id: installationId,
    p_expo_push_token: expoPushToken,
    p_platform: platform,
  });
  if (error) throw error;
  return data;
}

export async function unregisterPushDevice(installationId: string) {
  await requireSession();
  const { error } = await supabase.rpc("unregister_my_push_device", { p_installation_id: installationId });
  if (error) throw error;
}

export async function sendPushTest() {
  await requireSession();
  const { data, error } = await supabase.functions.invoke("send-student-push", { body: { action: "test" } });
  if (error) {
    const details = error.context instanceof Response
      ? await error.context.json().catch(() => null) as { error?: string } | null
      : null;
    throw new Error(details?.error ?? "Unable to send the test notification.");
  }
  return data as { sent?: number; skipped?: number };
}

export async function joinClass(code: string) {
  await requireSession();
  const { data, error } = await supabase.rpc("join_class_by_code", { invitation_code: code.trim() });
  if (error) throw error;
  if (!data) throw new Error("Invalid or inactive class invitation code");
  await recordAuthActivity();
}

export async function submitMarkDispute(offeringId: string, assessment: string, explanation: string) {
  await requireSession();
  const { error } = await supabase.rpc("submit_mark_dispute", {
    target_offering: offeringId,
    target_assessment: assessment.trim(),
    target_explanation: explanation.trim(),
  });
  if (error) throw error;
  await recordAuthActivity();
}

export async function loadAssignedLecturerWhatsApp(offeringId: string) {
  await requireSession();
  const { data, error } = await supabase.rpc("get_my_lecturer_whatsapp", { target_offering: offeringId });
  if (error) throw error;
  await recordAuthActivity();
  return typeof data === "string" ? data : null;
}
