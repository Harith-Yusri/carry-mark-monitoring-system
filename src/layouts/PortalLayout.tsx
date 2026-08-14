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
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px" }}>
          
          {/* Logo & System Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "30px", height: "30px", background: C.maroon, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "14px", color: C.text, lineHeight: 1 }}>UiTM Carry Mark Monitoring System</div>
              <div style={{ fontSize: "9px", fontFamily: C.mono, color: C.textMuted, letterSpacing: "0.05em", marginTop: "2px" }}>
                {user?.role === 'admin' ? "FACULTY ADMIN PORTAL" : "LECTURER PORTAL"}
              </div>
            </div>
          </div>

          {/* User Info & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderRight: `1px solid ${C.border}`, paddingRight: "12px" }}>
                <UserIcon size={16} color={C.textSub} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{user.name}</span>
              </div>
            )}
            
            <button
              onClick={toggleDark}
              style={{ background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "8px", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: C.textSub, fontSize: "12px", fontFamily: C.sans, fontWeight: 500, transition: "all 0.15s" }}
            >
              {dark ? <Sun size={14} color={C.amber} /> : <Moon size={14} color={C.maroon} />}
              <span style={{ display: "none" }}>{dark ? "Light" : "Dark"}</span>
            </button>
            
            <button
              onClick={handleLogout}
              style={{ background: "transparent", border: `1px solid ${C.borderMid}`, borderRadius: "8px", padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: C.red, fontSize: "12px", fontFamily: C.sans, fontWeight: 500, transition: "all 0.15s" }}
            >
              <LogOut size={14} />
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
