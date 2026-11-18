import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { Bell, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { LoadingState, RefreshStatus } from "../../components/StaffDataState";
import { LecturerNotificationStore } from "../../services/lecturerNotificationStore";
import { subscribeLecturerNotifications } from "../../services/lecturerNotifications";
import { workspace as W } from "./workspaceStyles";

const NotificationsContext = createContext<LecturerNotificationStore | null>(null);
export const useLecturerNotificationStore = () => useContext(NotificationsContext);
export function LecturerNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const authId = user?.role === "lecturer" ? user.authId : null;
  const store = useMemo(() => authId ? new LecturerNotificationStore() : null, [authId]);
  useEffect(() => {
    if (!store || !authId) return;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const fallback = setTimeout(() => void store.refresh(), 1000);
    const stop = subscribeLecturerNotifications(authId, () => {
      clearTimeout(debounce); debounce = setTimeout(() => void store.incoming(), 250);
    }, ready => {
      store.liveStatus(ready);
      if (ready) { clearTimeout(fallback); void store.incoming(); }
    }, store.externalRead);
    const focus = () => { if (document.visibilityState === "visible") void store.refresh(); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    return () => { clearTimeout(fallback); clearTimeout(debounce); stop(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); store.dispose(); };
  }, [store, authId]);
  return <NotificationsContext.Provider value={store}>{children}</NotificationsContext.Provider>;
}
export function LecturerNotificationBell() {
  const store = useLecturerNotificationStore();
  return store ? <NotificationBell store={store} /> : null;
}
function NotificationBell({ store }: { store: LecturerNotificationStore }) {
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  const [show, setShow] = useState(false);
  const [panelTop, setPanelTop] = useState(96);
  const navigate = useNavigate();
  const bell = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const count = state.page?.unread_count;
  useEffect(() => {
    if (!show) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setShow(false); bell.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !bell.current?.contains(event.target as Node)) setShow(false); };
    window.addEventListener("keydown", close); window.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", outside); };
  }, [show]);
  return <div className="relative">
    <button ref={bell} type="button" aria-label={count === undefined ? state.error ? "Notifications unavailable" : "Loading notifications" : `Notifications, ${count} unread`} aria-expanded={show} aria-controls="lecturer-notifications" onClick={() => { setPanelTop((bell.current?.getBoundingClientRect().bottom ?? 88) + 8); setShow(!show); if (!show) void store.refresh(); }} className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20">
      <Bell size={20} aria-hidden="true" />
      {count !== undefined && count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-200 px-1 text-xs font-bold text-slate-900">{count > 99 ? "99+" : count}</span>}
      {count === undefined && !state.error && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-white/70" />}
    </button>
    {show && <section ref={panel} id="lecturer-notifications" aria-label="Lecturer notifications" style={{ "--inbox-top": `${panelTop}px` } as React.CSSProperties} className="staff-content-card fixed left-3 right-3 top-[var(--inbox-top)] z-50 max-h-[min(75dvh,calc(100dvh-var(--inbox-top)-12px))] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-800 shadow-xl dark:border-slate-700 dark:bg-[var(--staff-surface)] dark:text-slate-50 sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-[25rem]">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className={W.title}>Notifications</h2><button type="button" aria-label="Close notifications" className={W.iconButton} onClick={() => { setShow(false); bell.current?.focus(); }}><X size={18} /></button></div>
      {state.error && <p role="alert" className={W.error}>{state.error}</p>}
      {state.page === null && state.loading && <LoadingState label="Loading notifications…" />}
      {state.page && state.loading && <RefreshStatus label="Refreshing notifications…" />}
      {state.liveReady === false && <p className={W.muted}>Live updates are reconnecting. You can refresh notifications.</p>}
      <button type="button" className={W.secondary} disabled={state.loading} onClick={() => void store.refresh(true)}>Refresh notifications</button>
      {state.page && !state.error && state.page.items.length === 0 && <p className={W.muted + " mt-4"}>No mark-issue notifications yet.</p>}
      <ul className="mt-3 space-y-2">{state.page?.items.map(item => <li key={item.id}>
        <button type="button" disabled={state.openingId !== null} className={"w-full break-words rounded-lg border p-3 text-left disabled:opacity-60 " + (item.read_at ? "border-slate-200 dark:border-slate-700" : "border-purple-300 bg-purple-50 dark:border-purple-500 dark:bg-[var(--staff-brand-surface)]")} onClick={() => { setShow(false); navigate(`/lecturer/dashboard?markIssueNotification=${encodeURIComponent(item.id)}`); }}>
          <span className="staff-card-title block font-semibold">{item.data.studentName} {!item.read_at && <span className="ml-2 text-xs">Unread</span>}</span>
          <span className={W.muted + " block"}>{item.data.subjectCode} · {item.data.classLabel}</span>
          <span className={W.muted + " block"}>{item.data.assessmentName}</span>
          <time className={W.muted + " block"} dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
        </button>
      </li>)}</ul>
      {state.page?.has_more && <button type="button" className={W.secondary + " mt-3"} disabled={state.loading || state.loadingMore} onClick={() => void store.loadMore()}>{state.loadingMore ? "Loading older notifications…" : "Load older notifications"}</button>}
    </section>}
  </div>;
}
