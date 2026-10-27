function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : String((reason as { message?: unknown } | null)?.message ?? "");
}

export function friendlyError(reason: unknown, developmentContext = "Student app request failed") {
  const message = messageOf(reason);
  if (__DEV__) console.error(`[${developmentContext}]`, reason);
  if (/verify your email|email not confirmed|email address before signing in/i.test(message)) return "Please verify your email address before signing in. Check your inbox for the confirmation email.";
  if (/invalid_credentials|invalid login credentials/i.test(message)) return "Invalid Student ID or password.";
  if (/already enrolled/i.test(message)) return "You are already enrolled in this subject.";
  if (/class is full/i.test(message)) return "This class is full. Please contact your lecturer.";
  if (/invitation code|class code/i.test(message)) return "The class code is invalid or inactive.";
  if (/network|fetch|timeout|unable to resolve host/i.test(message)) return "Unable to connect. Check your internet connection and try again.";
  if (/session expired|not authenticated|jwt/i.test(message)) return "Your session has expired. Please sign in again.";
  return "Something went wrong. Please try again.";
}

export function joinClassError(reason: unknown) {
  const message = messageOf(reason);
  if (__DEV__) console.error(reason);
  if (/different programme|same programme|student and class must belong/i.test(message)) {
    return "You cannot join this class because it belongs to a different programme.";
  }
  if (/already enrolled/i.test(message)) return "You are already enrolled in this subject.";
  if (/class is full/i.test(message)) return "This class is full. Please contact your lecturer.";
  if (/invitation code|class code/i.test(message)) return "The class code is invalid or inactive.";
  if (/session expired|not authenticated|jwt/i.test(message)) return "Your session has expired. Please sign in again.";
  if (/network|fetch|timeout/i.test(message)) return "Unable to connect. Check your internet connection and try again.";
  return "Unable to join this class. Check the class code and try again.";
}
