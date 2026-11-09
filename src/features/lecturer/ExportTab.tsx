import type { SubjectClassCache } from "../../services/subjectClassCache";
import { InitialDataState, LoadingState, RefreshStatus } from "../../components/StaffDataState";
import React, { useState } from "react";
import { CheckCircle, ChevronLeft, ChevronRight, Download, Users } from "lucide-react";
import { workspace as W } from "./workspaceStyles";
import { downloadText } from "../../utils/download";
import { escapeCsv } from "../../utils/csv";
import { useSubjectClassData } from "../../hooks/useSubjectClassData";

export function ExportTab({ cache, offeringId, offeringIds, subjectCode, subjectName, academicYear, programmeSemester }: { cache?: SubjectClassCache; offeringId: string; offeringIds?: string[]; subjectCode: string; subjectName: string; academicYear: string; programmeSemester: number }) {
  const { sections, selectedId, setSelectedId, selected, assessments, carryMax, loading, hasLoaded, detailLoading, error, reload } = useSubjectClassData(offeringId, offeringIds, cache);
  const [downloaded, setDownloaded] = useState(false);

  if (!hasLoaded) return <InitialDataState title="Select a Class to Export" label="Loading class sections…" error={error} onRetry={() => void reload().catch(() => undefined)} />;

  if (selectedId && !selected) return <div className="space-y-4 p-5">
    <button onClick={() => setSelectedId(null)} className={W.secondary}>‹ Choose another class</button>
    {error ? <p role="alert" className={W.error}>{error}</p> : <LoadingState label="Loading this class's export data…" layout="table" />}
    {error && <button onClick={() => void reload().catch(() => undefined)} className={W.primary}>Try again</button>}
  </div>;

  if (!selected) return <div className="space-y-6">
    {loading && <RefreshStatus label="Refreshing class sections…" />}
    {error && <p role="alert" className={W.error}>{error}</p>}
    <div><h2 className={W.title}>Select a Class to Export</h2><p className={W.muted}>Choose a {subjectCode} class to preview its carry marks before exporting.</p></div>
    <div className={W.grid}>{sections.map(section => <button key={section.id} onClick={() => setSelectedId(section.id)} className={W.classCard + " flex flex-col " + (section.finalised ? "staff-card-success" : "staff-card-pending")}>
      <div className="mb-5 flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-50 text-purple-800"><Users size={21} /></div><span className={section.finalised ? W.success : W.pending}>{section.finalised ? "RELEASED" : "PENDING"}</span></div>
      <h3 className={W.title + " mb-2"}>{section.label}</h3><div className={W.muted}><strong className="staff-card-primary font-bold text-slate-800 dark:text-slate-50">{section.programmeCode}</strong> · {section.studentCount} students synced · capacity {section.capacity}</div><div className={W.primary + " mt-5 w-full text-xs"}>Open e-Res Preview <ChevronRight size={16} /></div>
    </button>)}</div>
    {!loading && !error && sections.length === 0 && <p className={W.muted}>No class sections are available to export.</p>}
  </div>;

  const classSlug = selected.label.replace(/\s+/g, "");
  const termSlug = `Sem${programmeSemester}_${academicYear.replace(/\D/g, "")}`;
  const filename = `${subjectCode}_${selected.programmeCode}_${classSlug}_CarryMark_${termSlug}.csv`;
  const assessmentStatus = selected.finalised ? `${assessments.length} components · class released` : `${assessments.length} components · pending`;
  const detailRows = [
    ["Subject Code", subjectCode], ["Subject Name", subjectName], ["Programme", `${selected.programmeCode} — ${selected.programmeName}`], ["Class Section", selected.label], ["Programme Semester", programmeSemester], ["Academic Year", academicYear], ["Students", `${selected.students.length} enrolled (capacity ${selected.capacity})`], ["Submission Status", assessmentStatus], ["Export Format", "CSV (.csv)"], ["Output Filename", filename],
  ];
  const exportClass = () => {
    const rows = selected.students.map(student => [student.matrixNo, student.name, ...assessments.map(item => student.scores[item.id]), student.totalCarry].map(escapeCsv).join(","));
    downloadText(filename, [["Student ID", "Name", ...assessments.map(item => `${item.name} /${item.maxMarks}`), `Carry mark /${carryMax ?? "Not set"}`].map(escapeCsv).join(","), ...rows].join("\n"));
    setDownloaded(true); window.setTimeout(() => setDownloaded(false), 2500);
  };

  return <div>
    {(loading || detailLoading) && <RefreshStatus label="Refreshing export data…" />}
    {error && <p role="alert" className={W.error}>{error}</p>}
    <button onClick={() => setSelectedId(null)} className={W.secondary + " mb-6"}><ChevronLeft size={16} /> Choose another class</button>
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <section className={W.panel + " min-w-0 lg:col-span-4"}>
        <h2 className={W.title}>e-Res Export</h2><p className={W.muted + " mb-5"}>{selected.label} · {selected.students.length} enrolled students</p>
        <dl className="divide-y divide-slate-200 dark:divide-slate-700">{detailRows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 py-3"><dt className="staff-card-muted text-xs font-medium text-slate-500 dark:text-slate-300">{label}</dt><dd className="staff-card-primary min-w-0 max-w-[65%] text-right text-xs font-semibold break-words text-slate-800 [overflow-wrap:anywhere] dark:text-slate-50">{value}</dd></div>)}</dl>
        <button disabled={!selected.students.length} onClick={exportClass} className={W.primary + " mt-5 w-full"}>{downloaded ? <CheckCircle size={17} /> : <Download size={17} />}{downloaded ? "Class Exported" : `Export ${selected.label} to e-Res`}</button>
      </section>
      <section className={W.panel + " min-w-0 lg:col-span-8"}>
        <h2 className="staff-card-primary mb-4 text-base font-bold text-slate-800 dark:text-slate-50">Assessment Marks Preview — {selected.label}</h2>
        <div className="overflow-x-auto"><table className={W.table + " min-w-[850px]"}><thead className={W.tableHead}><tr><th scope="col">Student ID</th><th scope="col">Name</th>{assessments.map(item => <th scope="col" key={item.id}>{item.name} /{item.maxMarks}</th>)}<th scope="col">Carry Mark /{carryMax ?? "Not set"}</th></tr></thead>
          <tbody>{selected.students.map(student => { const mark = student.totalCarry; return <tr key={student.enrolmentId} className={W.tableRow}><td className="staff-card-muted font-mono text-xs text-slate-500 dark:text-slate-300">{student.matrixNo}</td><td className="staff-card-primary whitespace-nowrap font-semibold text-slate-800 dark:text-slate-50">{student.name}</td>{assessments.map(item => <td key={item.id}>{student.scores[item.id] ?? "—"}</td>)}<td className="staff-card-primary font-bold text-slate-800 dark:text-slate-50">{mark}</td></tr>; })}</tbody>
        </table>{!selected.students.length && <div className="py-10 text-center text-sm text-slate-500">No synced assessment marks to preview.</div>}</div>
        <p className={W.muted + " mt-4"}>{selected.students.length} of {selected.capacity} students · all assessment components</p>
      </section>
    </div>
  </div>;
}
