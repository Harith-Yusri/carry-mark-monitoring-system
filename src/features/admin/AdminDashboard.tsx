import React from "react";
import { CheckCircle } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { useReminders } from "../../hooks/useReminders";
import { useAdminRecords } from "../../hooks/useAdminRecords";

export function AdminDashboard() {
  const C = useColors();
  const { records, context, loading, error } = useAdminRecords();
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
  const compliance = total ? Math.round((submitted / total) * 100) : 0;

  return (
    <div>
      <div className="responsive-action-header" style={{ marginBottom: "22px" }}>
        <div>
          <div style={{ color: C.maroon, fontFamily: C.mono, fontSize: "10px", fontWeight: 700, letterSpacing: ".11em", marginBottom: "7px" }}>{context?.termLabel.toUpperCase() ?? "CURRENT TERM"}</div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "25px", color: C.text, margin: "0 0 5px" }}>Academic Operations</h1>
          <p style={{ fontSize: "12px", color: C.textMuted, margin: 0 }}>Carry mark readiness, submission exceptions and programme follow-up.</p>
        </div>
        <div style={{ textAlign: "right", color: C.textMuted, fontFamily: C.mono, fontSize: "10px", lineHeight: 1.6 }}>
          LIVE FACULTY RECORDS<br />SUPABASE SYNCED
        </div>
      </div>

      {loading && <p style={{ color: C.textMuted }}>Loading academic operations…</p>}
      {error && <p role="alert" style={{ color: C.red }}>{error}</p>}
      {reminderError && <p role="alert" style={{ color: C.red }}>{reminderError}</p>}

      <section className="operations-summary" style={{ borderColor: C.borderMid }} aria-label="Submission summary">
        {[
          { value: pendingLecturers.length, label: "REQUIRE ATTENTION", note: "Not finalised", color: C.amber },
          { value: overdue, label: "OVERDUE", note: "Past submission date", color: C.red },
          { value: submitted, label: "FINALISED", note: `of ${total} lecturer records`, color: C.green },
          { value: `${compliance}%`, label: "FACULTY COMPLIANCE", note: "Current semester", color: C.maroon },
        ].map(item => (
          <div key={item.label} style={{ borderColor: C.borderMid }}>
            <div style={{ color: item.color, fontFamily: C.mono, fontSize: "24px", fontWeight: 700, lineHeight: 1 }}>{item.value}</div>
            <div style={{ color: C.textSub, fontFamily: C.mono, fontSize: "9px", fontWeight: 700, marginTop: "9px", letterSpacing: ".07em" }}>{item.label}</div>
            <div style={{ color: C.textMuted, fontSize: "10px", marginTop: "4px" }}>{item.note}</div>
          </div>
        ))}
      </section>

      <div className="operations-layout">
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px", marginBottom: "11px" }}>
            <div>
              <h2 style={{ margin: 0, color: C.text, fontFamily: C.display, fontSize: "16px", fontWeight: 700 }}>Attention queue</h2>
              <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: "11px" }}>Overdue and incomplete submissions, ordered by urgency.</p>
            </div>
            <span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>{pendingLecturers.length} OPEN</span>
          </div>

          <div style={{ borderTop: `2px solid ${C.maroon}` }}>
            {pendingLecturers.length === 0 && (
              <div style={{ padding: "24px 0", color: C.green, fontSize: "12px" }}>All lecturer submissions are finalised.</div>
            )}
            {pendingLecturers.map(lecturer => {
              const sent = sentReminders.has(lecturer.id);
              const isSending = sendingReminders.has(lecturer.id);
              const statusColor = lecturer.submissionStatus === "Overdue" ? C.red : C.amber;
              return (
                <div className="attention-row" key={lecturer.id} style={{ display: "grid", gridTemplateColumns: "minmax(190px, 1fr) minmax(105px, .52fr) auto", alignItems: "center", gap: "18px", padding: "14px 4px", borderBottom: `1px solid ${C.borderMid}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ color: C.text, fontSize: "12px", fontWeight: 700 }}>{lecturer.name}</span>
                      <span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "9px" }}>{lecturer.programmeCodes.join(", ") || "NO PROGRAMME"} · {lecturer.id}</span>
                    </div>
                    <div style={{ color: C.textMuted, fontSize: "10px", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lecturer.subjects.join(", ")} · {lecturer.subjectName}</div>
                  </div>
                  <div>
                    <div style={{ color: statusColor, fontFamily: C.mono, fontSize: "9px", fontWeight: 700, letterSpacing: ".04em" }}>{lecturer.submissionStatus.toUpperCase()}</div>
                    <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "9px", marginTop: "4px" }}>{lecturer.completionRate}% · due {lecturer.deadline}</div>
                  </div>
                  <button
                    disabled={sent || isSending}
                    onClick={() => sendReminder(lecturer.id)}
                    style={{ minWidth: "108px", padding: "7px 10px", borderRadius: "4px", border: `1px solid ${sent ? C.green : C.maroon}66`, background: sent ? C.greenLight : "transparent", color: sent ? C.green : C.maroon, fontSize: "10px", fontWeight: 700, cursor: sent ? "default" : "pointer" }}
                  >
                    {sent && <CheckCircle size={12} style={{ marginRight: "5px", verticalAlign: "-2px" }} />}
                    {sent ? "Email queued" : isSending ? "Sending…" : "Send reminder"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 style={{ margin: "0 0 4px", color: C.text, fontFamily: C.display, fontSize: "16px", fontWeight: 700 }}>Programme completion</h2>
          <p style={{ margin: "0 0 11px", color: C.textMuted, fontSize: "11px" }}>Finalisation by academic programme.</p>
          <div style={{ borderTop: `2px solid ${C.textSub}` }}>
            {programmes.map(programme => {
              const programmeTotal = programme.submitted + programme.pending;
              const rate = programmeTotal ? Math.round(programme.submitted / programmeTotal * 100) : 0;
              return (
                <div key={programme.code} style={{ padding: "16px 2px", borderBottom: `1px solid ${C.borderMid}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "baseline" }}>
                    <div>
                      <span style={{ color: C.maroon, fontFamily: C.mono, fontWeight: 700, fontSize: "11px", marginRight: "8px" }}>{programme.code}</span>
                      <span style={{ color: C.textSub, fontSize: "11px" }}>{programme.name}</span>
                    </div>
                    <span style={{ color: C.text, fontFamily: C.mono, fontWeight: 700, fontSize: "14px" }}>{rate}%</span>
                  </div>
                  <div style={{ height: "4px", background: C.elevated, overflow: "hidden", margin: "11px 0 7px" }}><div style={{ width: `${rate}%`, height: "100%", background: rate === 100 ? C.green : C.maroon }} /></div>
                  <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "9px" }}>{programme.submitted} finalised · {programme.pending} pending · {programmeTotal} total</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
