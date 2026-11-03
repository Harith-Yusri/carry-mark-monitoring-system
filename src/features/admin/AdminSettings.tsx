import React, { useEffect, useState } from "react";
import { CheckCircle, Save } from "lucide-react";
import { AdminStatus, useCardColors, useColors } from "./adminStyles";
import { userError } from "../../utils/errors";
import { useAuth } from "../../context/AuthContext";
import { activateAcademicSemester, AcademicSemesterRecord, createAcademicSemester, deleteAcademicSemester, formatAcademicSemester, listAcademicSemesters, loadSystemSettings, saveSystemSettings, SystemSettingsRecord, updateAcademicSemester } from "../../services/carryMarkApi";

type SettingsState = SystemSettingsRecord;
type SettingsTab = "semester" | "deadlines" | "notifications";

export function AdminSettings({ onActiveSemesterChanged }: { onActiveSemesterChanged?: () => void | Promise<void> }) {
  const C = useColors();
  const CC = useCardColors();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("semester");
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [semesterBusy, setSemesterBusy] = useState(false);
  const [semesterError, setSemesterError] = useState("");
  const [semesterForm, setSemesterForm] = useState({ academicYear: "", semesterCode: "", startsOn: "", endsOn: "", defaultDeadline: "" });
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([loadSystemSettings(), listAcademicSemesters()])
      .then(([currentSettings, semesterRows]) => { setSettings(currentSettings); setSemesters(semesterRows); })
      .catch(reason => setLoadError(userError(reason, "Unable to load system settings.")));
  }, []);

  const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: "42px", padding: "9px 12px", background: CC.elevated, border: `1px solid ${CC.borderMid}`, borderRadius: "7px", color: CC.text, fontFamily: CC.sans, fontSize: "calc(0.8125rem * var(--staff-text-scale))", outline: "none" };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "7px", color: CC.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))", letterSpacing: "0.06em" };
  const cardStyle: React.CSSProperties = { padding: "24px", marginBottom: "20px" };

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings(previous => previous ? ({ ...previous, [key]: value }) : previous);
  const updateDeadline = (programme: string, value: string) => setSettings(previous => previous ? ({ ...previous, programmeDeadlines: { ...previous.programmeDeadlines, [programme]: value } }) : previous);

  const save = async () => {
    if (!settings) return;
    const current = semesters.find(semester => semester.isCurrent);
    if (current && current.classCount + current.markCount + current.submissionCount > 0 && !window.confirm(`Save changes to the active semester? It contains ${current.classCount} classes, ${current.markCount} marks and ${current.submissionCount} submissions (${current.finalisedCount} released). Existing records will be preserved.`)) return;
    setSaving(true);
    try {
      await saveSystemSettings(settings, user?.authId);
      setSettings(await loadSystemSettings());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const reloadSemesterData = async () => {
    const [currentSettings, semesterRows] = await Promise.all([loadSystemSettings(), listAcademicSemesters()]);
    setSettings(currentSettings); setSemesters(semesterRows);
  };

  const semesterImpact = (semester: AcademicSemesterRecord) => `${semester.classCount} classes, ${semester.markCount} marks and ${semester.submissionCount} submissions (${semester.finalisedCount} released)`;

  const submitSemester = async (event: React.FormEvent) => {
    event.preventDefault(); setSemesterBusy(true); setSemesterError("");
    try {
      const existing = semesters.find(semester => semester.id === editingSemesterId);
      if (existing) {
        if (existing.classCount + existing.markCount + existing.submissionCount > 0 && !window.confirm(`Edit ${formatAcademicSemester(existing.semesterNo, existing.academicYear)}? It contains ${semesterImpact(existing)}. All linked data will be preserved.`)) return;
        await updateAcademicSemester(existing.id, semesterForm);
      } else await createAcademicSemester(semesterForm);
      if (existing?.isCurrent) { await reloadSemesterData(); await onActiveSemesterChanged?.(); }
      else setSemesters(await listAcademicSemesters());
      setSemesterForm({ academicYear: "", semesterCode: "", startsOn: "", endsOn: "", defaultDeadline: "" });
      setEditingSemesterId(null);
    } catch (reason) { setSemesterError(userError(reason, "Unable to save the semester.")); }
    finally { setSemesterBusy(false); }
  };

  const editSemester = (semester: AcademicSemesterRecord) => {
    setEditingSemesterId(semester.id); setSemesterError("");
    setSemesterForm({ academicYear: semester.academicYear, semesterCode: semester.semesterCode, startsOn: semester.startsOn, endsOn: semester.endsOn, defaultDeadline: semester.defaultDeadline.slice(0, 10) });
  };

  const activateSemester = async (semester: AcademicSemesterRecord) => {
    const current = semesters.find(candidate => candidate.isCurrent);
    const action = semester.status === "closed" ? "Reopen" : "Activate";
    const currentWarning = current ? ` The active semester (${semesterImpact(current)}) will be archived.` : "";
    if (!window.confirm(`${action} ${formatAcademicSemester(semester.semesterNo, semester.academicYear)}? It contains ${semesterImpact(semester)}.${currentWarning} No data will be deleted.`)) return;
    setSemesterBusy(true); setSemesterError("");
    try { await activateAcademicSemester(semester.id); await reloadSemesterData(); await onActiveSemesterChanged?.(); }
    catch (reason) { setSemesterError(userError(reason, "Unable to activate the semester.")); }
    finally { setSemesterBusy(false); }
  };

  const deleteSemester = async (semester: AcademicSemesterRecord) => {
    if (semester.isCurrent || semester.offeringCount > 0) return;
    if (!window.confirm(`Permanently delete the empty test semester ${formatAcademicSemester(semester.semesterNo, semester.academicYear)}? This cannot be undone.`)) return;
    setSemesterBusy(true); setSemesterError("");
    try {
      await deleteAcademicSemester(semester.id);
      setSemesters(await listAcademicSemesters());
      if (editingSemesterId === semester.id) { setEditingSemesterId(null); setSemesterForm({ academicYear: "", semesterCode: "", startsOn: "", endsOn: "", defaultDeadline: "" }); }
    } catch (reason) { setSemesterError(userError(reason, "Unable to delete the test semester.")); }
    finally { setSemesterBusy(false); }
  };

  const Toggle = ({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) => (
    <button type="button" aria-label={label} aria-pressed={enabled} onClick={onToggle} style={{ width: "42px", height: "23px", flexShrink: 0, borderRadius: "14px", border: "none", background: enabled ? CC.primary : CC.elevated, cursor: "pointer", position: "relative", transition: "background .2s" }}>
      <span style={{ position: "absolute", width: "17px", height: "17px", top: "3px", left: enabled ? "22px" : "3px", borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
    </button>
  );

  const NotificationRow = ({ title, description, enabled, onToggle }: { title: string; description: string; enabled: boolean; onToggle: () => void }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", padding: "14px", background: CC.elevated, border: `1px solid ${CC.borderMid}`, borderRadius: "7px" }}>
      <div>
        <div style={{ color: CC.text, fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontWeight: 600, marginBottom: "3px" }}>{title}</div>
        <div style={{ color: CC.textMuted, fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>{description}</div>
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} label={title} />
    </div>
  );

  if (loadError) return <p role="alert" style={{ color: C.red }}>{loadError}</p>;
  if (!settings) return <p style={{ color: C.textMuted }}>Loading settings from Supabase…</p>;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "semester", label: "Academic Semester" },
    { id: "deadlines", label: "Programme Deadlines" },
    { id: "notifications", label: "Notifications" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "26px" }}>
        <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(1.5rem * var(--staff-text-scale))", color: C.text, margin: "0 0 5px" }}>System Settings</h1>
        <p style={{ fontSize: "calc(0.8125rem * var(--staff-text-scale))", color: C.textMuted, margin: 0 }}>Configure deadlines, notifications, and semester details.</p>
      </div>

      <div
        role="tablist"
        aria-label="System settings sections"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "7px", padding: "6px", marginBottom: "18px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px" }}
      >
        {tabs.map(tab => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ minHeight: "38px", padding: "8px 12px", border: selected ? `1px solid ${C.brandBorder}` : "1px solid transparent", borderRadius: "7px", background: selected ? C.brandSurface : "transparent", color: selected ? C.brandText : C.textMuted, fontFamily: C.sans, fontSize: "calc(0.75rem * var(--staff-text-scale))", fontWeight: 700, cursor: "pointer" }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <section id="settings-panel-semester" role="tabpanel" aria-labelledby="settings-tab-semester" hidden={activeTab !== "semester"} className="staff-content-card" style={cardStyle}>
        <h2 style={{ fontFamily: CC.display, fontSize: "calc(1.0625rem * var(--staff-text-scale))", fontWeight: 700, color: CC.text, margin: "0 0 6px" }}>Academic Semester Lifecycle</h2>
        <p style={{ color: CC.textMuted, fontSize: "calc(0.75rem * var(--staff-text-scale))", margin: "0 0 16px", lineHeight: 1.6 }}>Create a draft semester, activate it, or reopen an archived semester for testing. Switching preserves all linked data and keeps exactly one semester active.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
          {semesters.map(semester => (
            <div key={semester.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "11px 13px", background: CC.elevated, border: `1px solid ${CC.borderMid}`, borderRadius: "7px" }}>
              <div><strong style={{ color: CC.text }}>{formatAcademicSemester(semester.semesterNo, semester.academicYear)}</strong><div style={{ color: CC.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))", marginTop: "3px" }}>Code <span className="admin-identifier">{semester.semesterCode}</span> · {semester.startsOn} – {semester.endsOn} · <AdminStatus status={semester.status} /> · {semesterImpact(semester)}</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", justifyContent: "flex-end" }}><button type="button" disabled={semesterBusy} onClick={() => editSemester(semester)} style={{ padding: "7px 9px", border: `1px solid ${CC.borderMid}`, borderRadius: "5px", background: "transparent", color: CC.textSub, fontSize: "calc(0.75rem * var(--staff-text-scale))", cursor: semesterBusy ? "wait" : "pointer" }}>Edit</button>{!semester.isCurrent && <button type="button" disabled={semesterBusy || semester.offeringCount > 0} title={semester.offeringCount > 0 ? "Semesters containing teaching data must remain archived." : "Delete this empty test semester"} onClick={() => deleteSemester(semester)} style={{ padding: "7px 9px", border: `1px solid ${CC.red}55`, borderRadius: "5px", background: "transparent", color: CC.red, fontSize: "calc(0.75rem * var(--staff-text-scale))", cursor: semesterBusy || semester.offeringCount > 0 ? "not-allowed" : "pointer", opacity: semester.offeringCount > 0 ? .5 : 1 }}>Delete</button>}{!semester.isCurrent ? <button className="staff-primary-action" type="button" disabled={semesterBusy} onClick={() => activateSemester(semester)} style={{ padding: "7px 10px", borderRadius: "5px", fontSize: "calc(0.75rem * var(--staff-text-scale))", fontWeight: 700 }}>{semester.status === "closed" ? "Reopen" : "Activate"}</button> : null}</div>
            </div>
          ))}
        </div>
        <form onSubmit={submitSemester}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
            <div><label style={labelStyle}>Semester Code</label><input className="admin-identifier" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} placeholder="20264" value={semesterForm.semesterCode} onChange={event => setSemesterForm(value => ({ ...value, semesterCode: event.target.value.replace(/\D/g, "").slice(0, 5) }))} style={{ ...fieldStyle, fontFamily: CC.mono }} /><span style={{ display: "block", marginTop: "5px", color: CC.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>Example: 20264 = Semester 4</span></div>
            <div><label style={labelStyle}>Academic Year</label><input required pattern="[0-9]{4}/[0-9]{4}" placeholder="2026/2027" value={semesterForm.academicYear} onChange={event => setSemesterForm(value => ({ ...value, academicYear: event.target.value }))} style={fieldStyle} /></div>
            <div><label style={labelStyle}>Start Date</label><input required type="date" value={semesterForm.startsOn} onChange={event => setSemesterForm(value => ({ ...value, startsOn: event.target.value }))} style={fieldStyle} /></div>
            <div><label style={labelStyle}>End Date</label><input required type="date" value={semesterForm.endsOn} onChange={event => setSemesterForm(value => ({ ...value, endsOn: event.target.value }))} style={fieldStyle} /></div>
            <div><label style={labelStyle}>Default Deadline</label><input required type="date" value={semesterForm.defaultDeadline} onChange={event => setSemesterForm(value => ({ ...value, defaultDeadline: event.target.value }))} style={fieldStyle} /></div>
          </div>
          {semesterError && <p role="alert" style={{ color: CC.red, fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>{semesterError}</p>}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}><button className="staff-primary-action" type="submit" disabled={semesterBusy} style={{ padding: "8px 12px", borderRadius: "5px", fontSize: "calc(0.75rem * var(--staff-text-scale))", fontWeight: 700 }}>{editingSemesterId ? "Save Semester Details" : "Create Draft Semester"}</button>{editingSemesterId && <button type="button" onClick={() => { setEditingSemesterId(null); setSemesterForm({ academicYear: "", semesterCode: "", startsOn: "", endsOn: "", defaultDeadline: "" }); }} style={{ padding: "8px 12px", border: `1px solid ${CC.borderMid}`, borderRadius: "5px", background: "transparent", color: CC.textMuted, cursor: "pointer" }}>Cancel</button>}</div>
        </form>
      </section>

      <section id="settings-panel-deadlines" role="tabpanel" aria-labelledby="settings-tab-deadlines" hidden={activeTab !== "deadlines"} className="staff-content-card" style={cardStyle}>
        <h2 style={{ fontFamily: CC.display, fontSize: "calc(1.0625rem * var(--staff-text-scale))", fontWeight: 700, color: CC.text, margin: "0 0 22px" }}>Submission Deadlines</h2>
        <label style={labelStyle}>Global Carry Mark Deadline</label>
        <input type="date" value={settings.globalDeadline} onChange={event => update("globalDeadline", event.target.value)} style={fieldStyle} />
        <p style={{ color: CC.textMuted, fontSize: "calc(0.75rem * var(--staff-text-scale))", margin: "6px 0 14px" }}>Applies to all programmes unless overridden below.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {settings.programmes.map(({ code, name }) => (
            <div className="settings-deadline-row" key={code} style={{ display: "grid", gridTemplateColumns: "190px minmax(180px, 1fr)", gap: "14px", alignItems: "center", padding: "11px 13px", background: CC.elevated, border: `1px solid ${CC.borderMid}`, borderRadius: "7px" }}>
              <div><div style={{ color: CC.brandText, fontWeight: 700, fontSize: "calc(0.8125rem * var(--staff-text-scale))" }}>{code}</div><div style={{ color: CC.textMuted, fontSize: "calc(0.75rem * var(--staff-text-scale))", marginTop: "3px" }}>{name}</div></div>
              <input type="date" value={settings.programmeDeadlines[code]} onChange={event => updateDeadline(code, event.target.value)} style={fieldStyle} />
            </div>
          ))}
        </div>
      </section>

      <section id="settings-panel-notifications" role="tabpanel" aria-labelledby="settings-tab-notifications" hidden={activeTab !== "notifications"} className="staff-content-card" style={cardStyle}>
        <h2 style={{ fontFamily: CC.display, fontSize: "calc(1.0625rem * var(--staff-text-scale))", fontWeight: 700, color: CC.text, margin: "0 0 20px" }}>Notification &amp; Reminder Settings</h2>
        {!settings.notificationConfigured && <p style={{ padding: "10px 12px", color: CC.amber, background: CC.amberLight, border: `1px solid ${CC.amber}44`, borderRadius: "6px", fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>No notification settings are stored for this term. Choose the required options and save to create them.</p>}
        <NotificationRow title="Auto-send reminders to lecturers" description="Automatically notify lecturers before the submission deadline." enabled={settings.autoRemind} onToggle={() => update("autoRemind", !settings.autoRemind)} />
        <div style={{ margin: "16px 0" }}>
          <label style={labelStyle}>Send Reminder (Days Before Deadline)</label>
          <div style={{ display: "flex", gap: "8px" }}>{[1, 3, 5, 7].map(days => <button key={days} disabled={!settings.autoRemind} onClick={() => update("reminderDays", days)} style={{ width: "48px", height: "36px", borderRadius: "6px", border: `1px solid ${settings.reminderDays === days ? CC.brandBorder : CC.borderMid}`, background: settings.reminderDays === days ? CC.brandSurface : CC.elevated, color: settings.reminderDays === days ? CC.brandText : CC.textMuted, fontWeight: 700, cursor: settings.autoRemind ? "pointer" : "not-allowed", opacity: settings.autoRemind ? 1 : .55 }}>{days}d</button>)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", padding: "14px", background: CC.elevated, border: `1px solid ${CC.borderMid}`, borderRadius: "7px" }}>
            <div>
              <div style={{ color: CC.text, fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontWeight: 600, marginBottom: "3px" }}>Notify students on release</div>
              <div style={{ color: CC.textMuted, fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>Students are automatically notified whenever a lecturer successfully releases carry marks.</div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0, color: CC.green, fontSize: "calc(0.75rem * var(--staff-text-scale))", fontWeight: 700 }}><CheckCircle size={15} />Always on</span>
          </div>
        </div>
      </section>

      {activeTab !== "semester" && (
        <button className={saved ? undefined : "staff-primary-action"} disabled={saving} onClick={save} style={{ background: saved ? C.green : undefined, color: saved ? "#fff" : undefined, border: saved ? "1px solid transparent" : undefined, minWidth: "150px", padding: "11px 18px", borderRadius: "7px", fontFamily: C.sans, fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
          {saved ? <CheckCircle size={15} /> : <Save size={15} />}{saved ? "Changes Saved" : saving ? "Saving…" : "Save Changes"}
        </button>
      )}
    </div>
  );
}
