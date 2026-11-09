import { InitialDataState, RefreshStatus } from "../../components/StaffDataState";
import React from "react";
import { CheckCircle } from "lucide-react";
import { AdminStatus, useCardColors, useColors } from "./adminStyles";
import { useReminders } from "../../hooks/useReminders";
import type { AdminRecordsViewProps } from "../../hooks/useAdminRecords";

export function AdminDashboard({ records, context, loading, error }: AdminRecordsViewProps) {
  const C = useColors();
  const CC = useCardColors();
  const { sendReminder, sentReminders, sendingReminders, reminderError } = useReminders();
  const programmes = (context?.programmes ?? []).map(programme => {
    const lecturers = records.filter(item => item.programmeCodes.includes(programme.code));
    const submitted = lecturers.filter(item => item.programmeAssignments.find(assignment => assignment.code === programme.code)?.submissionStatus === "Finalised").length;
    return { ...programme, submitted, pending: lecturers.length - submitted };
  });
  const pendingLecturers = records
    .filter(item => item.submissionStatus !== "Finalised")
    .sort((a, b) => Number(b.submissionStatus === "Overdue") - Number(a.submissionStatus === "Overdue") || a.completionRate - b.completionRate);
  const total = records.length;
  const submitted = records.filter(item => item.submissionStatus === "Finalised").length;
  const overdue = records.filter(item => item.submissionStatus === "Overdue").length;

  if (!context) return <InitialDataState title="Academic Operations" label="Loading academic operations…" error={error} layout="metrics" />;

  return (
    <div>
      <div className="responsive-action-header" style={{ marginBottom: "22px" }}>
        <div>
          <div style={{ color: C.brandText, fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, letterSpacing: ".11em", marginBottom: "7px" }}>{context?.termLabel ?? "Current Semester"}</div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(1.5625rem * var(--staff-text-scale))", color: C.text, margin: "0 0 5px" }}>Academic Operations</h1>
          <p style={{ fontSize: "calc(0.8125rem * var(--staff-text-scale))", color: C.textMuted, margin: 0 }}>Continuous assessment readiness, submission exceptions and programme follow-up.</p>
        </div>
      </div>

      {loading && <RefreshStatus label="Refreshing academic operations…" />}
      {error && <p role="alert" style={{ color: C.red }}>{error}</p>}
      {reminderError && <p role="alert" style={{ color: C.red }}>{reminderError}</p>}

      <section className="operations-summary admin-metrics" aria-label="Submission summary">
        {[
          { value: pendingLecturers.length, label: "Require Attention", note: "Not released", tone: "attention" },
          { value: overdue, label: "Overdue", note: "Past submission date", tone: "overdue" },
          { value: submitted, label: "Released", note: `of ${total} lecturer records`, tone: "finalised" },
        ].map(item => (
          <div key={item.label} className="admin-metric-card" data-tone={item.tone}>
            <div style={{ color: "var(--metric-ink)", fontSize: "calc(1.5rem * var(--staff-text-scale))", fontWeight: 700, lineHeight: 1 }}>{item.value}</div>
            <div style={{ color: "var(--metric-ink)", fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, marginTop: "9px", letterSpacing: ".07em" }}>{item.label}</div>
            <div style={{ color: "var(--metric-note)", fontSize: "calc(0.6875rem * var(--staff-text-scale))", marginTop: "4px" }}>{item.note}</div>
          </div>
        ))}
      </section>

      <div className="operations-layout">
        <section className="staff-content-card admin-attention-panel p-5">
          <div className="admin-panel-header" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px", marginBottom: "11px" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--operations-accent)", fontFamily: CC.display, fontSize: "calc(1rem * var(--staff-text-scale))", fontWeight: 700 }}>Attention Queue</h2>
              <p style={{ margin: "4px 0 0", color: "var(--operations-muted)", fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>Overdue and incomplete submissions, ordered by urgency.</p>
            </div>
            <span style={{ color: "var(--operations-muted)", fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>{pendingLecturers.length} Open</span>
          </div>

          <div style={{ borderTop: "1px solid var(--operations-divider)" }}>
            {pendingLecturers.length === 0 && (
              <div style={{ padding: "24px 0", color: CC.green, fontSize: "calc(0.8125rem * var(--staff-text-scale))" }}>{total ? "All lecturer submissions are released." : "No lecturer records for this semester."}</div>
            )}
            {pendingLecturers.map(lecturer => {
              const sent = sentReminders.has(lecturer.id);
              const isSending = sendingReminders.has(lecturer.id);
              return (
                <div className="attention-row" key={lecturer.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: "18px", padding: "14px 4px", borderBottom: "1px solid var(--operations-divider)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ color: CC.text, fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontWeight: 700 }}>{lecturer.name}</span>
                      <span style={{ color: "var(--operations-muted)", fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>{lecturer.programmeCodes.join(", ") || "No Programme"} · <span className="admin-identifier">{lecturer.id}</span></span>
                    </div>
                    <div style={{ color: "var(--operations-muted)", fontSize: "calc(0.6875rem * var(--staff-text-scale))", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lecturer.subjects.join(", ")} · {lecturer.subjectName}</div>
                  </div>
                  <div>
                    <AdminStatus status={lecturer.submissionStatus} />
                    <div style={{ color: "var(--operations-muted)", fontSize: "calc(0.6875rem * var(--staff-text-scale))", marginTop: "4px" }}>{lecturer.completionRate}% · due {lecturer.deadline}</div>
                  </div>
                  <button
                    className={sent ? "admin-status admin-status-success" : "staff-primary-action admin-table-action"}
                    disabled={sent || isSending}
                    onClick={() => sendReminder(lecturer.id)}
                  >
                    {sent && <CheckCircle size={12} />}
                    {sent ? "Email Queued" : isSending ? "Sending…" : "Send Reminder"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="staff-content-card admin-completion-panel p-5">
          <div className="admin-panel-header" style={{ marginBottom: "11px" }}>
          <h2 style={{ margin: "0 0 4px", color: "var(--operations-accent)", fontFamily: CC.display, fontSize: "calc(1rem * var(--staff-text-scale))", fontWeight: 700 }}>Programme Completion</h2>
          <p style={{ margin: 0, color: "var(--operations-muted)", fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>Release progress by academic programme.</p>
          </div>
          <div style={{ borderTop: "1px solid var(--operations-divider)" }}>
            {programmes.map(programme => {
              const programmeTotal = programme.submitted + programme.pending;
              const rate = programmeTotal ? Math.round(programme.submitted / programmeTotal * 100) : 0;
              return (
                <div key={programme.code} style={{ padding: "16px 2px", borderBottom: "1px solid var(--operations-divider)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "baseline" }}>
                    <div>
                      <span style={{ color: "var(--operations-accent)", fontWeight: 700, fontSize: "calc(0.75rem * var(--staff-text-scale))", marginRight: "8px" }}>{programme.code}</span>
                      <span style={{ color: CC.textSub, fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>{programme.name}</span>
                    </div>
                    <span style={{ color: CC.text, fontWeight: 700, fontSize: "calc(0.875rem * var(--staff-text-scale))" }}>{rate}%</span>
                  </div>
                  <div style={{ height: "4px", background: CC.elevated, overflow: "hidden", margin: "11px 0 7px" }}><div style={{ width: `${rate}%`, height: "100%", background: rate === 100 ? CC.green : "var(--operations-accent)" }} /></div>
                  <div style={{ color: "var(--operations-muted)", fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>{programme.submitted} released · {programme.pending} pending · {programmeTotal} total</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
