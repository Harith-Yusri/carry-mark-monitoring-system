import React, { useState } from "react";
import { Download, FileText, CheckCircle } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { downloadText } from "../../utils/download";
import { facultyLecturersData } from "../../mock/mockData";

export function ComplianceReports() {
  const C = useColors();
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});

  const reports = [
    { key: "rep1", title: "Faculty Overall Carry Mark Compliance Report", desc: "Full submission status across Computer Science and Software Engineering departments.", file: "Faculty_Compliance_Sem2_2026.xlsx" },
    { key: "rep2", title: "Final Exam Ineligibility Summary (<40 Marks)", desc: "List of students scoring under the 40/50 carry mark threshold for Senate review.", file: "Ineligible_Students_Sem2_2026.xlsx" },
    { key: "rep3", title: "UiTM e-Result Master Batch File", desc: "Formatted CSV bundle for all finalised subjects ready for HEA upload.", file: "eResult_Master_Sem2_2026.csv" },
  ];

  const handleDownload = (key: string, filename: string) => {
    const content = ["Lecturer,Department,Subjects,Submission Status,Completion Rate", ...facultyLecturersData.map(item => [`"${item.name}"`, item.department, item.subjects.join(";"), item.submissionStatus, `${item.completionRate}%`].join(","))].join("\n");
    downloadText(filename.replace(/\.xlsx$/, ".csv"), content);
    setDownloaded(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setDownloaded(prev => ({ ...prev, [key]: false }));
    }, 3000);
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "22px", color: C.text, marginBottom: "4px" }}>Reports & System Exports</h1>
        <p style={{ fontSize: "12px", color: C.textMuted }}>Download administrative summary reports and master e-Result submission bundles.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {reports.map(rep => (
          <div key={rep.key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: C.text }}>{rep.title}</div>
              <div style={{ fontSize: "12px", color: C.textMuted, marginTop: "2px" }}>{rep.desc}</div>
              <div style={{ fontSize: "10px", fontFamily: C.mono, color: C.maroon, marginTop: "4px" }}>{rep.file}</div>
            </div>
            <button
              onClick={() => handleDownload(rep.key, rep.file)}
              style={{ padding: "8px 14px", background: downloaded[rep.key] ? C.greenLight : C.maroon, color: downloaded[rep.key] ? C.green : "#fff", border: `1px solid ${downloaded[rep.key] ? C.green : C.maroon}44`, borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              {downloaded[rep.key] ? <CheckCircle size={14} /> : <Download size={14} />}
              {downloaded[rep.key] ? "Downloaded" : "Export Excel/CSV"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
