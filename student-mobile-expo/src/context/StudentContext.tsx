import { AppState } from "react-native";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { friendlyError, joinClassError } from "@/lib/errors";
import { startupError, startupLog } from "@/lib/startupLog";
import { supabase } from "@/lib/supabase";
import { logOAuthError } from "@/lib/oauthDiagnostics";
import { sessionLog } from "@/lib/sessionDiagnostics";
import * as api from "@/services/studentApi";
import { StudentPortalPayload } from "@/types/portal";
import { markIssueError, submitStudentMarkIssue } from "@/services/markIssues";

type AuthDestination = "portal" | "onboarding";

type StudentState = StudentPortalPayload & {
  onboarding: api.StudentOnboardingState | null;
  initializing: boolean;
  loading: boolean;
  actionLoading: boolean;
  restoreFailed: boolean;
  error: string | null;
};

type StudentContextValue = StudentState & {
  loginWithGoogle: () => Promise<AuthDestination | false>;
  loginAsDemo: () => Promise<boolean>;
  completeOAuth: (url: string) => Promise<AuthDestination | false>;
  completeProfile: (programmeId: string, currentSemester: number) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  setNotificationAlertsEnabled: (enabled: boolean) => Promise<boolean>;
  joinClass: (code: string) => Promise<boolean>;
  dispute: (enrolmentId: string, assessmentId: string, explanation: string, requestKey: string) => Promise<boolean>;
  clearError: () => void;
};

const initial: StudentState = {
  student: null,
  subjects: [],
  notifications: [],
  notifications_enabled: null,
  onboarding: null,
  initializing: true,
  loading: false,
  actionLoading: false,
  restoreFailed: false,
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

function authError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "";
  if (/UiTM student Google account/i.test(message)) {
    return "Please sign in using your UiTM student Google account.";
  }
  if (/already linked|does not match the linked CAMS Student ID/i.test(message)) {
    return "This Student ID is already linked to another CAMS account. Please contact your faculty administrator.";
  }
  return friendlyError(reason, "Student Google authentication failed");
}

function logAuthFailure(stage: string, reason: unknown) {
  logOAuthError(stage, reason);
}

