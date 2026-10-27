import { clearStoredAuth, hasExpiredPersistedSession, recordAuthActivity, setSessionPersistence } from "@/lib/authStorage";
import { configurationError, supabase } from "@/lib/supabase";
import { StudentPortalPayload } from "@/types/portal";

export type RegistrationProgramme = { id: string; code: string; name: string };
export const MOBILE_AUTH_REDIRECT_URI = "cmms://auth/callback";
export type RegistrationInput = {
  fullName: string;
  identifier: string;
  email: string;
  password: string;
  confirmPassword: string;
  programmeId?: string;
  currentSemester?: number;
};

export function isStudentEmail(value: string) {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1) === "student.uitm.edu.my";
}

function requireConfiguration() {
  if (configurationError) throw new Error(configurationError);
}

async function requireSession() {
  requireConfiguration();
  if (await hasExpiredPersistedSession()) {
    await supabase.auth.signOut({ scope: "local" });
    await clearStoredAuth();
    throw new Error("Your session expired after 7 days of inactivity.");
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Your session has expired.");
}

export async function signIn(studentId: string, password: string, keepSignedIn: boolean) {
  requireConfiguration();
  await setSessionPersistence(keepSignedIn);
  const { data: tokens, error } = await supabase.functions.invoke("student-login", {
    body: { studentId: studentId.trim(), password },
  });
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    await supabase.auth.signOut({ scope: "local" });
    await clearStoredAuth();
    throw new Error(details?.error ?? "Unable to sign in. Please try again.");
  }
  if (!tokens?.access_token || !tokens?.refresh_token) throw new Error("Sign in failed.");
  const { error: sessionError } = await supabase.auth.setSession(tokens);
  if (sessionError) throw sessionError;
  await recordAuthActivity();
}

export async function loadRegistrationProgrammes() {
  requireConfiguration();
  const { data, error } = await supabase.rpc("get_registration_programmes");
  if (error) throw error;
  return (data ?? []) as RegistrationProgramme[];
}

function validateRegistration(input: RegistrationInput) {
  const fullName = input.fullName.trim();
  const identifier = input.identifier.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2 || fullName.length > 150) throw new Error("Enter your full name.");
  if (!isStudentEmail(email)) throw new Error("Please use your UiTM student email.");
  if (!/^[A-Z0-9._-]{2,100}$/.test(identifier)) throw new Error("Enter a valid Student ID.");
  if (input.password.length < 8) throw new Error("Password must contain at least 8 characters.");
  if (input.password !== input.confirmPassword) throw new Error("Passwords do not match.");
  if (!input.programmeId) throw new Error("Select your programme.");
  if (!Number.isInteger(input.currentSemester) || input.currentSemester! < 1 || input.currentSemester! > 12) throw new Error("Current semester must be between 1 and 12.");
  return { fullName, identifier, email };
}

export async function registerAccount(input: RegistrationInput) {
  requireConfiguration();
  const values = validateRegistration(input);
  const metadata: Record<string, string | number> = {
    registration_source: "cams-student-registration",
    full_name: values.fullName,
    identifier: values.identifier,
    programme_id: input.programmeId!,
    current_semester: input.currentSemester!,
  };
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: input.password,
    options: { data: metadata, emailRedirectTo: MOBILE_AUTH_REDIRECT_URI },
  });
  if (error) {
    if (/UiTM student email|student registration requires/i.test(error.message)) throw new Error("Please use your UiTM student email.");
    if (/already registered|already been registered|user already exists/i.test(error.message)) throw new Error("That email or Student ID is already registered.");
    if (/database error saving new user|unexpected_failure/i.test(error.message)) throw new Error("That email or Student ID may already be registered. Check your details or contact an administrator.");
    if (/rate limit|too many requests/i.test(error.message)) throw new Error("Too many signup emails were requested. Please wait and try again.");
    if (/password/i.test(error.message)) throw new Error(error.message);
    throw new Error("Unable to create your account. Please check your details and try again.");
  }
  if (data.user && data.user.identities?.length === 0) throw new Error("That email or Student ID is already registered.");
  if (data.session) {
    await supabase.auth.signOut({ scope: "local" });
    throw new Error("Email confirmation is not enabled for this project. Ask an administrator to enable it before registering.");
  }
}

export async function resendSignupConfirmation(emailValue: string) {
  requireConfiguration();
  const email = emailValue.trim().toLowerCase();
  if (!isStudentEmail(email)) {
    throw new Error("Please use your UiTM student email.");
  }
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: MOBILE_AUTH_REDIRECT_URI },
    });
    if (error) throw error;
  } catch (reason) {
    if (__DEV__) console.error("[Signup confirmation resend]", reason);
    const authError = reason as { message?: string; code?: string; status?: number };
    const details = `${authError.code ?? ""} ${authError.message ?? ""}`;
    if (/already.{0,20}(confirmed|verified)|email.{0,20}(confirmed|verified)/i.test(details)) {
      throw new Error("This email is already verified. Please sign in.");
    }
    if (authError.status === 429 || /rate.?limit|too many requests|over_email_send_rate_limit/i.test(details)) {
      throw new Error("Too many verification emails were requested. Please wait before trying again.");
    }
    if (/smtp|email provider|sending confirmation email|email hook|mailer/i.test(details)) {
      throw new Error("Supabase could not deliver the verification email. Please try again later or contact an administrator.");
    }
    if (/redirect|not allowed/i.test(details)) {
      throw new Error("The CAMS verification redirect is not configured correctly. Please contact an administrator.");
    }
    throw new Error("Unable to request a new verification email. Please try again.");
  }

  // Supabase deliberately returns the same successful response for an unknown
  // address and an already-confirmed account. Keep this copy non-enumerating.
  return {
    message: "If this email has a pending CAMS signup, a new verification email has been requested. If it is already verified, please sign in.",
  };
}

function authCallbackParams(url: string) {
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

export async function completeEmailVerification(url: string): Promise<"student"> {
  requireConfiguration();
  const params = authCallbackParams(url);
  const errorCode = params.get("error_code") ?? params.get("error");
  if (errorCode) {
    if (errorCode === "otp_expired" || /expired/i.test(params.get("error_description") ?? "")) {
      throw new Error("This verification link has expired. Request a fresh email below.");
    }
    throw new Error("This verification link is invalid or has already been used. Request a fresh email below.");
  }

  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  } else {
    throw new Error("The verification link is incomplete. Request a fresh email below.");
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) throw error ?? new Error("The verified account could not be loaded.");
  if (!isStudentEmail(data.user.email)) throw new Error("Please use your UiTM student email.");
  return "student";
}

export async function signOut() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } finally {
    await clearStoredAuth();
  }
}

export async function loadPortal(): Promise<StudentPortalPayload> {
  await requireSession();
  const { data, error } = await supabase.rpc("get_my_mobile_portal");
  if (error) throw error;
  await recordAuthActivity();
  return data as StudentPortalPayload;
}

export async function setNotificationAlertsEnabled(enabled: boolean) {
  await requireSession();
  const { data, error } = await supabase.rpc("set_my_notification_alerts_enabled", { p_enabled: enabled });
  if (error) throw error;
  await recordAuthActivity();
  return data;
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
