// Fixed lifecycle labels only: never pass sessions, users, passwords or tokens.
export function sessionLog(step: string) {
  console.info(`[CAMS Session] ${step}`);
}
