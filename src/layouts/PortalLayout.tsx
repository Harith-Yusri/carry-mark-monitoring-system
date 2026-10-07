import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { Sun, Moon, LogOut, AlertTriangle } from "lucide-react";
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
    <div className="staff-portal" style={{ fontFamily: C.sans, background: C.bg, color: C.text, minHeight: "100vh", transition: "background 0.2s, color 0.2s" }}>
      {/* Top Application Bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, position: "sticky", top: 0, zIndex: 40, transition: "background 0.2s" }}>
        <div className="portal-header-inner">
          
          {/* Logo & System Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="product-mark" style={{ background: C.maroon }} aria-hidden="true">CM</div>
            <div>
              <div className="portal-product-title" style={{ fontFamily: C.display, fontWeight: 700, fontSize: "16px", color: C.text, lineHeight: 1.1 }}>UiTM Carry Mark Monitoring</div>
              <div className="portal-product-subtitle" style={{ fontSize: "11px", fontFamily: C.mono, color: C.textMuted, letterSpacing: "0.06em", marginTop: "4px" }}>
                {user?.role === 'admin' ? "FACULTY ACADEMIC OPERATIONS" : "LECTURER ASSESSMENT WORKSPACE"}
              </div>
            </div>
          </div>

          {/* User Info & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {user && (
              <div className="portal-user-block" style={{ minHeight: "44px", display: "flex", alignItems: "center", borderRight: `1px solid ${C.border}`, paddingRight: "18px" }}>
                <div className="portal-user-name">
                  <div style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>{user.name}</div>
                  <div style={{ marginTop: "3px", fontFamily: C.mono, fontSize: "11px", color: C.textMuted, letterSpacing: ".05em" }}>{user.id} · {user.role.toUpperCase()}</div>
                </div>
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
