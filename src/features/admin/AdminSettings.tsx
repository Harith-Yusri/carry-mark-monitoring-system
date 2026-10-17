import React, { useEffect, useState } from "react";
import { CheckCircle, Save } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { userError } from "../../utils/errors";
import { useAuth } from "../../context/AuthContext";
import { activateAcademicSession, AcademicSessionRecord, createAcademicSession, deleteAcademicSession, listAcademicSessions, loadSystemSettings, saveSystemSettings, SystemSettingsRecord, updateAcademicSession } from "../../services/carryMarkApi";

type SettingsState = SystemSettingsRecord;

export function AdminSettings({ onActiveSessionChanged }: { onActiveSessionChanged?: () => void | Promise<void> }) {
  const C = useColors();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sessions, setSessions] = useState<AcademicSessionRecord[]>([]);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionForm, setSessionForm] = useState({ academicYear: "", sessionNo: 1, startsOn: "", endsOn: "", defaultDeadline: "" });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([loadSystemSettings(), listAcademicSessions()])
      .then(([currentSettings, sessionRows]) => { setSettings(currentSettings); setSessions(sessionRows); })
      .catch(reason => setLoadError(userError(reason, "Unable to load system settings.")));
  }, []);

  const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: "42px", padding: "9px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", color: C.text, fontFamily: C.sans, fontSize: "13px", outline: "none" };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "7px", color: C.textMuted, fontFamily: C.mono, fontSize: "11px", letterSpacing: "0.06em" };
  const cardStyle: React.CSSProperties = { background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", padding: "24px", marginBottom: "20px" };

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings(previous => previous ? ({ ...previous, [key]: value }) : previous);
  const updateDeadline = (programme: string, value: string) => setSettings(previous => previous ? ({ ...previous, programmeDeadlines: { ...previous.programmeDeadlines, [programme]: value } }) : previous);

  const save = async () => {
    if (!settings) return;
    const current = sessions.find(session => session.isCurrent);
    if (current && current.classCount + current.markCount + current.submissionCount > 0 && !window.confirm(`Save changes to the active session? It contains ${current.classCount} classes, ${current.markCount} marks and ${current.submissionCount} submissions (${current.finalisedCount} finalised). Existing records will be preserved.`)) return;
    setSaving(true);
    try {
      await saveSystemSettings(settings, user?.authId);
      setSettings(await loadSystemSettings());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const reloadSessionData = async () => {
    const [currentSettings, sessionRows] = await Promise.all([loadSystemSettings(), listAcademicSessions()]);
    setSettings(currentSettings); setSessions(sessionRows);
  };

  const sessionImpact = (session: AcademicSessionRecord) => `${session.classCount} classes, ${session.markCount} marks and ${session.submissionCount} submissions (${session.finalisedCount} finalised)`;

  const submitSession = async (event: React.FormEvent) => {
    event.preventDefault(); setSessionBusy(true); setSessionError("");
    try {
      const existing = sessions.find(session => session.id === editingSessionId);
      if (existing) {
        if (existing.classCount + existing.markCount + existing.submissionCount > 0 && !window.confirm(`Edit Session ${existing.sessionNo} · ${existing.academicYear}? It contains ${sessionImpact(existing)}. All linked data will be preserved.`)) return;
        await updateAcademicSession(existing.id, sessionForm);
      } else await createAcademicSession(sessionForm);
      if (existing?.isCurrent) { await reloadSessionData(); await onActiveSessionChanged?.(); }
      else setSessions(await listAcademicSessions());
      setSessionForm({ academicYear: "", sessionNo: 1, startsOn: "", endsOn: "", defaultDeadline: "" });
      setEditingSessionId(null);
    } catch (reason) { setSessionError(userError(reason, "Unable to save the session.")); }
    finally { setSessionBusy(false); }
  };

  const editSession = (session: AcademicSessionRecord) => {
    setEditingSessionId(session.id); setSessionError("");
    setSessionForm({ academicYear: session.academicYear, sessionNo: session.sessionNo, startsOn: session.startsOn, endsOn: session.endsOn, defaultDeadline: session.defaultDeadline.slice(0, 10) });
  };

  const activateSession = async (session: AcademicSessionRecord) => {
    const current = sessions.find(candidate => candidate.isCurrent);
    const action = session.status === "closed" ? "Reopen" : "Activate";
    const currentWarning = current ? ` The active session (${sessionImpact(current)}) will be archived.` : "";
    if (!window.confirm(`${action} Session ${session.sessionNo} · ${session.academicYear}? It contains ${sessionImpact(session)}.${currentWarning} No data will be deleted.`)) return;
    setSessionBusy(true); setSessionError("");
    try { await activateAcademicSession(session.id); await reloadSessionData(); await onActiveSessionChanged?.(); }
    catch (reason) { setSessionError(userError(reason, "Unable to activate the session.")); }
    finally { setSessionBusy(false); }
  };

  const deleteSession = async (session: AcademicSessionRecord) => {
    if (session.isCurrent || session.offeringCount > 0) return;
    if (!window.confirm(`Permanently delete the empty test session Session ${session.sessionNo} · ${session.academicYear}? This cannot be undone.`)) return;
    setSessionBusy(true); setSessionError("");
    try {
      await deleteAcademicSession(session.id);
      setSessions(await listAcademicSessions());
      if (editingSessionId === session.id) { setEditingSessionId(null); setSessionForm({ academicYear: "", sessionNo: 1, startsOn: "", endsOn: "", defaultDeadline: "" }); }
    } catch (reason) { setSessionError(userError(reason, "Unable to delete the test session.")); }
    finally { setSessionBusy(false); }
  };

  const Toggle = ({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) => (
    <button type="button" aria-label={label} aria-pressed={enabled} onClick={onToggle} style={{ width: "42px", height: "23px", flexShrink: 0, borderRadius: "14px", border: "none", background: enabled ? C.maroon : C.elevated, cursor: "pointer", position: "relative", transition: "background .2s" }}>
      <span style={{ position: "absolute", width: "17px", height: "17px", top: "3px", left: enabled ? "22px" : "3px", borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
    </button>
  );

  const NotificationRow = ({ title, description, enabled, onToggle }: { title: string; description: string; enabled: boolean; onToggle: () => void }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", padding: "14px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px" }}>
      <div>
        <div style={{ color: C.text, fontSize: "13px", fontWeight: 600, marginBottom: "3px" }}>{title}</div>
        <div style={{ color: C.textMuted, fontSize: "12px" }}>{description}</div>
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} label={title} />
    </div>
  );

  if (loadError) return <p role="alert" style={{ color: C.red }}>{loadError}</p>;
  if (!settings) return <p style={{ color: C.textMuted }}>Loading settings from Supabase…</p>;

  return (
    <div>
      <div style={{ marginBottom: "26px" }}>
        <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 5px" }}>System Settings</h1>
        <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Configure deadlines, notifications, and session details.</p>
      </div>

      <section style={cardStyle}>
        <h2 style={{ fontFamily: C.display, fontSize: "17px", fontWeight: 700, color: C.text, margin: "0 0 6px" }}>Academic Session Lifecycle</h2>
        <p style={{ color: C.textMuted, fontSize: "12px", margin: "0 0 16px", lineHeight: 1.6 }}>Create a draft session, activate it, or reopen an archived session for testing. Switching preserves all linked data and keeps exactly one session active.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
          {sessions.map(session => (
            <div key={session.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "11px 13px", background: C.elevated, border: `1px solid ${session.isCurrent ? C.green : C.borderMid}`, borderRadius: "7px" }}>
              <div><strong style={{ color: C.text }}>Session {session.sessionNo} · {session.academicYear}</strong><div style={{ color: C.textMuted, fontSize: "11px", marginTop: "3px" }}>{session.startsOn} – {session.endsOn} · {session.status.toUpperCase()} · {sessionImpact(session)}</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", justifyContent: "flex-end" }}><button type="button" disabled={sessionBusy} onClick={() => editSession(session)} style={{ padding: "7px 9px", border: `1px solid ${C.borderMid}`, borderRadius: "5px", background: "transparent", color: C.textSub, fontSize: "12px", cursor: sessionBusy ? "wait" : "pointer" }}>Edit</button>{!session.isCurrent && <button type="button" disabled={sessionBusy || session.offeringCount > 0} title={session.offeringCount > 0 ? "Sessions containing teaching data must remain archived." : "Delete this empty test session"} onClick={() => deleteSession(session)} style={{ padding: "7px 9px", border: `1px solid ${C.red}55`, borderRadius: "5px", background: "transparent", color: C.red, fontSize: "12px", cursor: sessionBusy || session.offeringCount > 0 ? "not-allowed" : "pointer", opacity: session.offeringCount > 0 ? .5 : 1 }}>Delete</button>}{!session.isCurrent ? <button type="button" disabled={sessionBusy} onClick={() => activateSession(session)} style={{ padding: "7px 10px", border: 0, borderRadius: "5px", background: C.maroon, color: "#fff", fontSize: "12px", fontWeight: 700, cursor: sessionBusy ? "wait" : "pointer" }}>{session.status === "closed" ? "Reopen" : "Activate"}</button> : <span style={{ color: C.green, fontFamily: C.mono, fontSize: "11px", fontWeight: 700 }}>ACTIVE</span>}</div>
            </div>
          ))}
        </div>
        <form onSubmit={submitSession}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
            <div><label style={labelStyle}>ACADEMIC YEAR</label><input required placeholder="2026/2027" value={sessionForm.academicYear} onChange={event => setSessionForm(value => ({ ...value, academicYear: event.target.value }))} style={fieldStyle} /></div>
            <div><label style={labelStyle}>SESSION NUMBER</label><select value={sessionForm.sessionNo} onChange={event => setSessionForm(value => ({ ...value, sessionNo: Number(event.target.value) }))} style={fieldStyle}>{[1, 2, 3].map(value => <option key={value}>{value}</option>)}</select></div>
            <div><label style={labelStyle}>START DATE</label><input required type="date" value={sessionForm.startsOn} onChange={event => setSessionForm(value => ({ ...value, startsOn: event.target.value }))} style={fieldStyle} /></div>
            <div><label style={labelStyle}>END DATE</label><input required type="date" value={sessionForm.endsOn} onChange={event => setSessionForm(value => ({ ...value, endsOn: event.target.value }))} style={fieldStyle} /></div>
            <div><label style={labelStyle}>DEFAULT DEADLINE</label><input required type="date" value={sessionForm.defaultDeadline} onChange={event => setSessionForm(value => ({ ...value, defaultDeadline: event.target.value }))} style={fieldStyle} /></div>
          </div>
          {sessionError && <p role="alert" style={{ color: C.red, fontSize: "12px" }}>{sessionError}</p>}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}><button type="submit" disabled={sessionBusy} style={{ padding: "8px 12px", border: `1px solid ${C.maroon}66`, borderRadius: "5px", background: "transparent", color: C.maroon, fontSize: "12px", fontWeight: 700, cursor: sessionBusy ? "wait" : "pointer" }}>{editingSessionId ? "Save Session Details" : "Create Draft Session"}</button>{editingSessionId && <button type="button" onClick={() => { setEditingSessionId(null); setSessionForm({ academicYear: "", sessionNo: 1, startsOn: "", endsOn: "", defaultDeadline: "" }); }} style={{ padding: "8px 12px", border: `1px solid ${C.borderMid}`, borderRadius: "5px", background: "transparent", color: C.textMuted, cursor: "pointer" }}>Cancel</button>}</div>
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontFamily: C.display, fontSize: "17px", fontWeight: 700, color: C.text, margin: "0 0 22px" }}>Submission Deadlines</h2>
        <label style={labelStyle}>GLOBAL CARRY MARK DEADLINE</label>
        <input type="date" value={settings.globalDeadline} onChange={event => update("globalDeadline", event.target.value)} style={fieldStyle} />
        <p style={{ color: C.textMuted, fontSize: "12px", margin: "6px 0 14px" }}>Applies to all programmes unless overridden below.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {settings.programmes.map(({ code, name }) => (
            <div className="settings-deadline-row" key={code} style={{ display: "grid", gridTemplateColumns: "190px minmax(180px, 1fr)", gap: "14px", alignItems: "center", padding: "11px 13px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px" }}>
              <div><div style={{ color: C.maroon, fontFamily: C.mono, fontWeight: 700, fontSize: "13px" }}>{code}</div><div style={{ color: C.textMuted, fontSize: "12px", marginTop: "3px" }}>{name}</div></div>
              <input type="date" value={settings.programmeDeadlines[code]} onChange={event => updateDeadline(code, event.target.value)} style={fieldStyle} />
            </div>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontFamily: C.display, fontSize: "17px", fontWeight: 700, color: C.text, margin: "0 0 20px" }}>Notification &amp; Reminder Settings</h2>
        {!settings.notificationConfigured && <p style={{ padding: "10px 12px", color: C.amber, background: C.amberLight, border: `1px solid ${C.amber}44`, borderRadius: "6px", fontSize: "12px" }}>No notification settings are stored for this term. Choose the required options and save to create them.</p>}
        <NotificationRow title="Auto-send reminders to lecturers" description="Automatically notify lecturers before the submission deadline." enabled={settings.autoRemind} onToggle={() => update("autoRemind", !settings.autoRemind)} />
        <div style={{ margin: "16px 0" }}>
          <label style={labelStyle}>SEND REMINDER (DAYS BEFORE DEADLINE)</label>
          <div style={{ display: "flex", gap: "8px" }}>{[1, 3, 5, 7].map(days => <button key={days} disabled={!settings.autoRemind} onClick={() => update("reminderDays", days)} style={{ width: "48px", height: "36px", borderRadius: "6px", border: `1px solid ${settings.reminderDays === days ? C.maroon : C.borderMid}`, background: settings.reminderDays === days ? C.maroonLight : C.elevated, color: settings.reminderDays === days ? C.maroon : C.textMuted, fontFamily: C.mono, fontWeight: 700, cursor: settings.autoRemind ? "pointer" : "not-allowed", opacity: settings.autoRemind ? 1 : .55 }}>{days}d</button>)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", padding: "14px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px" }}>
            <div>
              <div style={{ color: C.text, fontSize: "13px", fontWeight: 600, marginBottom: "3px" }}>Notify students on finalisation</div>
              <div style={{ color: C.textMuted, fontSize: "12px" }}>Students are automatically notified whenever a lecturer successfully finalises carry marks.</div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0, color: C.green, fontSize: "12px", fontWeight: 700 }}><CheckCircle size={15} />Always on</span>
          </div>
        </div>
      </section>

      <button disabled={saving} onClick={save} style={{ minWidth: "150px", padding: "11px 18px", background: saved ? C.green : C.maroon, color: "#fff", border: "none", borderRadius: "7px", fontFamily: C.sans, fontSize: "13px", fontWeight: 700, cursor: saving ? "wait" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
        {saved ? <CheckCircle size={15} /> : <Save size={15} />}{saved ? "Changes Saved" : saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
