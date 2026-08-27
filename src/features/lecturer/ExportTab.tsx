import React, { useState } from "react";
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Download, Users } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { getLecturerClassSections } from "../../mock/mockData";
import { ClassSectionRecord, StudentRecord } from "../../types";
import { downloadText } from "../../utils/download";
import { classSelectorActionStyle, classSelectorCardStyle, classSelectorGridStyle, classSelectorIconStyle, classSelectorMetaStyle, classSelectorTitleStyle } from "./classSelectorStyles";

type ExportClassSection = ClassSectionRecord;
const defaultSections = (code: string): ExportClassSection[] => getLecturerClassSections(code);
function loadSections(code: string): ExportClassSection[] { try { return JSON.parse(localStorage.getItem(`carrymark_class_sections_v2_${code}`) || "null") ?? defaultSections(code); } catch { return defaultSections(code); } }
const rawTotal = (student: StudentRecord) => (student.quiz1 ?? 0) + (student.assign1 ?? 0) + (student.test1 ?? 0) + (student.quiz2 ?? 0) + (student.test2 ?? 0);

export function ExportTab({ subjectCode, subjectName }: { subjectCode: string; subjectName: string }) {
  const C = useColors();
  const [sections] = useState(() => loadSections(subjectCode));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const selected = sections.find(section => section.id === selectedId) ?? null;
  const assessments = (() => { try { return JSON.parse(localStorage.getItem(`carrymark_assessments_${subjectCode}`) || "null") ?? []; } catch { return []; } })();

  if (!selected) return <div>
    <div style={{ marginBottom: "20px" }}><h2 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "20px", color: C.text, margin: "0 0 5px" }}>Select a Class to Export</h2><p style={{ fontSize: "12px", color: C.textMuted, margin: 0 }}>Choose a {subjectCode} class to preview its carry marks before exporting.</p></div>
    <div style={classSelectorGridStyle}>{sections.map(section => <button key={section.id} onClick={() => setSelectedId(section.id)} style={{ ...classSelectorCardStyle, background: C.surface, border: `1px solid ${C.borderMid}`, color: C.text }} onMouseEnter={event => { event.currentTarget.style.borderColor = `${C.maroon}88`; event.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={event => { event.currentTarget.style.borderColor = C.borderMid; event.currentTarget.style.transform = "none"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ ...classSelectorIconStyle, background: C.maroonLight, border: `1px solid ${C.maroon}55`, color: C.maroon }}><Users size={21} /></div><span style={{ padding: "5px 8px", borderRadius: "5px", background: section.finalised ? C.greenLight : C.amberLight, color: section.finalised ? C.green : C.amber, fontFamily: C.mono, fontSize: "9px", fontWeight: 700 }}>{section.finalised ? "FINALISED" : "DRAFT"}</span></div>
      <h3 style={{ ...classSelectorTitleStyle, color: C.text, fontFamily: C.display }}>{section.label}</h3><div style={{ ...classSelectorMetaStyle, color: C.textMuted }}>{section.day} {section.time}<br />{section.room} · {section.students.length} synced</div><div style={{ ...classSelectorActionStyle, color: C.maroon }}>Open e-Res Preview <ChevronRight size={14} /></div>
    </button>)}</div>
  </div>;

  const missing = Math.max(0, selected.capacity - selected.students.length);
  const shortDay = selected.day.slice(0, 3);
  const classSlug = selected.label.replace(/\s+/g, "");
  const filename = `${subjectCode}_${classSlug}_CarryMark_Sem2_2526.csv`;
  const assessmentCount = assessments.length || 5;
  const detailRows = [
    ["Subject Code", subjectCode], ["Subject Name", subjectName], ["Class Section", `${selected.label} (${selected.id})`], ["Schedule", `${shortDay} ${selected.time}`], ["Room", selected.room], ["Semester", "2 / 2025/2026"], ["Students", `${selected.students.length} synced / ${selected.capacity} enrolled`], ["Assessments Finalised", `${assessmentCount} of ${assessmentCount} (All finalised)`], ["Export Format", "UiTM e-Res v3.2 (.csv)"], ["Output Filename", filename],
  ];
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const exportClass = () => {
    const rows = selected.students.map(student => [student.matrixNo, student.name, student.quiz1, student.assign1, student.test1, student.quiz2, student.test2, rawTotal(student)].map(escapeCsv).join(","));
    downloadText(filename, ["Student ID,Name,Quiz 1 /10,Assignment 1 /20,Test 1 /30,Quiz 2 /10,Test 2 /30,Total /100", ...rows].join("\n"));
    setDownloaded(true); window.setTimeout(() => setDownloaded(false), 2500);
  };

  return <div>
    <button onClick={() => setSelectedId(null)} style={{ marginBottom: "14px", padding: 0, border: "none", background: "transparent", color: C.maroon, fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><ChevronLeft size={14} /> Choose another class</button>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(330px, 1fr) minmax(390px, 1fr)", gap: "24px", alignItems: "start" }}>
      <section><h2 style={{ margin: "0 0 5px", color: C.text, fontFamily: C.display, fontSize: "20px", fontWeight: 700 }}>e-Res Export</h2><p style={{ margin: "0 0 20px", color: C.textMuted, fontSize: "12px" }}>{selected.label} · {shortDay} {selected.time} · {selected.room}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{detailRows.map(([label, value]) => <div key={label} style={{ minHeight: "42px", boxSizing: "border-box", padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", fontFamily: C.mono, fontSize: "10px" }}><span style={{ color: C.textMuted }}>{label}</span><strong style={{ color: C.text, textAlign: "right", overflowWrap: "anywhere" }}>{value}</strong></div>)}</div>
        {missing > 0 && <div style={{ marginTop: "16px", padding: "12px 14px", display: "flex", gap: "8px", alignItems: "center", background: C.amberLight, border: `1px solid ${C.amber}66`, borderRadius: "7px", color: C.amber, fontSize: "11px", fontWeight: 600 }}><AlertTriangle size={15} /> {missing} student(s) not yet synced. Export partial marks or sync first.</div>}
        <button disabled={!selected.students.length} onClick={exportClass} style={{ marginTop: "18px", width: "100%", height: "48px", border: "none", borderRadius: "7px", background: selected.students.length ? C.maroon : C.elevated, color: selected.students.length ? "#fff" : C.textMuted, cursor: selected.students.length ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>{downloaded ? <CheckCircle size={17} /> : <Download size={17} />}{downloaded ? "Class Exported" : `Export ${selected.label} to e-Res`}</button>
      </section>

      <section><div style={{ marginBottom: "10px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px", letterSpacing: ".06em" }}>ASSESSMENT MARKS PREVIEW — {selected.label.toUpperCase()}</div><div style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "9px", overflowX: "auto" }}><table style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", textAlign: "left", fontSize: "11px" }}><thead><tr style={{ background: C.elevated, color: C.textMuted, fontFamily: C.mono, fontSize: "9px" }}><th style={{ padding: "11px 10px" }}>STUDENT ID</th><th style={{ padding: "11px 10px" }}>NAME</th><th style={{ padding: "11px 10px" }}>QUIZ 1 /10</th><th style={{ padding: "11px 10px" }}>ASSIGN. 1 /20</th><th style={{ padding: "11px 10px" }}>TEST 1 /30</th><th style={{ padding: "11px 10px" }}>QUIZ 2 /10</th><th style={{ padding: "11px 10px" }}>TEST 2 /30</th><th style={{ padding: "11px 10px" }}>TOTAL /100</th></tr></thead><tbody>{selected.students.map(student => { const mark = rawTotal(student); return <tr key={student.id} style={{ borderTop: `1px solid ${C.borderMid}` }}><td style={{ padding: "12px 10px", color: C.textMuted, fontFamily: C.mono }}>{student.matrixNo}</td><td style={{ padding: "12px 10px", color: C.text, fontWeight: 600, whiteSpace: "nowrap" }}>{student.name}</td><td style={{ padding: "12px 10px", color: C.textSub, fontFamily: C.mono }}>{student.quiz1 ?? "—"}</td><td style={{ padding: "12px 10px", color: C.textSub, fontFamily: C.mono }}>{student.assign1 ?? "—"}</td><td style={{ padding: "12px 10px", color: C.textSub, fontFamily: C.mono }}>{student.test1 ?? "—"}</td><td style={{ padding: "12px 10px", color: C.textSub, fontFamily: C.mono }}>{student.quiz2 ?? "—"}</td><td style={{ padding: "12px 10px", color: C.textSub, fontFamily: C.mono }}>{student.test2 ?? "—"}</td><td style={{ padding: "12px 10px", color: mark >= 80 ? C.green : C.amber, fontFamily: C.mono, fontWeight: 700 }}>{mark}</td></tr>; })}</tbody></table>{!selected.students.length && <div style={{ padding: "30px", textAlign: "center", color: C.textMuted, fontSize: "11px" }}>No synced assessment marks to preview.</div>}</div><div style={{ marginTop: "10px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>{selected.students.length} of {selected.capacity} students · all assessment components</div></section>
    </div>
  </div>;
}