export function StudentProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initial);
  const refreshFlight = useRef<Promise<boolean> | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  const authGeneration = useRef(0);
  const restoreFlight = useRef<Promise<boolean> | null>(null);

  const applyPayload = useCallback((payload: StudentPortalPayload) => {
    setState(current => ({
      ...current,
      ...payload,
      onboarding: null,
      initializing: false,
      loading: false,
      actionLoading: false,
      restoreFailed: false,
      error: null,
    }));
  }, []);

  const reset = useCallback((error: string | null = null) => {
    authGeneration.current += 1;
    refreshController.current?.abort();
    refreshFlight.current = null;
    restoreFlight.current = null;
    setState({ ...initial, initializing: false, error });
  }, []);

  const loadAuthenticatedStudent = useCallback(async (mode: "google" | "demo" = "google"): Promise<AuthDestination> => {
    const generation = authGeneration.current;
    setState(current => ({ ...current, loading: true, error: null }));
    sessionLog(mode === "demo" ? "student bootstrap (existing demo profile)" : "student bootstrap (Google profile)");
    if (mode === "demo") {
      const payload = await withStartupTimeout(api.loadPortal(), "Demo student portal load", PORTAL_LOAD_TIMEOUT_MS);
      if (generation !== authGeneration.current) throw new Error("Session changed during student bootstrap.");
      if (!payload.student) throw new Error("The prepared demo student profile is unavailable.");
      applyPayload(payload);
      sessionLog("student bootstrap completed");
      return "portal";
    }
    const bootstrap = await withStartupTimeout(
      api.loadStudentBootstrap(),
      "Student portal bootstrap",
      PORTAL_LOAD_TIMEOUT_MS,
    );
    if (generation !== authGeneration.current) throw new Error("Session changed during student bootstrap.");
    const onboarding = bootstrap.onboarding;
    if (!onboarding) throw new Error("Unable to load your CAMS student profile.");
    if (!onboarding.profile_complete) {
      setState(current => ({
        ...current,
        student: null,
        subjects: [],
        notifications: [],
        notifications_enabled: null,
        onboarding,
        initializing: false,
        loading: false,
        actionLoading: false,
        restoreFailed: false,
        error: null,
      }));
      return "onboarding";
    }

    const payload = bootstrap.portal;
    if (!payload?.student) throw new Error("This login is not linked to an active student account.");
    applyPayload(payload);
    sessionLog("student bootstrap completed");
    return "portal";
  }, [applyPayload]);

  const refresh = useCallback((): Promise<boolean> => {
    if (refreshFlight.current) {
      startupLog("Student portal refresh joined existing request");
      return refreshFlight.current;
    }
    const generation = authGeneration.current;
    const controller = new AbortController();
    refreshController.current = controller;
    const started = Date.now();
    const operation = (async () => {
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      startupLog("Student portal load started");
      const payload = await withStartupTimeout(api.loadPortal(controller.signal), "Student portal load", PORTAL_LOAD_TIMEOUT_MS);
      if (generation !== authGeneration.current) return false;
      if (!payload.student) throw new Error("This login is not linked to an active student account.");
      applyPayload(payload);
      startupLog(`Student portal load completed in ${Date.now() - started}ms`);
      return true;
    } catch (reason) {
      controller.abort();
      if (generation !== authGeneration.current) return false;
      startupError("Student portal load failed", reason);
      // SIGNED_OUT owns auth reset. A network timeout alone is not evidence
      // that the authenticated session has ended.
      setState(current => ({ ...current, initializing: false, error: friendlyError(reason) }));
      return false;
    } finally {
      if (generation === authGeneration.current) {
        setState(current => ({ ...current, initializing: false, loading: false }));
      }
      startupLog("Student portal startup gate released");
    }
    })();
    refreshFlight.current = operation;
    void operation.finally(() => {
      if (refreshFlight.current === operation) refreshFlight.current = null;
      if (refreshController.current === controller) refreshController.current = null;
    });
    return operation;
  }, [applyPayload]);

  const restoreSession = useCallback((): Promise<boolean> => {
    if (restoreFlight.current) return restoreFlight.current;
    const generation = authGeneration.current;
    const operation = (async () => {
      setState(current => ({ ...current, initializing: true, loading: true, restoreFailed: false, error: null }));
      startupLog("Student provider mounted; authentication restore started");
      try {
        const { data, error: restoreError } = await withStartupTimeout(supabase.auth.getSession(), "Authentication restore");
        if (restoreError) throw restoreError;
        if (generation !== authGeneration.current) return false;
        if (!data.session) {
          sessionLog("no stored session available");
          reset();
          return false;
        }
        sessionLog("session restored");
        sessionLog("token refresh handled by Supabase when needed");
        const providers = data.session.user.app_metadata?.providers;
        const google = data.session.user.app_metadata?.provider === "google"
          || (Array.isArray(providers) && providers.includes("google"));
        // Demo sessions still use the existing authenticated/RLS-protected
        // portal RPC. They cannot pass the Google-only onboarding RPC.
        await loadAuthenticatedStudent(!google && api.demoModeEnabled ? "demo" : "google");
        return true;
      } catch (reason) {
        startupError("Authentication restoration failed", reason);
        if (generation === authGeneration.current) {
          sessionLog("startup failed; saved session retained for retry");
          setState(current => ({ ...current, restoreFailed: true, error: authError(reason) }));
        }
        return false;
      } finally {
        if (generation === authGeneration.current) setState(current => ({ ...current, initializing: false, loading: false }));
        startupLog("Authentication startup gate released");
      }
    })();
    restoreFlight.current = operation;
    void operation.finally(() => {
      if (restoreFlight.current === operation) restoreFlight.current = null;
    });
    return operation;
  }, [loadAuthenticatedStudent, reset]);

  useEffect(() => {
    const auth = supabase.auth.onAuthStateChange(event => {
      if (event === "TOKEN_REFRESHED") sessionLog("token refresh completed");
      if (event === "SIGNED_OUT") reset();
    });
    void restoreSession();
    return () => {
      auth.data.subscription.unsubscribe();
    };
  }, [restoreSession, reset]);

  const openAuthenticatedStudent = useCallback(async (mode: "google" | "demo" = "google"): Promise<AuthDestination | false> => {
    const generation = authGeneration.current;
    try {
      return await loadAuthenticatedStudent(mode);
    } catch (reason) {
      if (generation !== authGeneration.current) return false;
      logAuthFailure("Student bootstrap failed; authenticated session retained", reason);
      setState(current => ({ ...current, initializing: false, loading: false, actionLoading: false, restoreFailed: true, error: authError(reason) }));
      return false;
    }
  }, [loadAuthenticatedStudent]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", status => {
      if (status === "active" && state.student) void refresh();
    });
    return () => subscription.remove();
  }, [refresh, state.student]);

  const value = useMemo<StudentContextValue>(() => ({
    ...state,
    clearError: () => setState(current => ({ ...current, error: null })),
    loginWithGoogle: async () => {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        if (!(await api.signInWithGoogle())) {
          setState(current => ({ ...current, loading: false }));
          return false;
        }
        return await openAuthenticatedStudent();
      } catch (reason) {
        logAuthFailure("Google sign-in or student profile load failed", reason);
        await api.signOut().catch(() => undefined);
        reset(authError(reason));
        return false;
      }
    },
    loginAsDemo: async () => {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        await api.signInAsDemoStudent();
        return await openAuthenticatedStudent("demo") === "portal";
      } catch (reason) {
        await api.signOut().catch(() => undefined);
        reset(friendlyError(reason, "Student demo login failed"));
        return false;
      }
    },
    completeOAuth: async url => {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        await api.completeGoogleOAuth(url);
        return await openAuthenticatedStudent();
      } catch (reason) {
        logAuthFailure("OAuth callback or student profile load failed", reason);
        await api.signOut().catch(() => undefined);
        reset(authError(reason));
        return false;
      }
    },
    completeProfile: async (programmeId, currentSemester) => {
      setState(current => ({ ...current, actionLoading: true, error: null }));
      try {
        await api.completeStudentProfile(programmeId, currentSemester);
        await loadAuthenticatedStudent();
        return true;
      } catch (reason) {
        setState(current => ({ ...current, actionLoading: false, error: authError(reason) }));
        return false;
      }
    },
    logout: async () => {
      try {
        const push = await import("@/lib/pushNotifications");
        await push.unregisterCurrentPushInstallation();
      } catch (reason) {
        if (__DEV__) console.warn("[CAMS Push] Device unregister failed during logout", reason);
      }
      try {
        await api.signOut();
      } catch (reason) {
        logAuthFailure("Secure sign-out cleanup failed", reason);
        setState(current => ({ ...current, error: "Unable to clear your saved sign-in securely. Please try signing out again." }));
        return;
      }
      reset();
    },
    refresh,
    restoreSession,
    setNotificationAlertsEnabled: async enabled => {
      setState(current => ({ ...current, actionLoading: true, error: null }));
      try {
        await api.setNotificationAlertsEnabled(enabled);
        const push = await import("@/lib/pushNotifications");
        await push.invalidatePushRegistration();
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
    dispute: async (enrolmentId, assessmentId, explanation, requestKey) => {
      setState(current => ({ ...current, actionLoading: true, error: null }));
      try {
        await submitStudentMarkIssue(enrolmentId, assessmentId, explanation, requestKey);
        setState(current => ({ ...current, actionLoading: false }));
        return true;
      } catch (reason) {
        setState(current => ({ ...current, actionLoading: false, error: markIssueError(reason) }));
        return false;
      }
    },
  }), [applyPayload, loadAuthenticatedStudent, openAuthenticatedStudent, refresh, reset, restoreSession, state]);

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const value = useContext(StudentContext);
  if (!value) throw new Error("useStudent must be used inside StudentProvider");
  return value;
}
