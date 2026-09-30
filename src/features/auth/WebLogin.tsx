import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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
    <div className="login-shell" style={{ fontFamily: C.sans, background: C.surface, color: C.text }}>
      <section className="login-identity" style={{ background: C.maroon, color: "#fff" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "clamp(44px, 9vh, 96px)" }}>
            <div style={{ width: "46px", height: "36px", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.65)", fontFamily: C.mono, fontSize: "13px", fontWeight: 700 }}>CM</div>
            <div>
              <div style={{ fontFamily: C.display, fontSize: "17px", fontWeight: 700, lineHeight: 1.1 }}>UiTM</div>
              <div style={{ marginTop: "3px", fontSize: "10px", letterSpacing: ".08em", opacity: .78 }}>ACADEMIC ASSESSMENT SYSTEM</div>
            </div>
          </div>
          <div style={{ maxWidth: "540px" }}>
            <div style={{ fontFamily: C.mono, fontSize: "11px", letterSpacing: ".12em", opacity: .72, marginBottom: "14px" }}>CARRY MARK OPERATIONS</div>
            <h1 style={{ margin: 0, maxWidth: "520px", fontFamily: C.display, fontSize: "clamp(32px, 4.5vw, 58px)", lineHeight: 1.04, fontWeight: 700 }}>Carry Mark Monitoring System</h1>
            <p style={{ margin: "22px 0 0", maxWidth: "470px", fontSize: "14px", lineHeight: 1.75, opacity: .82 }}>
              A faculty workspace for assessment structures, mark entry, eligibility review, submission compliance, and e-Res export.
            </p>
          </div>
        </div>
        <div className="login-identity-detail" style={{ paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,.24)" }}>
          <div style={{ fontFamily: C.mono, fontSize: "10px", letterSpacing: ".08em", opacity: .68 }}>FACULTY OF COMPUTER AND MATHEMATICAL SCIENCES</div>
          <div style={{ marginTop: "8px", fontSize: "12px", opacity: .86 }}>Lecturer marking · Faculty compliance · Academic records</div>
        </div>
      </section>

      <section className="login-form-region" style={{ background: C.surface }}>
        <div className="login-form">
          <div style={{ fontFamily: C.mono, fontSize: "10px", color: C.maroon, fontWeight: 700, letterSpacing: ".1em", marginBottom: "12px" }}>SECURE STAFF ACCESS</div>
          <h2 style={{ fontFamily: C.display, fontSize: "29px", lineHeight: 1.15, fontWeight: 700, margin: "0 0 8px", color: C.text }}>Sign in to your portal</h2>
          <p style={{ fontSize: "13px", color: C.textSub, lineHeight: 1.6, margin: "0 0 30px" }}>Use your registered staff credentials. Your lecturer or administrator workspace will open automatically.</p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div><label style={{ display: "block", fontFamily: C.mono, fontSize: "10px", letterSpacing: ".06em", fontWeight: 600, color: C.textMuted, marginBottom: "7px" }}>STAFF ID</label><input type="text" value={id} onChange={event => setId(event.target.value)} placeholder="e.g. TS003 or ADM001" autoComplete="username" required style={{ width: "100%", minHeight: "44px", padding: "10px 12px", borderRadius: "5px", border: `1px solid ${C.borderMid}`, background: C.bg, color: C.text, fontSize: "14px", boxSizing: "border-box" }} /></div>
            <div><label style={{ display: "block", fontFamily: C.mono, fontSize: "10px", letterSpacing: ".06em", fontWeight: 600, color: C.textMuted, marginBottom: "7px" }}>PASSWORD</label><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required style={{ width: "100%", minHeight: "44px", padding: "10px 12px", borderRadius: "5px", border: `1px solid ${C.borderMid}`, background: C.bg, color: C.text, fontSize: "14px", boxSizing: "border-box" }} /></div>
          {error && <div role="alert" style={{ fontSize: "12px", color: C.red, background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: "6px", padding: "9px 10px" }}>{error}</div>}
            <button disabled={submitting} type="submit" style={{ marginTop: "4px", width: "100%", minHeight: "46px", padding: "12px", borderRadius: "5px", background: C.maroon, color: "#fff", border: "none", fontSize: "14px", fontWeight: 700, cursor: submitting ? "wait" : "pointer", opacity: submitting ? .7 : 1 }}>{submitting ? "Signing In…" : "Continue to Staff Portal"}</button>
          </form>

          {!configured && (
            <div style={{ marginTop: "18px", padding: "10px 12px", borderRadius: "5px", background: C.elevated, border: `1px solid ${C.border}`, fontSize: "11px", color: C.textMuted }}>
              Supabase configuration is incomplete. Add the project URL to .env.local.
            </div>
          )}
          <p style={{ margin: "24px 0 0", color: C.textMuted, fontSize: "11px", lineHeight: 1.6 }}>Access is restricted to authorised UiTM lecturers and faculty administrators.</p>
        </div>
      </section>
    </div>
  );
}
