import React, { useEffect, useState } from "react";
import { CheckCircle, Download } from "lucide-react";
import { useCardColors, useColors } from "./adminStyles";
import { downloadText } from "../../utils/download";
import type { AdminRecordsViewProps } from "../../hooks/useAdminRecords";
import { LecturerInfo } from "../../types";
import { submissionStatusLabel } from "../../utils/releaseTerminology";
import { escapeCsv } from "../../utils/csv";

type ReportKey = string;
interface ReportDefinition { key: ReportKey; title: string; description: string; scope: string; meta: string; filename: string; records: LecturerInfo[]; }

export function ComplianceReports({ records, context, loading, error }: AdminRecordsViewProps) {
  const C = useColors();
  const CC = useCardColors();
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
    const rows = report.records.map(item => [item.id, item.name, item.department, item.subjects.join("; "), item.subjectName, context?.semesterCode ?? "", context?.termLabel ?? "", item.studentCount, item.deadline, submissionStatusLabel(item.submissionStatus), `${item.completionRate}%`].map(escapeCsv).join(","));
    downloadText(report.filename, [header.join(","), ...rows].join("\n"));
    setDownloaded(report.key);
    window.setTimeout(() => setDownloaded(null), 2500);
  };

  return (
    <div>
      <div className="responsive-action-header" style={{ marginBottom: "22px", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: C.brandText, fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, letterSpacing: ".1em", marginBottom: "7px" }}>Official Outputs</div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(1.5rem * var(--staff-text-scale))", color: C.text, margin: "0 0 4px" }}>Reports &amp; Exports</h1>
          <p style={{ fontSize: "calc(0.8125rem * var(--staff-text-scale))", color: C.textMuted, margin: 0 }}>Select a report by academic scope and download its current CSV record.</p>
        </div>
        <span style={{ color: C.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>{context?.termLabel ?? "Current Semester"}</span>
      </div>

      {loading && <p style={{ color: C.textMuted }}>Loading report data…</p>}
      {error && <p role="alert" style={{ color: C.red }}>{error}</p>}

      <div className="admin-table-panel"><div className="admin-table-scroll">
        <table className="admin-data-table" style={{ width: "100%", minWidth: "790px", borderCollapse: "collapse", fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>
          <thead>
            <tr>
              {["Report", "Scope", "Included Records", "Format", "Action"].map((label, index) => (
                <th scope="col" key={`${label}-${index}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map(report => {
              const complete = downloaded === report.key;
              return (
                <tr key={report.key}>
                  <td>
                    <div style={{ color: CC.text, fontWeight: 700, fontSize: "calc(0.8125rem * var(--staff-text-scale))" }}>{report.title}</div>
                    <div style={{ color: CC.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))", marginTop: "4px", lineHeight: 1.45 }}>{report.description}</div>
                  </td>
                  <td>
                    {report.key === "programme" ? (
                      <select
                        aria-label="Programme for compliance report"
                        value={selectedProgramme?.code ?? ""}
                        onChange={event => { setSelectedProgrammeCode(event.target.value); setDownloaded(null); }}
                        disabled={loading || !context?.programmes.length}
                        style={{ width: "100%", minWidth: "220px", maxWidth: "320px", padding: "8px 10px", background: CC.elevated, border: `1px solid ${CC.borderMid}`, borderRadius: "5px", color: CC.text, fontFamily: CC.sans, fontSize: "calc(0.75rem * var(--staff-text-scale))", cursor: loading ? "wait" : "pointer" }}
                      >
                        {!context?.programmes.length && <option value="">No programmes available</option>}
                        {context?.programmes.map(programme => <option key={programme.id} value={programme.code}>{programme.code} — {programme.name}</option>)}
                      </select>
                    ) : report.scope}
                  </td>
                  <td>{report.meta}</td>
                  <td>CSV</td>
                  <td>
                    <button className={complete ? "admin-status admin-status-success" : "staff-primary-action admin-table-action"} disabled={report.key === "programme" && !selectedProgramme} onClick={() => exportReport(report)}>
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
    </div>
  );
}
