import { Platform } from "react-native";

const startedAt = Date.now();

export function startupLog(step: string) {
  if (__DEV__) console.info(`[Startup:${Platform.OS} +${Date.now() - startedAt}ms] ${step}`);
}

export function startupError(step: string, reason: unknown) {
  if (__DEV__) console.error(`[Startup:${Platform.OS} +${Date.now() - startedAt}ms] ${step}`, reason);
}
