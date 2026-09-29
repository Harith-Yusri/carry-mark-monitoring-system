import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { Sun, Moon, BarChart3, LogOut, User as UserIcon, AlertTriangle } from "lucide-react";
import { useDark, useDarkToggle, useColors } from "../context/DarkModeContext";
import { useAuth } from "../context/AuthContext";

export function PortalLayout() {
  const C = useColors();
  const dark = useDark();
  const toggleDark = useDarkToggle();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirmation(true);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, color: C.text, minHeight: "100vh", transition: "background 0.2s, color 0.2s" }}>
      {/* Top Application Bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, position: "sticky", top: 0, zIndex: 40, transition: "background 0.2s" }}>
        <div style={{ width: "100%", boxSizing: "border-box", padding: "0 clamp(20px, 3vw, 48px)", display: "flex", alignItems: "center", justifyContent: "space-between", height: "72px" }}>
          
          {/* Logo & System Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", flexShrink: 0, background: C.maroon, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={21} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "16px", color: C.text, lineHeight: 1.1 }}>UiTM Carry Mark Monitoring System</div>
              <div style={{ fontSize: "10px", fontFamily: C.mono, color: C.textMuted, letterSpacing: "0.05em", marginTop: "4px" }}>
                {user?.role === 'admin' ? "FACULTY ADMIN PORTAL" : "LECTURER PORTAL"}
              </div>
            </div>
          </div>

          {/* User Info & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {user && (
              <div style={{ minHeight: "44px", display: "flex", alignItems: "center", gap: "9px", borderRight: `1px solid ${C.border}`, paddingRight: "18px" }}>
                <UserIcon size={19} color={C.textSub} />
                <span style={{ fontSize: "14px", fontWeight: 700, color: C.text }}>{user.name}</span>
              </div>
            )}
            
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
              style={{ minHeight: "44px", boxSizing: "border-box", background: "transparent", border: `1px solid ${C.borderMid}`, borderRadius: "8px", padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", color: C.red, fontSize: "13px", fontFamily: C.sans, fontWeight: 600, transition: "all 0.15s" }}
            >
              <LogOut size={17} />
              Logout
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
            <h2 id="logout-confirmation-title" style={{ margin: "0 0 8px", color: C.text, fontFamily: C.display, fontSize: "21px", fontWeight: 700 }}>
              Confirm logout
            </h2>
            <p style={{ margin: "0 0 24px", color: C.textSub, fontSize: "13px", lineHeight: 1.6 }}>
              Are you sure you want to log out of the staff portal? You will need to enter your staff ID and password again to continue.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setShowLogoutConfirmation(false)}
                style={{ height: "44px", borderRadius: "7px", background: C.elevated, border: `1px solid ${C.borderMid}`, color: C.textSub, cursor: loggingOut ? "not-allowed" : "pointer", fontSize: "13px", fontFamily: C.sans, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={confirmLogout}
                style={{ height: "44px", borderRadius: "7px", background: C.red, border: "none", color: "#fff", cursor: loggingOut ? "wait" : "pointer", fontSize: "13px", fontFamily: C.sans, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", opacity: loggingOut ? 0.7 : 1 }}
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
