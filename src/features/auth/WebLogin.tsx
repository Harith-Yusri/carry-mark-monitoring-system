import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Users } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { useAuth } from "../../context/AuthContext";

export function WebLogin() {
  const C = useColors();
  const navigate = useNavigate();
  const { user, login, configured } = useAuth();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate(`/${user.role}/dashboard`, { replace: true });
  }, [user, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const profile = await login(id, password);
      navigate(`/${profile.role}/dashboard`, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, color: C.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "400px", boxShadow: `0 12px 24px -8px ${C.borderMid}` }}>
        <div style={{ width: "48px", height: "48px", background: C.maroonLight, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px", color: C.maroon }}><Users size={24} /></div>
        <h2 style={{ fontFamily: C.display, fontSize: "24px", fontWeight: 700, margin: "0 0 8px", color: C.text }}>Staff Portal</h2>
        <p style={{ fontSize: "14px", color: C.textSub, margin: "0 0 32px" }}>Sign in as an administrator or lecturer.</p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div><label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: C.textSub, marginBottom: "6px" }}>Staff ID</label><input type="text" value={id} onChange={event => setId(event.target.value)} placeholder="e.g. TS003 or ADM001" autoComplete="username" required style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${C.borderMid}`, background: C.bg, color: C.text, fontSize: "14px", boxSizing: "border-box" }} /></div>
          <div><label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: C.textSub, marginBottom: "6px" }}>Password</label><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: `1px solid ${C.borderMid}`, background: C.bg, color: C.text, fontSize: "14px", boxSizing: "border-box" }} /></div>
          {error && <div role="alert" style={{ fontSize: "12px", color: C.red, background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: "6px", padding: "9px 10px" }}>{error}</div>}
          <button disabled={submitting} type="submit" style={{ marginTop: "8px", width: "100%", padding: "12px", borderRadius: "8px", background: C.maroon, color: "#fff", border: "none", fontSize: "14px", fontWeight: 600, cursor: submitting ? "wait" : "pointer", opacity: submitting ? .7 : 1 }}>{submitting ? "Signing In…" : "Sign In"}</button>
        </form>

        {!configured && (
          <div style={{ marginTop: "18px", padding: "10px 12px", borderRadius: "8px", background: C.elevated, border: `1px solid ${C.border}`, fontSize: "11px", color: C.textMuted }}>
            Supabase configuration is incomplete. Add the project URL to .env.local.
          </div>
        )}
      </div>
    </div>
  );
}
