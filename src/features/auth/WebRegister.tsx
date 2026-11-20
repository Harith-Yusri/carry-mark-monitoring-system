import { LanguageSelect } from "../../localization/LanguageSelect";
import { t, tx, useLocale } from "../../localization/react";
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router";
import { useColors } from "../../context/DarkModeContext";
import {
  isStaffEmail,
  registerAccount,
} from "../../services/registrationApi";

const fieldStyle = (background: string, border: string, color: string): React.CSSProperties => ({
  width: "100%", minHeight: "44px", padding: "10px 12px", borderRadius: "5px",
  border: `1px solid ${border}`, background, color, fontSize: "14px", boxSizing: "border-box",
});

export function WebRegister() {
  useLocale();
  const C = useColors();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const staffEmail = isStaffEmail(email);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await registerAccount({
        fullName, identifier, email, password, confirmPassword,
      });
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontFamily: C.mono, fontSize: "11px", letterSpacing: ".06em",
    fontWeight: 600, color: C.textMuted, marginBottom: "7px",
  };
  const inputStyle = fieldStyle(C.input, C.borderMid, C.text);

  return (
    <div className="login-shell" style={{ fontFamily: C.sans, background: C.surface, color: C.text }}>
      <section className="login-identity" style={{ background: C.accentSolid, color: "#fff" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "clamp(34px, 7vh, 72px)" }}>
            <img src="/cmms-favicon-v3.png" alt="CAMS" style={{ width: 46, height: 46, objectFit: "contain" }} />
            <div>
              <div style={{ fontFamily: C.display, fontSize: "17px", fontWeight: 700 }}>CAMS</div>
              <div style={{ marginTop: 3, fontSize: 11, letterSpacing: ".08em", opacity: .78 }}>{t("CONTINUOUS ASSESSMENT MONITORING SYSTEM")}</div>
            </div>
          </div>
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontFamily: C.mono, fontSize: 12, letterSpacing: ".12em", opacity: .72, marginBottom: 14 }}>{t("ACCOUNT REGISTRATION")}</div>
            <h1 style={{ margin: 0, fontFamily: C.display, fontSize: "clamp(31px, 4.2vw, 54px)", lineHeight: 1.05 }}>{t("Create your CAMS account")}</h1>
            <p style={{ margin: "20px 0 0", maxWidth: 450, fontSize: 14, lineHeight: 1.75, opacity: .84 }}>{t("Register with your official UiTM staff email. We will verify it before your first sign-in.")}</p>
          </div>
        </div>
        <div className="login-identity-detail" style={{ paddingTop: 24, borderTop: "1px solid rgba(255,255,255,.24)", fontSize: 13, opacity: .84 }}>{t("Faculty administrators are created through the secure administration workflow only.")}</div>
      </section>

      <section className="login-form-region" style={{ background: C.surface, overflowY: "auto" }}>
        <div className="login-form" style={{ paddingTop: 32, paddingBottom: 32 }}><div className="mb-4 flex justify-end"><LanguageSelect /></div>
          {complete ? (
            <div role="status">
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: ".1em", marginBottom: 12 }}>{t("VERIFICATION EMAIL SENT")}</div>
              <h2 style={{ fontFamily: C.display, fontSize: 29, margin: "0 0 12px" }}>{t("Check your email")}</h2>
              <p style={{ color: C.textSub, fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
                {t("Open the confirmation link sent to")}<strong style={{ color: C.text }}>{email.trim()}</strong>{t(". You must verify that address before signing in.")}</p>
              <button onClick={() => navigate("/")} style={{ width: "100%", minHeight: 46, border: 0, borderRadius: 5, background: C.accentSolid, color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t("Return to sign in")}</button>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.maroon, fontWeight: 700, letterSpacing: ".1em", marginBottom: 10 }}>{t("CREATE ACCOUNT")}</div>
              <h2 style={{ fontFamily: C.display, fontSize: 29, margin: "0 0 20px" }}>{t("Your account details")}</h2>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div><label style={labelStyle}>{t("UITM STAFF EMAIL")}</label><input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} autoComplete="email" placeholder={t("name@uitm.edu.my")} required style={inputStyle} /></div>
                <div style={{ padding: "9px 10px", borderRadius: 6, background: staffEmail ? C.elevated : C.bg, border: `1px solid ${staffEmail ? C.maroon + "55" : C.border}`, color: staffEmail ? C.maroon : C.textMuted, fontSize: 13 }}>
                  {staffEmail ? t("UiTM staff email detected") : t("Please use your UiTM staff email.")}
                </div>
                <div><label style={labelStyle}>{t("FULL NAME")}</label><input value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" required style={inputStyle} /></div>
                <div><label style={labelStyle}>{t("STAFF ID")}</label><input value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" required style={inputStyle} /></div>
                <PasswordField label={t("PASSWORD")} value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword(value => !value)} inputStyle={inputStyle} labelStyle={labelStyle} color={C.textMuted} autoComplete="new-password" />
                <PasswordField label={t("CONFIRM PASSWORD")} value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(value => !value)} inputStyle={inputStyle} labelStyle={labelStyle} color={C.textMuted} autoComplete="new-password" />
                {error && <div role="alert" style={{ fontSize: 13, color: C.red, background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: 6, padding: "9px 10px" }}>{tx(error)}</div>}
                <button disabled={submitting} type="submit" style={{ minHeight: 46, borderRadius: 5, background: C.accentSolid, color: "#fff", border: 0, fontSize: 14, fontWeight: 700, cursor: submitting ? "wait" : "pointer", opacity: submitting ? .6 : 1 }}>{submitting ? t("Creating account…") : t("Create account")}</button>
                <button type="button" onClick={() => navigate("/")} style={{ minHeight: 42, borderRadius: 5, background: "transparent", color: C.maroon, border: `1px solid ${C.borderMid}`, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{t("Back to sign in")}</button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, onToggle, inputStyle, labelStyle, color, autoComplete }: {
  label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void;
  inputStyle: React.CSSProperties; labelStyle: React.CSSProperties; color: string; autoComplete: string;
}) {
  useLocale();
  return <div><label style={labelStyle}>{label}</label><div style={{ position: "relative" }}><input type={visible ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} required minLength={8} autoComplete={autoComplete} style={{ ...inputStyle, paddingRight: 44 }} /><button type="button" onClick={onToggle} aria-label={visible ? t("Hide {{value0}}", { value0: (label.toLowerCase()) }) : t("Show {{value0}}", { value0: (label.toLowerCase()) })} style={{ position: "absolute", top: 0, right: 0, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "transparent", color, cursor: "pointer" }}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>;
}
