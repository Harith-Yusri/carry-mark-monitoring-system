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

  const allocations = useMemo(() => records.flatMap(lecturer => lecturer.classAllocations.map(allocation => ({
    staffId: lecturer.id,
    lecturerName: lecturer.name,
    ...allocation,
  }))), [records]);
  const programmeAllocations = useMemo(
    () => allocations.filter(item => !programmeCode || item.programmeCode === programmeCode),
    [allocations, programmeCode],
  );
  const pendingCount = programmeAllocations.filter(item => item.submissionStatus !== "Finalised").length;
  const filtered = useMemo(() => programmeAllocations.filter(item => {
    if (filter === "All") return true;
    if (filter === "Pending") return item.submissionStatus !== "Finalised";
    return item.submissionStatus === filter;
  }), [filter, programmeAllocations]);

  const programmeOptions = [{ code: "", name: "All Programmes" }, ...(context?.programmes ?? [])];
  const programmeCount = (code: string) => !code
    ? allocations.length
    : allocations.filter(allocation => allocation.programmeCode === code).length;


  return (
    <div>
      <div className="responsive-action-header" style={{ alignItems: "flex-end", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 4px" }}>Submission Monitor</h1>
          <p style={{ fontSize: "13px", color: C.textMuted }}>Track carry mark submission status for each class allocation and send reminders for incomplete work.</p>
        </div>
        <div style={{ fontFamily: C.mono, fontSize: "12px", color: C.amber, background: C.amberLight, border: `1px solid ${C.amber}44`, borderRadius: "6px", padding: "7px 10px" }}>
          {pendingCount} REQUIRE ACTION
        </div>
      </div>

      <label style={{ display: "block", width: "100%", maxWidth: "460px", marginBottom: "14px" }}>
        <span style={{ display: "block", marginBottom: "6px", color: C.textSub, fontFamily: C.mono, fontSize: "11px", fontWeight: 700, letterSpacing: ".06em" }}>PROGRAMME</span>
        <select
          aria-label="Filter submissions by programme"
          value={programmeCode}
          onChange={event => setProgrammeCode(event.target.value)}
          disabled={loading}
          style={{ width: "100%", minHeight: "42px", boxSizing: "border-box", padding: "9px 12px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "13px", outline: "none", cursor: loading ? "default" : "pointer" }}
        >
          {programmeOptions.map(item => (
            <option key={item.code || "all"} value={item.code}>
              {item.code ? `${item.code} — ${item.name}` : item.name} ({programmeCount(item.code)})
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(["All", "Pending", "Finalised", "Overdue"] as StatusFilter[]).map(item => (
          <button key={item} onClick={() => setFilter(item)} style={{ padding: "7px 12px", borderRadius: "6px", border: `1px solid ${filter === item ? C.maroon : C.border}`, background: filter === item ? C.maroonLight : C.surface, color: filter === item ? C.maroon : C.textSub, fontSize: "13px", fontWeight: filter === item ? 700 : 500, cursor: "pointer" }}>
            {item}{item === "Pending" ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>
      {loading && <p style={{ color: C.textMuted }}>Loading submissions…</p>}
      {error && <p style={{ color: C.red }}>{error}</p>}
      {reminderError && <p role="alert" style={{ color: C.red }}>{reminderError}</p>}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "980px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: C.elevated, borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontFamily: C.mono, fontSize: "11px" }}>
              <th style={{ padding: "11px 12px" }}>STAFF ID</th>
              <th style={{ padding: "11px 12px" }}>LECTURER</th>
              <th style={{ padding: "11px 12px" }}>PROGRAMME</th>
              <th style={{ padding: "11px 12px" }}>SUBJECT</th>
              <th style={{ padding: "11px 12px" }}>CLASS</th>
              <th style={{ padding: "11px 12px" }}>SUBMISSION STATUS</th>
              <th style={{ padding: "11px 12px" }}>PROGRESS</th>
              <th style={{ padding: "11px 12px" }}>LAST UPDATED</th>
              <th style={{ padding: "11px 12px" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(allocation => {
              const finalised = allocation.submissionStatus === "Finalised";
              const overdue = allocation.submissionStatus === "Overdue";
              const sent = sentReminders.has(allocation.staffId);
              return (
                <tr key={allocation.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "13px 12px", fontFamily: C.mono, color: C.textMuted }}>{allocation.staffId}</td>
                  <td style={{ padding: "13px 12px", fontWeight: 600, color: C.text }}>{allocation.lecturerName}</td>
                  <td style={{ padding: "13px 12px", color: C.textSub }}><span style={{ color: C.maroon, fontFamily: C.mono, fontWeight: 700 }}>{allocation.programmeCode}</span><br /><span style={{ fontSize: "11px" }}>{allocation.programmeName}</span></td>
                  <td style={{ padding: "13px 12px", color: C.textSub }}><span style={{ fontFamily: C.mono, color: C.maroon }}>{allocation.subjectCode}</span><br /><span style={{ fontSize: "11px" }}>{allocation.subjectName}</span></td>
                  <td style={{ padding: "13px 12px", color: C.text, fontWeight: 600 }}>{allocation.classLabel}</td>
                  <td style={{ padding: "13px 12px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: C.mono, fontSize: "11px", fontWeight: 700, padding: "4px 7px", borderRadius: "4px", background: finalised ? C.greenLight : overdue ? C.redLight : C.amberLight, color: finalised ? C.green : overdue ? C.red : C.amber }}>
                      {finalised ? <CheckCircle size={11} /> : <Clock size={11} />}{allocation.submissionStatus.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "13px 12px", fontFamily: C.mono }}>{allocation.completionRate}%</td>
                  <td style={{ padding: "13px 12px", fontFamily: C.mono, fontSize: "11px", color: C.textMuted }}>{allocation.lastUpdated}</td>
                  <td style={{ padding: "13px 12px" }}>
                    {!finalised ? <button disabled={sent || sendingReminders.has(allocation.staffId)} onClick={() => sendReminder(allocation.staffId)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "6px 9px", border: "none", borderRadius: "5px", background: sent ? C.greenLight : C.maroon, color: sent ? C.green : "#fff", fontSize: "11px", fontWeight: 700, cursor: sent ? "default" : "pointer", whiteSpace: "nowrap" }}>{sent ? <CheckCircle size={11} /> : <Send size={11} />}{sent ? "EMAIL QUEUED" : sendingReminders.has(allocation.staffId) ? "SENDING…" : "SEND REMINDER"}</button> : <span style={{ color: C.textMuted }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: "28px", textAlign: "center", color: C.textMuted, fontSize: "13px" }}>No submissions match the selected programme and status filters.</div>}
      </div>
    </div>
  );
}
