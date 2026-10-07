import React, { useMemo, useState } from "react";
import { CheckCircle, Clock, Send } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { useReminders } from "../../hooks/useReminders";
import { useAdminRecords } from "../../hooks/useAdminRecords";

type StatusFilter = "All" | "Pending" | "Finalised" | "Overdue";

export function SubmissionMonitor() {
  const C = useColors();
  const { records, context, loading, error } = useAdminRecords();
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [programmeCode, setProgrammeCode] = useState("");
  const { sendReminder, sentReminders, sendingReminders, reminderError } = useReminders();

  const pendingCount = records.filter(item => item.submissionStatus !== "Finalised").length;
  const filtered = useMemo(() => records.flatMap(item => {
    const assignment = programmeCode ? item.programmeAssignments.find(candidate => candidate.code === programmeCode) : null;
    if (programmeCode && !assignment) return [];
    const scopedItem = assignment ? {
      ...item,
      department: assignment.name,
      programmeCodes: [assignment.code],
      subjects: assignment.subjects,
      subjectName: assignment.subjectName,
      studentCount: assignment.studentCount,
      deadline: assignment.deadline,
      submissionStatus: assignment.submissionStatus,
      lastUpdated: assignment.lastUpdated,
      completionRate: assignment.completionRate,
    } : item;
    if (filter === "All") return [scopedItem];
    if (filter === "Pending") return scopedItem.submissionStatus !== "Finalised" ? [scopedItem] : [];
    return scopedItem.submissionStatus === filter ? [scopedItem] : [];
  }), [filter, programmeCode, records]);

  const programmeOptions = [{ code: "", name: "All Programmes" }, ...(context?.programmes ?? [])];
  const programmeCount = (code: string) => !code
    ? records.length
    : records.filter(lecturer => lecturer.programmeAssignments.some(assignment => assignment.code === code)).length;


  return (
    <div>
      <div className="responsive-action-header" style={{ alignItems: "flex-end", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 4px" }}>Submission Monitor</h1>
          <p style={{ fontSize: "12px", color: C.textMuted }}>Track carry mark submission status per lecturer and send reminders for incomplete work.</p>
        </div>
        <div style={{ fontFamily: C.mono, fontSize: "11px", color: C.amber, background: C.amberLight, border: `1px solid ${C.amber}44`, borderRadius: "6px", padding: "7px 10px" }}>
          {pendingCount} REQUIRE ACTION
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(145px, 1fr))", gap: "6px", padding: "6px", marginBottom: "16px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "12px", overflowX: "auto" }}>
        {programmeOptions.map(item => {
          const active = programmeCode === item.code;
          return (
            <button
              key={item.code || "all"}
              onClick={() => setProgrammeCode(item.code)}
              aria-pressed={active}
              style={{ minWidth: "145px", minHeight: "62px", padding: "10px 12px", borderRadius: "9px", border: `1px solid ${active ? C.borderMid : "transparent"}`, background: active ? C.surface : "transparent", color: active ? C.text : C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontFamily: C.sans, fontSize: "13px", fontWeight: active ? 700 : 600, lineHeight: 1.35, transition: "all 0.15s" }}
            >
              <span>{item.code ? `${item.code} · ${item.name}` : item.name}</span>
              <span style={{ flexShrink: 0, minWidth: "25px", height: "25px", padding: "0 5px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", background: C.amberLight, border: `1px solid ${C.amber}66`, color: C.amber, fontFamily: C.mono, fontSize: "11px", fontWeight: 700 }}>{programmeCount(item.code)}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(["All", "Pending", "Finalised", "Overdue"] as StatusFilter[]).map(item => (
          <button key={item} onClick={() => setFilter(item)} style={{ padding: "7px 12px", borderRadius: "6px", border: `1px solid ${filter === item ? C.maroon : C.border}`, background: filter === item ? C.maroonLight : C.surface, color: filter === item ? C.maroon : C.textSub, fontSize: "12px", fontWeight: filter === item ? 700 : 500, cursor: "pointer" }}>
            {item}{item === "Pending" ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>
      {loading && <p style={{ color: C.textMuted }}>Loading submissions…</p>}
      {error && <p style={{ color: C.red }}>{error}</p>}
      {reminderError && <p role="alert" style={{ color: C.red }}>{reminderError}</p>}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "760px", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: C.elevated, borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>
              <th style={{ padding: "11px 12px" }}>STAFF ID</th>
              <th style={{ padding: "11px 12px" }}>LECTURER</th>
              <th style={{ padding: "11px 12px" }}>PROGRAMME</th>
              <th style={{ padding: "11px 12px" }}>SUBJECT</th>
              <th style={{ padding: "11px 12px" }}>SUBMISSION STATUS</th>
              <th style={{ padding: "11px 12px" }}>PROGRESS</th>
              <th style={{ padding: "11px 12px" }}>LAST UPDATED</th>
              <th style={{ padding: "11px 12px" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(lecturer => {
              const finalised = lecturer.submissionStatus === "Finalised";
              const overdue = lecturer.submissionStatus === "Overdue";
              const sent = sentReminders.has(lecturer.id);
              return (
                <tr key={lecturer.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "13px 12px", fontFamily: C.mono, color: C.textMuted }}>{lecturer.id}</td>
                  <td style={{ padding: "13px 12px", fontWeight: 600, color: C.text }}>{lecturer.name}</td>
                  <td style={{ padding: "13px 12px", color: C.textSub }}>{lecturer.department}</td>
                  <td style={{ padding: "13px 12px", color: C.textSub }}><span style={{ fontFamily: C.mono, color: C.maroon }}>{lecturer.subjects.join(", ")}</span><br /><span style={{ fontSize: "10px" }}>{lecturer.subjectName}</span></td>
                  <td style={{ padding: "13px 12px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: C.mono, fontSize: "10px", fontWeight: 700, padding: "4px 7px", borderRadius: "4px", background: finalised ? C.greenLight : overdue ? C.redLight : C.amberLight, color: finalised ? C.green : overdue ? C.red : C.amber }}>
                      {finalised ? <CheckCircle size={11} /> : <Clock size={11} />}{lecturer.submissionStatus.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "13px 12px", fontFamily: C.mono }}>{lecturer.completionRate}%</td>
                  <td style={{ padding: "13px 12px", fontFamily: C.mono, fontSize: "10px", color: C.textMuted }}>{lecturer.lastUpdated}</td>
                  <td style={{ padding: "13px 12px" }}>
                    {!finalised ? <button disabled={sent || sendingReminders.has(lecturer.id)} onClick={() => sendReminder(lecturer.id)} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 9px", border: "none", borderRadius: "5px", background: sent ? C.greenLight : C.maroon, color: sent ? C.green : "#fff", fontSize: "10px", fontWeight: 700, cursor: sent ? "default" : "pointer", whiteSpace: "nowrap" }}><Send size={11} />{sent ? "EMAIL QUEUED" : sendingReminders.has(lecturer.id) ? "SENDING…" : "SEND REMINDER"}</button> : <span style={{ color: C.textMuted }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: "28px", textAlign: "center", color: C.textMuted, fontSize: "12px" }}>No submissions match the selected programme and status filters.</div>}
      </div>
    </div>
  );
}
