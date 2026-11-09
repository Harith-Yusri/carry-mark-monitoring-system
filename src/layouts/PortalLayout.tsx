import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { Sun, Moon, LogOut, AlertTriangle } from "lucide-react";
import { useDark, useDarkToggle } from "../context/DarkModeContext";
import { useAuth } from "../context/AuthContext";

type StaffTextScale = 1 | 1.12 | 1.24;
const STAFF_TEXT_SCALE_KEY = "cmms-staff-text-scale-v2";
const LEGACY_STAFF_TEXT_SCALE_KEY = "cmms-staff-text-scale";
const STAFF_TEXT_SCALES: StaffTextScale[] = [1, 1.12, 1.24];

export function PortalLayout() {
  const dark = useDark();
  const toggleDark = useDarkToggle();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [textScale, setTextScale] = useState<StaffTextScale>(() => {
    try {
      const stored = Number(window.localStorage.getItem(STAFF_TEXT_SCALE_KEY));
      if (STAFF_TEXT_SCALES.includes(stored as StaffTextScale)) return stored as StaffTextScale;

      const legacy = Number(window.localStorage.getItem(LEGACY_STAFF_TEXT_SCALE_KEY));
      const migrated: StaffTextScale = legacy === 1.1 ? 1.24 : legacy === 1 ? 1.12 : 1;
      window.localStorage.setItem(STAFF_TEXT_SCALE_KEY, String(migrated));
      return migrated;
    } catch {
      return 1;
    }
  });

  const changeTextScale = (scale: StaffTextScale) => {
    setTextScale(scale);
    try { window.localStorage.setItem(STAFF_TEXT_SCALE_KEY, String(scale)); }
    catch { /* The preference remains active for this browser session. */ }
  };

  const handleLogout = () => {
    setShowLogoutConfirmation(true);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className={"staff-portal min-h-screen bg-white font-sans text-slate-800 transition-colors dark:bg-[var(--staff-canvas)] dark:text-slate-50 " + (dark ? "dark " : "") + (user?.role === "admin" ? "admin-design" : "")} data-text-scale={textScale}>
      <header className="staff-branded-header portal-typography sticky top-0 z-40 border-b border-white/20 shadow-sm">
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <img className="h-11 w-11 shrink-0 object-contain rounded-lg bg-white shadow-sm" src="/assets/branding/cams-portal-144.webp" alt="" aria-hidden="true" />
            <div><div className="text-base font-bold tracking-tight text-white">CAMS</div><div className="mt-1 hidden text-xs font-medium text-[#DDD2EB] sm:block">{user?.role === "admin" ? "Faculty Academic Operations" : "Lecturer Assessment Workspace"}</div></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user && <div className="mr-2 hidden border-r border-white/20 pr-4 lg:block"><div className="text-sm font-semibold">{user.name}</div><div className="mt-1 text-xs text-[#DDD2EB]">{user.id} · {user.role === "admin" ? "Administrator" : "Lecturer"}</div></div>}
            <div role="group" aria-label="Text size" className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 p-1">
              {([
                { label: "A−", scale: 1 as StaffTextScale, title: "Small text size" },
                { label: "A", scale: 1.12 as StaffTextScale, title: "Normal text size" },
                { label: "A+", scale: 1.24 as StaffTextScale, title: "Large accessibility text size" },
              ]).map(option => {
                const active = textScale === option.scale;
                return <button key={option.label} type="button" title={option.title} aria-label={option.title} aria-pressed={active} onClick={() => changeTextScale(option.scale)} className={"inline-flex min-h-11 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors sm:min-w-11 " + (active ? "bg-[#E9DDF6] text-[#3D185A]" : "text-white hover:bg-white/15")}>{option.label}</button>;
              })}
            </div>
            <button aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleDark} className="staff-theme-toggle inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20">
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button onClick={handleLogout} aria-label="Logout" className="staff-logout-button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200/50 bg-rose-100/10 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-[#DC2626] hover:text-white"><LogOut size={18} /><span className="hidden sm:inline">Logout</span></button>
          </div>
        </div>
      </header>
      <main className="pt-6"><Outlet /></main>
      {showLogoutConfirmation && <div role="dialog" aria-modal="true" aria-labelledby="logout-confirmation-title" className="portal-typography fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-5" onMouseDown={event => { if (!loggingOut && event.target === event.currentTarget) setShowLogoutConfirmation(false); }}>
        <div className="my-auto w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-xl dark:border-[var(--staff-border)] dark:bg-[var(--staff-input)]">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-700"><AlertTriangle size={23} /></div>
          <h2 id="logout-confirmation-title" className="mb-2 text-xl font-bold">Confirm logout</h2>
          <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-300">Are you sure you want to log out of the staff portal? You will need to enter your staff ID and password again to continue.</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={loggingOut} onClick={() => setShowLogoutConfirmation(false)} className="min-h-11 rounded-lg border border-purple-900 bg-transparent px-4 py-2.5 text-sm font-semibold text-purple-900 hover:bg-purple-50 disabled:opacity-50 dark:border-purple-300 dark:text-purple-200 dark:hover:bg-[var(--staff-row-hover)]">Cancel</button>
            <button type="button" disabled={loggingOut} onClick={confirmLogout} className="staff-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"><LogOut size={16} />{loggingOut ? "Logging out…" : "Log Out"}</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
