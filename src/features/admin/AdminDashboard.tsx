import React, { useState } from "react";
import { CheckCircle, Send } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";

const programmes = [
  { code: "CS", name: "Computer Science", submitted: 2, pending: 2 },
  { code: "IT", name: "Information Technology", submitted: 2, pending: 2 },
  { code: "IS", name: "Information Systems", submitted: 2, pending: 1 },
];

const pendingLecturers = [
  { id: "TS002", programme: "CS", name: "Prof. Nurul Huda", subject: "BCS203 – Data Structures & Algorithms" },
  { id: "TS004", programme: "CS", name: "Mr. Hafizuddin Yusof", subject: "BCS420 – Software Engineering" },
  { id: "TS005", programme: "IT", name: "Dr. Lim Wei Chen", subject: "BIT450 – Network Security" },
  { id: "TS008", programme: "IT", name: "Madam Fauziah Bt Ismail", subject: "BIT201 – Web Technologies" },
  { id: "TS010", programme: "IS", name: "Mr. Syafiq Bin Hassan", subject: "BIS101 – Systems Analysis & Design" },
];

export function AdminDashboard() {
  const C = useColors();
  const [sentReminders, setSentReminders] = useState<Set<string>>(new Set());
  const total = programmes.reduce((sum, item) => sum + item.submitted + item.pending, 0);
  const submitted = programmes.reduce((sum, item) => sum + item.submitted, 0);
  const pending = total - submitted;
  const compliance = Math.round((submitted / total) * 100);

  const sendReminder = (id: string) => setSentReminders(previous => new Set([...previous, id]));

  return (
    <div>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 5px" }}>Overview</h1>
        <p style={{ fontSize: "12px", color: C.textMuted, margin: 0 }}>Faculty carry mark submission status for Semester 2, 2025/2026.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(135px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {[
          { value: total, label: "Total Lecturers", color: C.textSub, background: C.surface, border: C.borderMid },
          { value: submitted, label: "Submitted", color: C.green, background: C.greenLight, border: `${C.green}33` },
          { value: pending, label: "Pending", color: C.amber, background: C.amberLight, border: `${C.amber}33` },
          { value: `${compliance}%`, label: "Compliance Rate", color: C.amber, background: C.surface, border: C.borderMid },
        ].map(card => (
          <div key={card.label} style={{ minHeight: "96px", boxSizing: "border-box", padding: "18px", background: card.background, border: `1px solid ${card.border}`, borderRadius: "10px" }}>
            <div style={{ color: card.color, fontFamily: C.mono, fontSize: "25px", fontWeight: 700, lineHeight: 1 }}>{card.value}</div>
            <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "11px", marginTop: "12px", letterSpacing: ".04em" }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "11px", letterSpacing: ".06em", marginBottom: "14px" }}>SUBMISSION STATUS BY PROGRAMME</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: "14px", marginBottom: "30px" }}>
        {programmes.map(programme => {
          const programmeTotal = programme.submitted + programme.pending;
          const rate = Math.round(programme.submitted / programmeTotal * 100);
          return (
            <div key={programme.code} style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div><div style={{ color: C.maroon, fontFamily: C.mono, fontWeight: 700, fontSize: "13px" }}>{programme.code}</div><div style={{ color: C.textMuted, fontSize: "11px", marginTop: "5px" }}>{programme.name}</div></div>
                <div style={{ color: C.amber, fontFamily: C.mono, fontWeight: 700, fontSize: "20px" }}>{rate}%</div>
              </div>
              <div style={{ height: "6px", background: C.elevated, borderRadius: "4px", overflow: "hidden", margin: "15px 0 10px" }}><div style={{ width: `${rate}%`, height: "100%", background: C.amber, borderRadius: "4px" }} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: "10px" }}>
                <span style={{ color: C.green }}>{programme.submitted} submitted</span><span style={{ color: C.amber }}>{programme.pending} pending</span><span style={{ color: C.textMuted }}>{programmeTotal} total</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "11px", letterSpacing: ".06em", marginBottom: "14px" }}>PENDING ACTION — SEND REMINDERS</div>
      <div style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", overflow: "hidden" }}>
        {pendingLecturers.map((lecturer, index) => {
          const sent = sentReminders.has(lecturer.id);
          return (
            <div key={lecturer.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", padding: "18px", borderBottom: index < pendingLecturers.length - 1 ? `1px solid ${C.borderMid}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "13px", minWidth: 0 }}>
                <span style={{ padding: "4px 7px", border: `1px solid ${C.borderMid}`, borderRadius: "4px", color: C.textSub, fontFamily: C.mono, fontSize: "10px" }}>{lecturer.programme}</span>
                <div style={{ minWidth: 0 }}><div style={{ color: C.text, fontSize: "13px", fontWeight: 600 }}>{lecturer.name}</div><div style={{ color: C.textMuted, fontSize: "11px", marginTop: "4px" }}>{lecturer.subject}</div></div>
              </div>
              <button disabled={sent} onClick={() => sendReminder(lecturer.id)} style={{ flexShrink: 0, padding: "8px 12px", borderRadius: "6px", border: `1px solid ${sent ? C.green : C.maroon}66`, background: sent ? C.greenLight : C.maroonLight, color: sent ? C.green : C.maroon, fontSize: "11px", fontWeight: 700, cursor: sent ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                {sent ? <CheckCircle size={13} /> : <Send size={13} />}{sent ? "Reminder Sent" : "Send Reminder"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
