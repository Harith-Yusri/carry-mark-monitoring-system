import React, { useState } from "react";
import { CheckCircle, Download } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { downloadText } from "../../utils/download";
import { useAdminRecords } from "../../hooks/useAdminRecords";
import { LecturerInfo, ProgrammeCode } from "../../types";

type ReportKey = "overall" | ProgrammeCode | "pending" | "marks";
interface ReportDefinition { key: ReportKey; title: string; description: string; scope: string; meta: string; filename: string; records: LecturerInfo[]; }

export function ComplianceReports() {
  const C = useColors();
  const { records } = useAdminRecords();
  const programmeNames: Record<ProgrammeCode, string> = { CS: "Computer Science", IT: "Information Technology", IS: "Information Systems" };
  const [downloaded, setDownloaded] = useState<ReportKey | null>(null);
  const pending = records.filter(item => item.submissionStatus !== "Finalised");
  const studentTotal = records.reduce((sum, item) => sum + item.studentCount, 0);
  const programmeRecords = (code: ProgrammeCode) => records.filter(item => item.programmeCode === code);

  const reports: ReportDefinition[] = [
    { key: "overall", title: "Overall Compliance Report", description: "Full lecturer submission status across the faculty.", scope: "Faculty", meta: `${records.length} lecturers`, filename: "Compliance_AllProg_Sem2_2526.csv", records },
    { key: "CS", title: "Computer Science Compliance", description: `Submission status for ${programmeNames.CS}.`, scope: "CS", meta: `${programmeRecords("CS").length} lecturers`, filename: "Compliance_CS_Sem2_2526.csv", records: programmeRecords("CS") },
    { key: "IT", title: "Information Technology Compliance", description: `Submission status for ${programmeNames.IT}.`, scope: "IT", meta: `${programmeRecords("IT").length} lecturers`, filename: "Compliance_IT_Sem2_2526.csv", records: programmeRecords("IT") },
    { key: "IS", title: "Information Systems Compliance", description: `Submission status for ${programmeNames.IS}.`, scope: "IS", meta: `${programmeRecords("IS").length} lecturers`, filename: "Compliance_IS_Sem2_2526.csv", records: programmeRecords("IS") },
    { key: "pending", title: "Pending Submissions List", description: "Lecturers requiring submission follow-up.", scope: "Exceptions", meta: `${pending.length} pending`, filename: "PendingList_Sem2_2526.csv", records: pending },
    { key: "marks", title: "Full Carry Mark Summary", description: "Faculty enrolment and submission summary by subject.", scope: "Faculty", meta: `${studentTotal} students`, filename: "FullMarkSummary_Sem2_2526.csv", records },
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
          <div style={{ color: C.maroon, fontFamily: C.mono, fontSize: "10px", fontWeight: 700, letterSpacing: ".1em", marginBottom: "7px" }}>OFFICIAL OUTPUTS</div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 4px" }}>Reports &amp; Exports</h1>
          <p style={{ fontSize: "12px", color: C.textMuted, margin: 0 }}>Select a report by academic scope and download its current CSV record.</p>
        </div>
        <span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>SEM 2 · 2025/2026</span>
      </div>

      <div className="report-catalogue">
        <table style={{ width: "100%", minWidth: "790px", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ borderTop: `2px solid ${C.maroon}`, borderBottom: `1px solid ${C.borderMid}` }}>
              {["Report", "Scope", "Included records", "Format", ""].map((label, index) => (
                <th key={`${label}-${index}`} style={{ padding: "10px", textAlign: index === 4 ? "right" : "left", color: C.textMuted, fontFamily: C.mono, fontSize: "9px", letterSpacing: ".06em", fontWeight: 700 }}>{label.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map(report => {
              const complete = downloaded === report.key;
              return (
                <tr key={report.key} style={{ borderBottom: `1px solid ${C.borderMid}` }}>
                  <td style={{ padding: "15px 10px", maxWidth: "330px" }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: "12px" }}>{report.title}</div>
                    <div style={{ color: C.textMuted, fontSize: "10px", marginTop: "4px", lineHeight: 1.45 }}>{report.description}</div>
                  </td>
                  <td style={{ padding: "15px 10px", color: C.maroon, fontFamily: C.mono, fontWeight: 700 }}>{report.scope}</td>
                  <td style={{ padding: "15px 10px", color: C.textSub, fontFamily: C.mono, fontSize: "10px" }}>{report.meta}</td>
                  <td style={{ padding: "15px 10px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>CSV</td>
                  <td style={{ padding: "15px 10px", textAlign: "right" }}>
                    <button onClick={() => exportReport(report)} style={{ minWidth: "118px", padding: "8px 11px", border: `1px solid ${complete ? C.green : C.maroon}66`, borderRadius: "4px", background: complete ? C.greenLight : "transparent", color: complete ? C.green : C.maroon, cursor: "pointer", fontSize: "10px", fontWeight: 700 }}>
                      {complete ? <CheckCircle size={13} style={{ marginRight: "6px", verticalAlign: "-2px" }} /> : <Download size={13} style={{ marginRight: "6px", verticalAlign: "-2px" }} />}
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
