import React, { useState } from "react";
import { CheckCircle, Download } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { downloadText } from "../../utils/download";
import { useAdminRecords } from "../../hooks/useAdminRecords";
import { LecturerInfo } from "../../types";

type ReportKey = string;
interface ReportDefinition { key: ReportKey; title: string; description: string; scope: string; meta: string; filename: string; records: LecturerInfo[]; }

export function ComplianceReports() {
  const C = useColors();
  const { records, context, loading, error } = useAdminRecords();
  const [downloaded, setDownloaded] = useState<ReportKey | null>(null);
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
  const termSlug = context ? `Sem${context.semesterNo}_${context.academicYear.replace(/\D/g, "")}` : "CurrentTerm";

  const reports: ReportDefinition[] = [
    { key: "overall", title: "Overall Compliance Report", description: "Full lecturer submission status across the faculty.", scope: "Faculty", meta: `${records.length} lecturers`, filename: `Compliance_AllProgrammes_${termSlug}.csv`, records },
    ...(context?.programmes ?? []).map(programme => ({ key: `programme-${programme.code}`, title: `${programme.name} Compliance`, description: `Submission status for ${programme.name}.`, scope: programme.code, meta: `${programmeRecords(programme.code).length} lecturers`, filename: `Compliance_${programme.code}_${termSlug}.csv`, records: programmeRecords(programme.code) })),
    { key: "pending", title: "Pending Submissions List", description: "Lecturers requiring submission follow-up.", scope: "Exceptions", meta: `${pending.length} pending`, filename: `PendingList_${termSlug}.csv`, records: pending },
    { key: "workload", title: "Lecturer Workload Summary", description: "Current-term subject assignments, enrolment totals and submission progress.", scope: "Faculty", meta: `${studentTotal} enrolments`, filename: `LecturerWorkload_${termSlug}.csv`, records },
  ];

  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const exportReport = (report: ReportDefinition) => {
    const header = ["Staff ID", "Lecturer", "Programme", "Subject Code", "Subject Name", "Students", "Deadline", "Submission Status", "Completion Rate"];
    const rows = report.records.map(item => [item.id, item.name, item.department, item.subjects.join("; "), item.subjectName, item.studentCount, item.deadline, item.submissionStatus, `${item.completionRate}%`].map(escapeCsv).join(","));
    downloadText(report.filename, [header.join(","), ...rows].join("\n"));
    setDownloaded(report.key);
    window.setTimeout(() => setDownloaded(null), 2500);
  };

  return (
    <div>
      <div className="responsive-action-header" style={{ marginBottom: "22px", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: C.maroon, fontFamily: C.mono, fontSize: "11px", fontWeight: 700, letterSpacing: ".1em", marginBottom: "7px" }}>OFFICIAL OUTPUTS</div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 4px" }}>Reports &amp; Exports</h1>
          <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Select a report by academic scope and download its current CSV record.</p>
        </div>
        <span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "11px" }}>{context?.termLabel.toUpperCase() ?? "CURRENT TERM"}</span>
      </div>

      {loading && <p style={{ color: C.textMuted }}>Loading report data…</p>}
      {error && <p role="alert" style={{ color: C.red }}>{error}</p>}

      <div className="report-catalogue">
        <table style={{ width: "100%", minWidth: "790px", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ borderTop: `2px solid ${C.maroon}`, borderBottom: `1px solid ${C.borderMid}` }}>
              {["Report", "Scope", "Included records", "Format", ""].map((label, index) => (
                <th key={`${label}-${index}`} style={{ padding: "10px", textAlign: index === 4 ? "right" : "left", color: C.textMuted, fontFamily: C.mono, fontSize: "11px", letterSpacing: ".06em", fontWeight: 700 }}>{label.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map(report => {
              const complete = downloaded === report.key;
              return (
                <tr key={report.key} style={{ borderBottom: `1px solid ${C.borderMid}` }}>
                  <td style={{ padding: "15px 10px", maxWidth: "330px" }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: "13px" }}>{report.title}</div>
                    <div style={{ color: C.textMuted, fontSize: "11px", marginTop: "4px", lineHeight: 1.45 }}>{report.description}</div>
                  </td>
                  <td style={{ padding: "15px 10px", color: C.maroon, fontFamily: C.mono, fontWeight: 700 }}>{report.scope}</td>
                  <td style={{ padding: "15px 10px", color: C.textSub, fontFamily: C.mono, fontSize: "11px" }}>{report.meta}</td>
                  <td style={{ padding: "15px 10px", color: C.textMuted, fontFamily: C.mono, fontSize: "11px" }}>CSV</td>
                  <td style={{ padding: "15px 10px", textAlign: "right" }}>
                    <button onClick={() => exportReport(report)} style={{ minWidth: "118px", padding: "8px 11px", border: `1px solid ${complete ? C.green : C.maroon}66`, borderRadius: "4px", background: complete ? C.greenLight : "transparent", color: complete ? C.green : C.maroon, cursor: "pointer", fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", whiteSpace: "nowrap" }}>
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
