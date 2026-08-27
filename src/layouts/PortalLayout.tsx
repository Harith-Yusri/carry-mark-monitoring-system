import React from "react";
import { Outlet, useNavigate } from "react-router";
import { Sun, Moon, BarChart3, LogOut, User as UserIcon } from "lucide-react";
import { useDark, useDarkToggle, useColors } from "../context/DarkModeContext";
import { useAuth } from "../context/AuthContext";

export function PortalLayout() {
  const C = useColors();
  const dark = useDark();
  const toggleDark = useDarkToggle();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
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
    </div>
  );
}
