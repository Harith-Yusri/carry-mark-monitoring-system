const safeMessages = [
  /already has an offering/i,
  /already enrolled/i,
  /archived academic session data is read-only/i,
  /archived academic semester data is read-only/i,
  /assessment carry weights/i,
  /assessment weightage exceeds/i,
  /cannot be changed while/i,
  /class is full/i,
  /class programme must match/i,
  /current academic session/i,
  /finalised/i,
  /marks are locked/i,
  /programme semester must/i,
  /reopen finalised/i,
  /select an active programme/i,
  /set the total carry-mark/i,
  /subject is inactive/i,
  /weightage must/i,
];

export function userError(reason: unknown, fallback: string): string {
  const message = reason instanceof Error ? reason.message : (reason as { message?: unknown } | null)?.message;
  if (typeof message === "string" && safeMessages.some(pattern => pattern.test(message))) {
    return message.split(" URL:", 1)[0].split(" Headers:", 1)[0];
  }
  if (import.meta.env.DEV) console.error(reason);
  return fallback;
}
