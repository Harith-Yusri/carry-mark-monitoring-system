import React, { useState } from "react";
import { CheckCircle, Download } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { downloadText } from "../../utils/download";
import { facultyLecturersData, programmeNames } from "../../mock/mockData";
import { LecturerInfo, ProgrammeCode } from "../../types";

type ReportKey = "overall" | ProgrammeCode | "pending" | "marks";
interface ReportDefinition { key: ReportKey; title: string; description: string; meta: string; filename: string; records: LecturerInfo[]; }

export function ComplianceReports() {
  const C = useColors();
  const [downloaded, setDownloaded] = useState<ReportKey | null>(null);
  const pending = facultyLecturersData.filter(item => item.submissionStatus !== "Finalised");
  const studentTotal = facultyLecturersData.reduce((sum, item) => sum + item.studentCount, 0);
  const programmeRecords = (code: ProgrammeCode) => facultyLecturersData.filter(item => item.programmeCode === code);

  const reports: ReportDefinition[] = [
    { key: "overall", title: "Overall Compliance Report", description: "Full submission status for all lecturers across all programmes.", meta: `All · ${facultyLecturersData.length} lecturers`, filename: "Compliance_AllProg_Sem2_2526.csv", records: facultyLecturersData },
    { key: "CS", title: "CS Programme Report", description: `Submission status for ${programmeNames.CS} programme lecturers only.`, meta: `CS · ${programmeRecords("CS").length} lecturers`, filename: "Compliance_CS_Sem2_2526.csv", records: programmeRecords("CS") },
    { key: "IT", title: "IT Programme Report", description: `Submission status for ${programmeNames.IT} programme lecturers only.`, meta: `IT · ${programmeRecords("IT").length} lecturers`, filename: "Compliance_IT_Sem2_2526.csv", records: programmeRecords("IT") },
    { key: "IS", title: "IS Programme Report", description: `Submission status for ${programmeNames.IS} programme lecturers only.`, meta: `IS · ${programmeRecords("IS").length} lecturers`, filename: "Compliance_IS_Sem2_2526.csv", records: programmeRecords("IS") },
    { key: "pending", title: "Pending Submissions List", description: "List of all lecturers who have not yet submitted marks, for follow-up.", meta: `${pending.length} pending lecturers`, filename: "PendingList_Sem2_2526.csv", records: pending },
    { key: "marks", title: "Full Carry Mark Summary", description: "Complete faculty carry mark enrolment and submission summary across all subjects.", meta: `${studentTotal} students total`, filename: "FullMarkSummary_Sem2_2526.csv", records: facultyLecturersData },
  ];

  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const exportReport = (report: ReportDefinition) => {
    const header = ["Staff ID", "Lecturer", "Programme", "Subject Code", "Subject Name", "Students", "Deadline", "Submission Status", "Completion Rate"];
    const rows = report.records.map(item => [item.id, item.name, item.department, item.subjects.join("; "), item.subjectName, item.studentCount, item.deadline, item.submissionStatus, `${item.completionRate}%`].map(escapeCsv).join(","));
    downloadText(report.filename, [header.join(","), ...rows].join("\n"));
    setDownloaded(report.key);
    window.setTimeout(() => setDownloaded(null), 2500);
  };

  return <div>
    <div style={{ marginBottom: "22px" }}><h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 4px" }}>Reports &amp; Exports</h1><p style={{ fontSize: "12px", color: C.textMuted, margin: 0 }}>Download faculty-wide or programme-specific carry mark compliance reports.</p></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(280px, 1fr))", gap: "16px" }}>
      {reports.map(report => {
        const complete = downloaded === report.key;
        return <article key={report.key} role="button" tabIndex={0} onClick={() => exportReport(report)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); exportReport(report); } }} style={{ minHeight: "235px", boxSizing: "border-box", padding: "22px", display: "flex", flexDirection: "column", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", cursor: "pointer", transition: "border-color .15s, transform .15s" }} onMouseEnter={event => { event.currentTarget.style.borderColor = `${C.maroon}88`; event.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={event => { event.currentTarget.style.borderColor = C.borderMid; event.currentTarget.style.transform = "none"; }}>
          <h2 style={{ margin: "0 0 8px", color: C.text, fontFamily: C.display, fontSize: "17px", fontWeight: 700 }}>{report.title}</h2><p style={{ margin: "0 0 14px", color: C.textMuted, fontSize: "11px", lineHeight: 1.5 }}>{report.description}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", fontFamily: C.mono, fontSize: "10px" }}><span style={{ padding: "5px 8px", border: `1px solid ${C.borderMid}`, borderRadius: "5px", color: C.textSub, background: C.elevated }}>{report.meta}</span><span style={{ color: C.textMuted }}>.csv</span></div>
          <div style={{ height: "1px", background: C.borderMid, marginBottom: "14px" }} />
          <button onClick={event => { event.stopPropagation(); exportReport(report); }} style={{ width: "100%", height: "40px", border: "none", borderRadius: "6px", background: complete ? C.green : C.maroon, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontSize: "12px", fontWeight: 700 }}>
            {complete ? <CheckCircle size={15} /> : <Download size={15} />}{complete ? "Report Downloaded" : "Export Report"}
          </button>
        </article>;
      })}
    </div>
  </div>;
}
