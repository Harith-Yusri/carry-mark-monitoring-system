import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { authStorage } from "@/lib/authStorage";
import { startupLog } from "@/lib/startupLog";
import { sessionLog } from "@/lib/sessionDiagnostics";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const configurationError = !url || !publishableKey
  ? "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local."
  : null;

startupLog(`Supabase configuration read (${configurationError ? "missing" : "available"})`);

export const supabase = createClient(
  url || "https://not-configured.supabase.co",
  publishableKey || "not-configured",
  {
    global: {
      fetch: async (input, init) => {
        const requestUrl = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const path = requestUrl.split("?")[0];
        const refreshing = path.endsWith("/auth/v1/token") && new URL(requestUrl).searchParams.get("grant_type") === "refresh_token";
        if (refreshing) sessionLog("token refresh started");
        const portalRequest = /\/rpc\/get_my_(mobile_portal|student_bootstrap)$/.test(path);
        const started = Date.now();
        if (__DEV__ && portalRequest) console.info("[CAMS Portal HTTP] sending", { rpc: path.split("/").pop() });
        try {
          const response = await fetch(input, init);
          if (refreshing) sessionLog(response.ok ? "token refresh response received" : "token refresh request failed");
          if (__DEV__ && portalRequest) console.info("[CAMS Portal HTTP] response", {
            rpc: path.split("/").pop(), status: response.status, elapsedMs: Date.now() - started,
          });
          return response;
        } catch (reason) {
          if (refreshing) sessionLog("token refresh unavailable; Supabase will handle retry");
          if (__DEV__ && portalRequest) console.warn("[CAMS Portal HTTP] failed", {
            rpc: path.split("/").pop(), elapsedMs: Date.now() - started,
            message: reason instanceof Error ? reason.message : String(reason),
          });
          throw reason;
        }
      },
    },
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);

startupLog("Supabase client created");

AppState.addEventListener("change", state => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
