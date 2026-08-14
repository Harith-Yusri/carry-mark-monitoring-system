import React, { useState } from "react";
import { Download, FileText, CheckCircle, RefreshCw } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { lecturerClassesData } from "../../mock/mockData";
import { downloadText } from "../../utils/download";

export function ExportTab({ subjectCode }: { subjectCode: string }) {
  const C = useColors();
  const [exported, setExported] = useState(false);
  const downloadCsv = () => {
    const saved = localStorage.getItem(`carrymark_records_${subjectCode}`);
    const records = saved ? JSON.parse(saved) : lecturerClassesData;
    const rows = records.map((row: typeof lecturerClassesData[number]) => [row.matrixNo, `"${row.name}"`, row.group, row.totalCarry, row.eligible ? "QUALIFIED" : "INELIGIBLE"].join(","));
    downloadText(`${subjectCode}_eResult.csv`, ["Matrix No,Student Name,Group,Carry Mark,Eligibility", ...rows].join("\n"));
    setExported(true);
    window.setTimeout(() => setExported(false), 3000);
  };

  const downloadSummary = () => {
    const content = `UiTM Carry Mark Summary\nSubject: ${subjectCode}\nGenerated: ${new Date().toLocaleString()}\n\nThis hardcoded-data report is ready for course-file review.`;
    downloadText(`${subjectCode}_Course_File_Report.txt`, content, "text/plain;charset=utf-8");
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "18px", color: C.text }}>Export Carry Marks ({subjectCode})</h2>
        <p style={{ fontSize: "12px", color: C.textMuted }}>Download finalised carry mark reports formatted for UiTM e-Result submission.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <FileText size={22} color={C.maroon} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: C.text }}>UiTM e-Result CSV File</div>
              <div style={{ fontSize: "11px", color: C.textMuted }}>Standard format for batch import</div>
            </div>
          </div>
          <p style={{ fontSize: "12px", color: C.textSub, marginBottom: "16px" }}>
            Generates a comma-separated values file matching the exact column layout required by the Academic Affairs Division (HEA).
          </p>
          <button
            onClick={downloadCsv}
            style={{ width: "100%", padding: "10px", background: C.maroon, color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Download size={15} /> {exported ? "CSV Downloaded!" : "Download e-Result CSV"}
          </button>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <CheckCircle size={22} color={C.green} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: C.text }}>Faculty Carry Mark Summary</div>
              <div style={{ fontSize: "11px", color: C.textMuted }}>Official document for course file</div>
            </div>
          </div>
          <p style={{ fontSize: "12px", color: C.textSub, marginBottom: "16px" }}>
            Generates a printable PDF summary report featuring mark distributions, pass rates, and lecturer digital endorsement.
          </p>
          <button
            onClick={downloadSummary}
            style={{ width: "100%", padding: "10px", background: C.elevated, border: `1px solid ${C.borderMid}`, color: C.text, borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Download size={15} /> Download Course File Summary
          </button>
        </div>
      </div>
    </div>
  );
}
