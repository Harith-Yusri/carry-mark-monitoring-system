import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Shield } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { DEMO_ACCOUNTS, useAuth } from "../../context/AuthContext";

export function AdminLogin() {
  const C = useColors();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (login(id, password, "admin")) navigate("/admin/dashboard");
    else setError("Invalid administrator ID or password.");
  };

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, color: C.text, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "400px", boxShadow: `0 12px 24px -8px ${C.borderMid}` }}>
        <div style={{ width: "48px", height: "48px", background: C.maroon + "20", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px", color: C.maroon }}>
          <Shield size={24} />
        </div>
        
        <h2 style={{ fontFamily: C.display, fontSize: "24px", fontWeight: 700, margin: "0 0 8px 0", color: C.text }}>Admin Portal</h2>
        <p style={{ fontSize: "14px", color: C.textSub, margin: "0 0 32px 0" }}>Sign in to access faculty oversight.</p>
        
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: C.textSub, marginBottom: "6px" }}>Admin ID</label>
            <input 
              type="text" 
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. ADM001"
              autoComplete="username"
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${C.borderMid}`, background: C.bg, color: C.text, fontSize: "14px", fontFamily: C.sans, boxSizing: "border-box" }}
            />
          </div>
          
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: C.textSub, marginBottom: "6px" }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${C.borderMid}`, background: C.bg, color: C.text, fontSize: "14px", fontFamily: C.sans, boxSizing: "border-box" }}
            />
          </div>
          {error && <div role="alert" style={{ fontSize: "12px", color: C.red, background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: "6px", padding: "9px 10px" }}>{error}</div>}
          
          <button 
            type="submit"
            style={{ marginTop: "8px", width: "100%", padding: "12px", borderRadius: "8px", background: C.maroon, color: "#fff", border: "none", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "opacity 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            Sign In
          </button>
        </form>

        <div style={{ marginTop: "18px", padding: "10px 12px", borderRadius: "8px", background: C.elevated, border: `1px solid ${C.border}`, fontSize: "11px", color: C.textMuted }}>
          Demo access: <strong style={{ color: C.text }}>{DEMO_ACCOUNTS.admin.id}</strong> / <strong style={{ color: C.text }}>{DEMO_ACCOUNTS.admin.password}</strong>
        </div>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <button 
            onClick={() => navigate("/")}
            style={{ background: "transparent", border: "none", color: C.textMuted, fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}
          >
            Back to Home
          </button>
        </div>
      </div>
      
    </div>
  );
}
