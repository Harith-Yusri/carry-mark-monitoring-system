import { AppState } from "react-native";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { friendlyError, joinClassError } from "@/lib/errors";
import { startupError, startupLog } from "@/lib/startupLog";
import { supabase } from "@/lib/supabase";
import * as api from "@/services/studentApi";
import { StudentPortalPayload, SubjectResult } from "@/types/portal";

type StudentState = StudentPortalPayload & {
  initializing: boolean;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
};

type StudentContextValue = StudentState & {
  login: (studentId: string, password: string, keepSignedIn: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setNotificationAlertsEnabled: (enabled: boolean) => Promise<boolean>;
  joinClass: (code: string) => Promise<boolean>;
  dispute: (subject: SubjectResult, assessment: string, explanation: string) => Promise<boolean>;
  clearError: () => void;
};

const initial: StudentState = {
  student: null,
  subjects: [],
  notifications: [],
  notifications_enabled: null,
  initializing: true,
  loading: false,
  actionLoading: false,
  error: null,
};

const StudentContext = createContext<StudentContextValue | null>(null);
const AUTH_RESTORE_TIMEOUT_MS = 8000;
const PORTAL_LOAD_TIMEOUT_MS = 15000;

function withStartupTimeout<T>(operation: Promise<T>, label: string, timeoutMs = AUTH_RESTORE_TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out.`)), timeoutMs);
    operation.then(
      value => { clearTimeout(timer); resolve(value); },
      reason => { clearTimeout(timer); reject(reason); },
    );
  });
}

export function StudentProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initial);

  const applyPayload = useCallback((payload: StudentPortalPayload) => {
    setState(current => ({ ...current, ...payload, initializing: false, loading: false, actionLoading: false, error: null }));
  }, []);

  const reset = useCallback((error: string | null = null) => {
    setState({ ...initial, initializing: false, error });
  }, []);

  const refresh = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      startupLog("Student portal load started");
      const payload = await withStartupTimeout(api.loadPortal(), "Student portal load", PORTAL_LOAD_TIMEOUT_MS);
      if (!payload.student) {
        await api.signOut();
        reset("This login is not linked to an active student account.");
        return;
      }
      applyPayload(payload);
      startupLog("Student portal load completed");
    } catch (reason) {
      startupError("Student portal load failed", reason);
      let hasSession = false;
      try {
        const { data } = await withStartupTimeout(supabase.auth.getSession(), "Authentication status check");
        hasSession = Boolean(data.session);
      } catch (sessionReason) {
        startupError("Authentication status check failed after portal load error", sessionReason);
      }
      if (!hasSession) reset(friendlyError(reason));
      else setState(current => ({ ...current, initializing: false, error: friendlyError(reason) }));
    } finally {
      setState(current => ({ ...current, initializing: false, loading: false }));
      startupLog("Student portal startup gate released");
    }
  }, [applyPayload, reset]);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      startupLog("Student provider mounted; authentication restore started");
      try {
        const { data, error: restoreError } = await withStartupTimeout(supabase.auth.getSession(), "Authentication restore");
        if (restoreError) throw restoreError;
        if (!mounted) return;
        startupLog(data.session ? "Persisted session restored" : "No persisted session found");
        if (!data.session) reset(); else await refresh();
      } catch (reason) {
        startupError("Authentication restoration failed", reason);
        if (mounted) reset("Your saved sign-in could not be restored. Please sign in again.");
      } finally {
        if (mounted) setState(current => ({ ...current, initializing: false, loading: false }));
        startupLog("Authentication startup gate released");
      }
    };
    void restore();
    const auth = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") reset();
    });
    return () => {
      mounted = false;
      auth.data.subscription.unsubscribe();
    };
  }, [refresh, reset]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", status => {
      if (status === "active" && state.student) void refresh();
    });
    return () => subscription.remove();
  }, [refresh, state.student]);

  const value = useMemo<StudentContextValue>(() => ({
    ...state,
    clearError: () => setState(current => ({ ...current, error: null })),
    login: async (studentId, password, keepSignedIn) => {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        await api.signIn(studentId, password, keepSignedIn);
        const payload = await api.loadPortal();
        if (!payload.student) {
          await api.signOut();
          reset("This login is not linked to an active student account.");
          return false;
        }
        applyPayload(payload);
        return true;
      } catch (reason) {
        await api.signOut().catch(() => undefined);
        reset(friendlyError(reason));
        return false;
      }
    },
    logout: async () => {
      await api.signOut().catch(() => undefined);
      reset();
    },
    refresh,
    setNotificationAlertsEnabled: async enabled => {
      setState(current => ({ ...current, actionLoading: true, error: null }));
      try {
        await api.setNotificationAlertsEnabled(enabled);
        applyPayload(await api.loadPortal());
        return true;
      } catch (reason) {
        setState(current => ({
          ...current,
          actionLoading: false,
          error: friendlyError(reason, "Push notification preference update failed"),
        }));
        return false;
      }
    },
    joinClass: async code => {
      setState(current => ({ ...current, actionLoading: true, error: null }));
      try {
        await api.joinClass(code);
        applyPayload(await api.loadPortal());
        return true;
      } catch (reason) {
        setState(current => ({ ...current, actionLoading: false, error: joinClassError(reason) }));
        return false;
      }
    },
    dispute: async (subject, assessment, explanation) => {
      setState(current => ({ ...current, actionLoading: true, error: null }));
      try {
        await api.submitMarkDispute(subject.offering_id, assessment, explanation);
        setState(current => ({ ...current, actionLoading: false }));
        return true;
      } catch (reason) {
        setState(current => ({ ...current, actionLoading: false, error: friendlyError(reason) }));
        return false;
      }
    },
  }), [applyPayload, refresh, reset, state]);

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const value = useContext(StudentContext);
  if (!value) throw new Error("useStudent must be used inside StudentProvider");
  return value;
}
