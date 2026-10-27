import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { Sun, Moon, LogOut, AlertTriangle } from "lucide-react";
import { useDark, useDarkToggle, useColors } from "../context/DarkModeContext";
import { useAuth } from "../context/AuthContext";

type StaffTextScale = 1 | 1.12 | 1.24;
const STAFF_TEXT_SCALE_KEY = "cmms-staff-text-scale-v2";
const LEGACY_STAFF_TEXT_SCALE_KEY = "cmms-staff-text-scale";
const STAFF_TEXT_SCALES: StaffTextScale[] = [1, 1.12, 1.24];

export function PortalLayout() {
  const C = useColors();
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
    <div className="staff-portal" data-text-scale={textScale} style={{ "--staff-text-scale": textScale, fontFamily: C.sans, background: C.bg, color: C.text, minHeight: "100vh", transition: "background 0.2s, color 0.2s" } as React.CSSProperties}>
      {/* Top Application Bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, position: "sticky", top: 0, zIndex: 40, transition: "background 0.2s" }}>
        <div className="portal-header-inner">
          
          {/* Logo & System Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img className="product-mark" src="/assets/branding/cmms-logo-mark.png" alt="" aria-hidden="true" />
            <div>
              <div className="portal-product-title" style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(1rem * var(--staff-text-scale))", color: C.text, lineHeight: 1.1 }}>UiTM CAMS</div>
              <div className="portal-product-subtitle" style={{ fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontFamily: C.mono, color: C.textMuted, letterSpacing: "0.06em", marginTop: "4px" }}>
                {user?.role === 'admin' ? "FACULTY ACADEMIC OPERATIONS" : "LECTURER ASSESSMENT WORKSPACE"}
              </div>
            </div>
          </div>

          {/* User Info & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {user && (
              <div className="portal-user-block" style={{ minHeight: "44px", display: "flex", alignItems: "center", borderRight: `1px solid ${C.border}`, paddingRight: "18px" }}>
                <div className="portal-user-name">
                  <div style={{ fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontWeight: 700, color: C.text }}>{user.name}</div>
                  <div style={{ marginTop: "3px", fontFamily: C.mono, fontSize: "calc(0.6875rem * var(--staff-text-scale))", color: C.textMuted, letterSpacing: ".05em" }}>{user.id} · {user.role.toUpperCase()}</div>
                </div>
              </div>
            )}

            <div className="portal-text-size-control" role="group" aria-label="Text size" style={{ display: "inline-flex", alignItems: "center", padding: "3px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "8px" }}>
              {([
                { label: "A−", scale: 1 as StaffTextScale, title: "Small text size" },
                { label: "A", scale: 1.12 as StaffTextScale, title: "Normal text size" },
                { label: "A+", scale: 1.24 as StaffTextScale, title: "Large accessibility text size" },
              ]).map(option => {
                const active = textScale === option.scale;
                return <button key={option.label} type="button" title={option.title} aria-label={option.title} aria-pressed={active} onClick={() => changeTextScale(option.scale)} style={{ minWidth: "30px", height: "34px", padding: "0 6px", border: 0, borderRadius: "5px", background: active ? C.maroonLight : "transparent", color: active ? C.maroon : C.textSub, fontFamily: C.sans, fontSize: option.scale === 1 ? "calc(0.6875rem * var(--staff-text-scale))" : option.scale === 1.24 ? "calc(0.875rem * var(--staff-text-scale))" : "calc(0.75rem * var(--staff-text-scale))", fontWeight: 700, lineHeight: 1, cursor: "pointer" }}>{option.label}</button>;
              })}
            </div>
            
            <button
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              title={dark ? "Switch to light theme" : "Switch to dark theme"}
              onClick={toggleDark}
              style={{ width: "44px", height: "44px", boxSizing: "border-box", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "8px", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textSub, transition: "all 0.15s" }}
            >
              {dark ? <Sun size={19} color={C.amber} /> : <Moon size={19} color={C.maroon} />}
              <span style={{ display: "none" }}>{dark ? "Light" : "Dark"}</span>
            </button>
            
            <button
              onClick={handleLogout}
              style={{ minHeight: "44px", boxSizing: "border-box", background: "transparent", border: `1px solid ${C.borderMid}`, borderRadius: "8px", padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", color: C.red, fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontFamily: C.sans, fontWeight: 600, transition: "all 0.15s" }}
            >
              <LogOut size={17} />
              <span className="portal-logout-label">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Portal Main Content via Outlet */}
      <main style={{ paddingTop: "24px" }}>
        <Outlet />
      </main>

      {showLogoutConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirmation-title"
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0,0,0,.72)" }}
          onMouseDown={event => {
            if (!loggingOut && event.target === event.currentTarget) setShowLogoutConfirmation(false);
          }}
        >
          <div style={{ width: "100%", maxWidth: "420px", boxSizing: "border-box", padding: "28px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "11px", boxShadow: "0 24px 70px rgba(0,0,0,.35)" }}>
            <div style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", background: C.redLight, marginBottom: "18px" }}>
              <AlertTriangle size={23} color={C.red} />
            </div>
            <h2 id="logout-confirmation-title" style={{ margin: "0 0 8px", color: C.text, fontFamily: C.display, fontSize: "calc(1.3125rem * var(--staff-text-scale))", fontWeight: 700 }}>
              Confirm logout
            </h2>
            <p style={{ margin: "0 0 24px", color: C.textSub, fontSize: "calc(0.8125rem * var(--staff-text-scale))", lineHeight: 1.6 }}>
              Are you sure you want to log out of the staff portal? You will need to enter your staff ID and password again to continue.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setShowLogoutConfirmation(false)}
                style={{ height: "44px", borderRadius: "7px", background: C.elevated, border: `1px solid ${C.borderMid}`, color: C.textSub, cursor: loggingOut ? "not-allowed" : "pointer", fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontFamily: C.sans, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={confirmLogout}
                style={{ height: "44px", borderRadius: "7px", background: C.red, border: "none", color: "#fff", cursor: loggingOut ? "wait" : "pointer", fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontFamily: C.sans, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", opacity: loggingOut ? 0.7 : 1 }}
              >
                <LogOut size={16} />
                {loggingOut ? "Logging out…" : "Log Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
