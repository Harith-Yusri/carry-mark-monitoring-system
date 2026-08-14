import React, { useState } from "react";
import { CheckCircle, Save } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";

interface SettingsState {
  currentSemester: string;
  semesterStart: string;
  semesterEnd: string;
  globalDeadline: string;
  programmeDeadlines: Record<"CS" | "IT" | "IS", string>;
  autoRemind: boolean;
  reminderDays: number;
  notifyStudents: boolean;
  alertAdministrator: boolean;
}

const defaults: SettingsState = {
  currentSemester: "2 / 2025-2026",
  semesterStart: "2026-01-15",
  semesterEnd: "2026-06-30",
  globalDeadline: "2026-06-20",
  programmeDeadlines: { CS: "2026-06-20", IT: "2026-06-20", IS: "2026-06-20" },
  autoRemind: true,
  reminderDays: 3,
  notifyStudents: true,
  alertAdministrator: true,
};

function loadSettings(): SettingsState {
  try {
    const stored = JSON.parse(localStorage.getItem("carrymark_admin_settings") || "null");
    return stored?.currentSemester ? { ...defaults, ...stored, programmeDeadlines: { ...defaults.programmeDeadlines, ...stored.programmeDeadlines } } : defaults;
  } catch {
    return defaults;
  }
}

export function AdminSettings() {
  const C = useColors();
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [saved, setSaved] = useState(false);

  const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: "42px", padding: "9px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", color: C.text, fontFamily: C.sans, fontSize: "13px", outline: "none" };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "7px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px", letterSpacing: "0.06em" };
  const cardStyle: React.CSSProperties = { background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", padding: "24px", marginBottom: "20px" };

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings(previous => ({ ...previous, [key]: value }));
  const updateDeadline = (programme: keyof SettingsState["programmeDeadlines"], value: string) => setSettings(previous => ({ ...previous, programmeDeadlines: { ...previous.programmeDeadlines, [programme]: value } }));

  const save = () => {
    localStorage.setItem("carrymark_admin_settings", JSON.stringify(settings));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
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
        <div style={{ color: C.textMuted, fontSize: "11px" }}>{description}</div>
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} label={title} />
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: "26px" }}>
        <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 5px" }}>System Settings</h1>
        <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Configure deadlines, notifications, and semester details.</p>
      </div>

      <section style={cardStyle}>
        <h2 style={{ fontFamily: C.display, fontSize: "17px", color: C.text, margin: "0 0 22px" }}>Semester Configuration</h2>
        <label style={labelStyle}>CURRENT SEMESTER</label>
        <input value={settings.currentSemester} onChange={event => update("currentSemester", event.target.value)} style={{ ...fieldStyle, marginBottom: "16px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          <div><label style={labelStyle}>SEMESTER START</label><input type="date" value={settings.semesterStart} onChange={event => update("semesterStart", event.target.value)} style={fieldStyle} /></div>
          <div><label style={labelStyle}>SEMESTER END</label><input type="date" value={settings.semesterEnd} onChange={event => update("semesterEnd", event.target.value)} style={fieldStyle} /></div>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontFamily: C.display, fontSize: "17px", color: C.text, margin: "0 0 22px" }}>Submission Deadlines</h2>
        <label style={labelStyle}>GLOBAL CARRY MARK DEADLINE</label>
        <input type="date" value={settings.globalDeadline} onChange={event => update("globalDeadline", event.target.value)} style={fieldStyle} />
        <p style={{ color: C.textMuted, fontSize: "11px", margin: "6px 0 14px" }}>Applies to all programmes unless overridden below.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {([['CS', 'Computer Science'], ['IT', 'Information Technology'], ['IS', 'Information Systems']] as const).map(([code, name]) => (
            <div key={code} style={{ display: "grid", gridTemplateColumns: "190px minmax(180px, 1fr)", gap: "14px", alignItems: "center", padding: "11px 13px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px" }}>
              <div><div style={{ color: C.maroon, fontFamily: C.mono, fontWeight: 700, fontSize: "12px" }}>{code}</div><div style={{ color: C.textMuted, fontSize: "11px", marginTop: "3px" }}>{name}</div></div>
              <input type="date" value={settings.programmeDeadlines[code]} onChange={event => updateDeadline(code, event.target.value)} style={fieldStyle} />
            </div>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontFamily: C.display, fontSize: "17px", color: C.text, margin: "0 0 20px" }}>Notification &amp; Reminder Settings</h2>
        <NotificationRow title="Auto-send reminders to lecturers" description="Automatically notify lecturers before the submission deadline." enabled={settings.autoRemind} onToggle={() => update("autoRemind", !settings.autoRemind)} />
        <div style={{ margin: "16px 0" }}>
          <label style={labelStyle}>SEND REMINDER (DAYS BEFORE DEADLINE)</label>
          <div style={{ display: "flex", gap: "8px" }}>{[1, 3, 5, 7].map(days => <button key={days} disabled={!settings.autoRemind} onClick={() => update("reminderDays", days)} style={{ width: "48px", height: "36px", borderRadius: "6px", border: `1px solid ${settings.reminderDays === days ? C.maroon : C.borderMid}`, background: settings.reminderDays === days ? C.maroonLight : C.elevated, color: settings.reminderDays === days ? C.maroon : C.textMuted, fontFamily: C.mono, fontWeight: 700, cursor: settings.autoRemind ? "pointer" : "not-allowed", opacity: settings.autoRemind ? 1 : .55 }}>{days}d</button>)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <NotificationRow title="Notify students on finalisation" description="Push notification sent when a lecturer finalises carry marks." enabled={settings.notifyStudents} onToggle={() => update("notifyStudents", !settings.notifyStudents)} />
          <NotificationRow title="Alert administrator on submission" description="Notify administrator when a lecturer submits carry marks." enabled={settings.alertAdministrator} onToggle={() => update("alertAdministrator", !settings.alertAdministrator)} />
        </div>
      </section>

      <button onClick={save} style={{ minWidth: "150px", padding: "11px 18px", background: saved ? C.green : C.maroon, color: "#fff", border: "none", borderRadius: "7px", fontFamily: C.sans, fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
        {saved ? <CheckCircle size={15} /> : <Save size={15} />}{saved ? "Changes Saved" : "Save Changes"}
      </button>
    </div>
  );
}
