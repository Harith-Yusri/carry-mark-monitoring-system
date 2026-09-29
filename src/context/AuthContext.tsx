import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Role } from "../types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const LAST_ACTIVITY_KEY = "carrymark.auth.lastActivity";
const INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;

export interface User {
  id: string;
  authId: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  configured: boolean;
  login: (userId: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  configured: isSupabaseConfigured,
  login: async () => { throw new Error("Authentication is not ready."); },
  logout: async () => {},
});

async function loadProfile(authId: string): Promise<User> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("profiles")
    .select("staff_no, full_name, role, is_active")
    .eq("id", authId)
    .single();

  if (error) throw new Error("Your account profile could not be loaded.");
  if (!data.is_active) throw new Error("Your account has been disabled.");
  if (data.role !== "lecturer" && data.role !== "admin") throw new Error("Your account role is invalid.");
  return { id: data.staff_no, authId, name: data.full_name, role: data.role };
}

function readLastActivity(): number | null {
  try {
    const value = window.localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!value) return null;
    const timestamp = Number(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
}

function recordActivity(timestamp = Date.now()) {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
  } catch {
    // Supabase still enforces its server-side session policy if storage is unavailable.
  }
}

function clearActivity() {
  try {
    window.localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // Nothing else to clear when browser storage is unavailable.
  }
}

function isInactive(timestamp = Date.now()) {
  const lastActivity = readLastActivity();
  return lastActivity !== null && (
    timestamp < lastActivity || timestamp - lastActivity >= INACTIVITY_LIMIT_MS
  );
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clearLocalAuthState = useCallback(() => {
    clearActivity();
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    clearLocalAuthState();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  }, [clearLocalAuthState]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const restoreSession = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          clearActivity();
          if (mounted) setUser(null);
          return;
        }
        if (isInactive()) {
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // Local UI/session metadata is still cleared below.
          } finally {
            clearActivity();
            if (mounted) setUser(null);
          }
          return;
        }

        // getUser verifies the restored access token with Supabase Auth instead of
        // trusting browser storage alone. The profile query then rechecks role/status.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user || userData.user.id !== sessionData.session.user.id) {
          throw userError ?? new Error("The saved session is invalid.");
        }
        const profile = await loadProfile(userData.user.id);
        if (mounted) {
          setUser(profile);
          recordActivity();
        }
      } catch {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // Local UI/session metadata is still cleared below.
        } finally {
          clearActivity();
          if (mounted) setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void restoreSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        clearLocalAuthState();
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [clearLocalAuthState]);

  useEffect(() => {
    if (!user) return;
    let lastWrite = readLastActivity() ?? 0;

    const checkAndRecordActivity = () => {
      const now = Date.now();
      if (isInactive(now)) {
        void logout().catch(() => undefined);
        return;
      }
      if (now - lastWrite >= ACTIVITY_WRITE_INTERVAL_MS) {
        recordActivity(now);
        lastWrite = now;
      }
    };

    const checkInactivity = () => {
      if (isInactive()) void logout().catch(() => undefined);
    };

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "focus"];
    activityEvents.forEach(event => window.addEventListener(event, checkAndRecordActivity));
    const timer = window.setInterval(checkInactivity, ACTIVITY_WRITE_INTERVAL_MS);
    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, checkAndRecordActivity));
      window.clearInterval(timer);
    };
  }, [user, logout]);

  const login = async (userId: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured yet.");
    const staffNo = userId.trim();
    if (!/^[a-z0-9._-]{1,100}$/i.test(staffNo)) throw new Error("Enter a valid staff ID.");
    const { data: tokens, error: loginError } = await supabase.functions.invoke("staff-login", { body: { staffNo, password } });
    if (loginError) {
      const details = loginError.context instanceof Response ? await loginError.context.json().catch(() => null) : null;
      throw new Error(details?.error ?? "Unable to sign in. Please try again.");
    }
    if (!tokens?.access_token || !tokens?.refresh_token) throw new Error("Sign in failed.");
    const { data, error } = await supabase.auth.setSession(tokens);
    if (error || !data.user) throw new Error("Sign in failed.");
    let profile: User;
    try { profile = await loadProfile(data.user.id); }
    catch (reason) {
      try { await supabase.auth.signOut({ scope: "local" }); }
      catch { /* Local activity metadata is still cleared below. */ }
      finally { clearActivity(); }
      throw reason;
    }
    if (profile.id.toLowerCase() !== userId.trim().toLowerCase()) {
      try { await supabase.auth.signOut({ scope: "local" }); }
      catch { /* Local activity metadata is still cleared below. */ }
      finally { clearActivity(); }
      throw new Error("This login is not linked to that staff ID.");
    }
    recordActivity();
    setUser(profile);
    return profile;
  };

  return (
    <AuthContext.Provider value={{ user, loading, configured: isSupabaseConfigured, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
