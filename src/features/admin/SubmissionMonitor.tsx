import React, { useMemo, useState } from "react";
import { CheckCircle, ChevronDown, Clock, Send } from "lucide-react";
import { AdminStatus, useCardColors, useColors } from "./adminStyles";
import { useReminders } from "../../hooks/useReminders";
import { AdminAcademicContext, requiresSubmissionAction, submissionAllocations } from "../../hooks/useAdminRecords";
import { groupSubmissionRows } from "./submissionGroups";
import { LecturerInfo } from "../../types";

type StatusFilter = "All" | "Pending" | "Finalised" | "Overdue";

export function SubmissionMonitor({ records, context, loading, error }: { records: LecturerInfo[]; context: AdminAcademicContext | null; loading: boolean; error: string }) {
  const C = useColors();
  const CC = useCardColors();
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [programmeCode, setProgrammeCode] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { sendReminder, sentReminders, sendingReminders, reminderError } = useReminders();

  const allocations = useMemo(() => submissionAllocations(records), [records]);
  const programmeAllocations = useMemo(
    () => allocations.filter(item => !programmeCode || item.programmeCode === programmeCode),
    [allocations, programmeCode],
  );
  const pendingCount = programmeAllocations.filter(requiresSubmissionAction).length;
  const filtered = useMemo(() => programmeAllocations.filter(item => {
    if (filter === "All") return true;
    if (filter === "Pending") return requiresSubmissionAction(item);
    return item.submissionStatus === filter;
  }), [filter, programmeAllocations]);

  const lecturerGroups = useMemo(() => groupSubmissionRows(filtered), [filtered]);
  const toggleLecturer = (staffId: string) => setExpandedGroups(previous => {
    const next = new Set(previous);
    if (next.has(staffId)) next.delete(staffId);
    else next.add(staffId);
    return next;
  });

  const programmeOptions = [{ code: "", name: "All Programmes" }, ...(context?.programmes ?? [])];
  const programmeCount = (code: string) => !code
    ? allocations.length
    : allocations.filter(allocation => allocation.programmeCode === code).length;


  return (
    <div>
      <div className="responsive-action-header" style={{ alignItems: "flex-end", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(1.5rem * var(--staff-text-scale))", color: C.text, margin: "0 0 4px" }}>Submission Monitor</h1>
          <p style={{ fontSize: "calc(0.8125rem * var(--staff-text-scale))", color: C.textMuted }}>Track continuous assessment submission status for each class allocation and send reminders for incomplete work.</p>
        </div>
        <AdminStatus status="Action required">{pendingCount} </AdminStatus>
      </div>

      <label style={{ display: "block", width: "100%", maxWidth: "460px", marginBottom: "14px" }}>
        <span style={{ display: "block", marginBottom: "6px", color: C.textSub, fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, letterSpacing: ".06em" }}>Programme</span>
        <select
          aria-label="Filter submissions by programme"
          value={programmeCode}
          onChange={event => setProgrammeCode(event.target.value)}
          disabled={loading}
          style={{ width: "100%", minHeight: "42px", boxSizing: "border-box", padding: "9px 12px", background: C.input, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "calc(0.8125rem * var(--staff-text-scale))", outline: "none", cursor: loading ? "default" : "pointer" }}
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
          <button key={item} className="submission-status-filter" data-status={item} aria-pressed={filter === item} onClick={() => setFilter(item)} style={{ padding: "7px 12px", borderRadius: "6px", border: `1px solid ${filter === item ? `var(--submission-tab-border, ${C.brandBorder})` : C.border}`, background: filter === item ? `var(--submission-tab-background, ${C.brandSurface})` : C.surface, color: filter === item ? `var(--submission-tab-text, ${C.brandText})` : C.textSub, fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontWeight: filter === item ? 700 : 500, cursor: "pointer" }}>
            {item === "Finalised" ? "Released" : item}{item === "Pending" ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>
      {loading && <p style={{ color: C.textMuted }}>Loading submissions…</p>}
      {error && <p style={{ color: C.red }}>{error}</p>}
      {reminderError && <p role="alert" style={{ color: C.red }}>{reminderError}</p>}

      <p className="submission-summary-note">Lecturer summaries reflect the classes matching the current filters.</p>
      <div className="submission-lecturer-groups">
      {lecturerGroups.map(group => {
        const expanded = expandedGroups.has(group.staffId);
        const contentId = `submission-classes-${encodeURIComponent(group.staffId)}`;
        return <section key={group.staffId} className="admin-table-panel submission-lecturer-group" aria-label={`Classes for ${group.lecturerName} (${group.staffId})`}>
          <h2 className="submission-lecturer-heading">
            <button type="button" className="submission-lecturer-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={() => toggleLecturer(group.staffId)}>
              <ChevronDown size={18} aria-hidden="true" className={expanded ? "submission-chevron" : "submission-chevron is-collapsed"} />
              <span className="submission-lecturer-identity"><span className="submission-lecturer-name">{group.lecturerName}</span><span className="admin-identifier">{group.staffId}</span></span>
              <span className="submission-lecturer-summary"><span>{group.finalised} of {group.classes.length} classes released</span><span>{group.attention} require attention</span></span>
              <AdminStatus status={group.status} />
            </button>
          </h2>
          <div id={contentId} hidden={!expanded}>
          <div className="admin-table-scroll">
        <table aria-label={`Class submissions for ${group.lecturerName} (${group.staffId})`} className="admin-data-table" style={{ width: "100%", minWidth: "800px", borderCollapse: "collapse", textAlign: "left", fontSize: "calc(0.8125rem * var(--staff-text-scale))" }}>
          <thead>
            <tr>
              <th scope="col">Programme</th>
              <th scope="col">Subject</th>
              <th scope="col">Class</th>
              <th scope="col">Submission Status</th>
              <th scope="col">Progress</th>
              <th scope="col">Last Updated</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {group.classes.map(allocation => {
              const finalised = allocation.submissionStatus === "Finalised";
              const sent = sentReminders.has(allocation.staffId);
              return (
                <tr key={allocation.id}>
                  <td><span style={{ color: CC.code, fontWeight: 700 }}>{allocation.programmeCode}</span><br /><span style={{ fontSize: "calc(0.6875rem * var(--staff-text-scale))", color: CC.textMuted }}>{allocation.programmeName}</span></td>
                  <td><span style={{ color: CC.code, fontWeight: 600 }}>{allocation.subjectCode}</span><br /><span style={{ fontSize: "calc(0.6875rem * var(--staff-text-scale))", color: CC.textMuted }}>{allocation.subjectName}</span></td>
                  <td>{allocation.classLabel}</td>
                  <td>
                    <AdminStatus status={allocation.submissionStatus}>
                      {finalised ? <CheckCircle size={12} aria-hidden="true" /> : <Clock size={12} aria-hidden="true" />}
                    </AdminStatus>
                  </td>
                  <td>{allocation.completionRate}%</td>
                  <td>{allocation.lastUpdated}</td>
                  <td>
                    {!finalised ? <button className={sent ? "admin-status admin-status-success" : "staff-primary-action admin-table-action"} disabled={sent || sendingReminders.has(allocation.staffId)} onClick={() => sendReminder(allocation.staffId)}>{sent ? <CheckCircle size={11} aria-hidden="true" /> : <Send size={11} aria-hidden="true" />}{sent ? "Email Queued" : sendingReminders.has(allocation.staffId) ? "Sending…" : "Send Reminder"}</button> : <span style={{ color: CC.textMuted }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
          </div>
          </div>
        </section>;
      })}
      </div>
      {filtered.length === 0 && <div className="admin-table-panel submission-empty-state" role="status">No submissions match the selected programme and status filters.</div>}
    </div>
  );
}
