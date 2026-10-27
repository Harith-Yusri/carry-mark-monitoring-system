import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { authStorage } from "@/lib/authStorage";
import { startupLog } from "@/lib/startupLog";

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
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

startupLog("Supabase client created");

AppState.addEventListener("change", state => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
