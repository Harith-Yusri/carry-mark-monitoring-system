// OAuth diagnostics must also work in standalone preview builds. Never log
// callback URLs, sessions, authorization codes, API keys or token values.
function redact(value: string) {
  return value
    .replace(/(?:https?:\/\/|cmms:\/\/)[^\s"'<>]+/gi, url => url.split(/[?#]/)[0])
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]")
    .replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b/g, "[redacted key]")
    .replace(/\b(access_token|refresh_token|id_token|code_verifier|code|apikey|authorization)\s*[:=]\s*[^\s&,]+/gi, "$1=[redacted]");
}

export function logOAuthError(stage: string, reason: unknown) {
  const error = reason as { code?: unknown; message?: unknown; status?: unknown } | null;
  console.warn(`[CAMS OAuth] ${stage}`, {
    code: typeof error?.code === "string" ? redact(error.code) : null,
    message: redact(typeof error?.message === "string" ? error.message : String(reason)),
    status: typeof error?.status === "number" ? error.status : null,
  });
}
