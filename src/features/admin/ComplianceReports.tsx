import React, { useEffect, useState } from "react";
import { CheckCircle, Download } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { downloadText } from "../../utils/download";
import type { AdminRecordsViewProps } from "../../hooks/useAdminRecords";
import { LecturerInfo } from "../../types";
import { escapeCsv } from "../../utils/csv";

type ReportKey = string;
interface ReportDefinition { key: ReportKey; title: string; description: string; scope: string; meta: string; filename: string; records: LecturerInfo[]; }

export function ComplianceReports({ records, context, loading, error }: AdminRecordsViewProps) {
  const C = useColors();
  const [downloaded, setDownloaded] = useState<ReportKey | null>(null);
  const [selectedProgrammeCode, setSelectedProgrammeCode] = useState("");
  const pending = records.filter(item => item.submissionStatus !== "Finalised");
  const studentTotal = records.reduce((sum, item) => sum + item.studentCount, 0);
  const programmeRecords = (code: string) => records.flatMap(item => {
    const assignment = item.programmeAssignments.find(candidate => candidate.code === code);
    return assignment ? [{
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
    }] : [];
  });
  const selectedProgramme = context?.programmes.find(programme => programme.code === selectedProgrammeCode) ?? context?.programmes[0];
  const selectedProgrammeRecords = selectedProgramme ? programmeRecords(selectedProgramme.code) : [];
  const termSlug = context ? `Semester_${context.semesterCode}` : "CurrentSemester";

  useEffect(() => {
    if (!context?.programmes.length) {
      setSelectedProgrammeCode("");
      return;
    }
    setSelectedProgrammeCode(current => context.programmes.some(programme => programme.code === current) ? current : context.programmes[0].code);
  }, [context]);

  const reports: ReportDefinition[] = [
    { key: "overall", title: "Overall Compliance Report", description: "Full lecturer submission status across the faculty.", scope: "Faculty", meta: `${records.length} lecturers`, filename: `Compliance_AllProgrammes_${termSlug}.csv`, records },
    { key: "programme", title: "Programme Compliance Report", description: "Submission status for the selected academic programme.", scope: selectedProgramme?.code ?? "Select programme", meta: `${selectedProgrammeRecords.length} lecturers`, filename: `Compliance_${selectedProgramme?.code ?? "Programme"}_${termSlug}.csv`, records: selectedProgrammeRecords },
    { key: "pending", title: "Pending Submissions List", description: "Lecturers requiring submission follow-up.", scope: "Exceptions", meta: `${pending.length} pending`, filename: `PendingList_${termSlug}.csv`, records: pending },
    { key: "workload", title: "Lecturer Workload Summary", description: "Current-semester subject assignments, enrolment totals and submission progress.", scope: "Faculty", meta: `${studentTotal} enrolments`, filename: `LecturerWorkload_${termSlug}.csv`, records },
  ];

  const exportReport = (report: ReportDefinition) => {
    const header = ["Staff ID", "Lecturer", "Programme", "Subject Code", "Subject Name", "Semester Code", "Academic Semester", "Students", "Deadline", "Submission Status", "Completion Rate"];
    const rows = report.records.map(item => [item.id, item.name, item.department, item.subjects.join("; "), item.subjectName, context?.semesterCode ?? "", context?.termLabel ?? "", item.studentCount, item.deadline, item.submissionStatus, `${item.completionRate}%`].map(escapeCsv).join(","));
    downloadText(report.filename, [header.join(","), ...rows].join("\n"));
    setDownloaded(report.key);
    window.setTimeout(() => setDownloaded(null), 2500);
  };

  return (
    <div>
      <div className="responsive-action-header" style={{ marginBottom: "22px", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: C.maroon, fontFamily: C.mono, fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, letterSpacing: ".1em", marginBottom: "7px" }}>OFFICIAL OUTPUTS</div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(1.5rem * var(--staff-text-scale))", color: C.text, margin: "0 0 4px" }}>Reports &amp; Exports</h1>
          <p style={{ fontSize: "calc(0.8125rem * var(--staff-text-scale))", color: C.textMuted, margin: 0 }}>Select a report by academic scope and download its current CSV record.</p>
        </div>
        <span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>{context?.termLabel.toUpperCase() ?? "CURRENT SEMESTER"}</span>
      </div>

      {loading && <p style={{ color: C.textMuted }}>Loading report data…</p>}
      {error && <p role="alert" style={{ color: C.red }}>{error}</p>}

      <div className="report-catalogue">
        <table style={{ width: "100%", minWidth: "790px", borderCollapse: "collapse", fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>
          <thead>
            <tr style={{ borderTop: `2px solid ${C.maroon}`, borderBottom: `1px solid ${C.borderMid}` }}>
              {["Report", "Scope", "Included records", "Format", ""].map((label, index) => (
                <th key={`${label}-${index}`} style={{ padding: "10px", textAlign: index === 4 ? "right" : "left", color: C.textMuted, fontFamily: C.mono, fontSize: "calc(0.6875rem * var(--staff-text-scale))", letterSpacing: ".06em", fontWeight: 700 }}>{label.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map(report => {
              const complete = downloaded === report.key;
              return (
                <tr key={report.key} style={{ borderBottom: `1px solid ${C.borderMid}` }}>
                  <td style={{ padding: "15px 10px", maxWidth: "330px" }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: "calc(0.8125rem * var(--staff-text-scale))" }}>{report.title}</div>
                    <div style={{ color: C.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))", marginTop: "4px", lineHeight: 1.45 }}>{report.description}</div>
                  </td>
                  <td style={{ padding: "15px 10px", color: C.maroon, fontFamily: C.mono, fontWeight: 700 }}>
                    {report.key === "programme" ? (
                      <select
                        aria-label="Programme for compliance report"
                        value={selectedProgramme?.code ?? ""}
                        onChange={event => { setSelectedProgrammeCode(event.target.value); setDownloaded(null); }}
                        disabled={loading || !context?.programmes.length}
                        style={{ width: "100%", minWidth: "220px", maxWidth: "320px", padding: "8px 10px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "5px", color: C.text, fontFamily: C.sans, fontSize: "calc(0.75rem * var(--staff-text-scale))", cursor: loading ? "wait" : "pointer" }}
                      >
                        {!context?.programmes.length && <option value="">No programmes available</option>}
                        {context?.programmes.map(programme => <option key={programme.id} value={programme.code}>{programme.code} — {programme.name}</option>)}
                      </select>
                    ) : report.scope}
                  </td>
                  <td style={{ padding: "15px 10px", color: C.textSub, fontFamily: C.mono, fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>{report.meta}</td>
                  <td style={{ padding: "15px 10px", color: C.textMuted, fontFamily: C.mono, fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>CSV</td>
                  <td style={{ padding: "15px 10px", textAlign: "right" }}>
                    <button disabled={report.key === "programme" && !selectedProgramme} onClick={() => exportReport(report)} style={{ minWidth: "118px", padding: "8px 11px", border: `1px solid ${complete ? C.green : C.maroon}66`, borderRadius: "4px", background: complete ? C.greenLight : "transparent", color: complete ? C.green : C.maroon, cursor: report.key === "programme" && !selectedProgramme ? "not-allowed" : "pointer", opacity: report.key === "programme" && !selectedProgramme ? .55 : 1, fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", whiteSpace: "nowrap" }}>
                      {complete ? <CheckCircle size={13} /> : <Download size={13} />}
                      {complete ? "Downloaded" : "Download CSV"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
