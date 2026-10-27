import { requireSupabase } from "../lib/supabase";

export type RegistrationInput = {
  fullName: string;
  identifier: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export function isStaffEmail(value: string) {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1) === "uitm.edu.my";
}

function validate(input: RegistrationInput) {
  const fullName = input.fullName.trim();
  const identifier = input.identifier.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2 || fullName.length > 150) throw new Error("Enter your full name.");
  if (!isStaffEmail(email)) throw new Error("Please use your UiTM staff email.");
  if (!/^[A-Z0-9._-]{2,100}$/.test(identifier)) throw new Error("Enter a valid Staff ID.");
  if (input.password.length < 8) throw new Error("Password must contain at least 8 characters.");
  if (input.password !== input.confirmPassword) throw new Error("Passwords do not match.");
  return { fullName, identifier, email };
}

function signupError(message: string) {
  if (/UiTM staff email|lecturer registration requires/i.test(message)) {
    return new Error("Please use your UiTM staff email.");
  }
  if (/already registered|already been registered|user already exists/i.test(message)) {
    return new Error("That email or Staff ID is already registered.");
  }
  if (/database error saving new user|unexpected_failure/i.test(message)) {
    return new Error("That email or Staff ID may already be registered. Check your details or contact an administrator.");
  }
  if (/rate limit|too many requests/i.test(message)) {
    return new Error("Too many signup emails were requested. Please wait and try again.");
  }
  if (/password/i.test(message)) return new Error(message);
  return new Error("Unable to create your account. Please check your details and try again.");
}

export async function registerAccount(input: RegistrationInput) {
  const values = validate(input);
  const client = requireSupabase();
  const metadata: Record<string, string | number> = {
    registration_source: "cams-lecturer-registration",
    full_name: values.fullName,
    identifier: values.identifier,
  };

  const { data, error } = await client.auth.signUp({
    email: values.email,
    password: input.password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/?verified=1`,
    },
  });
  if (error) throw signupError(error.message);
  // With confirmation enabled, duplicate-email protection may return an
  // obfuscated user with no identity rather than disclosing that email.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error("That email or Staff ID is already registered.");
  }
  if (data.session) {
    await client.auth.signOut({ scope: "local" });
    throw new Error("Email confirmation is not enabled for this project. Ask an administrator to enable it before registering.");
  }
}
