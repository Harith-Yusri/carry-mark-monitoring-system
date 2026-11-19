import { t, tx, useLocale } from "../../localization/react";
import type { SubjectClassCache } from "../../services/subjectClassCache";
import { InitialDataState, LoadingState, RefreshStatus } from "../../components/StaffDataState";
import React, { useEffect, useRef, useState } from "react";
import { Check, CheckCircle, ChevronLeft, ChevronRight, Copy, KeyRound, MoreVertical, Plus, RefreshCw, Users, X } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { useAuth } from "../../context/AuthContext";
import { AssessmentRecord, ClassSectionSummary, createSection, deleteSection, finaliseSection, listProgrammes, rotateJoinCode, SectionRecord, updateSection, upsertMarks } from "../../services/carryMarkApi";
import { ProgrammeOption } from "../../types";
import { workspace as W } from "./workspaceStyles";
import { userError } from "../../utils/errors";
import { useSubjectClassData } from "../../hooks/useSubjectClassData";

import { ReleasedMarkCorrectionPanel } from "./ReleasedMarkCorrectionPanel";
import type { ReleasedMarkTarget } from "../../services/markCorrectionApi";

type StudentRecord = SectionRecord["students"][number] & { id: string };
type ClassSection = Omit<SectionRecord, "students"> & { students: StudentRecord[] };
const blankForm = { label: "", capacity: "", programmeId: "" };
type ClassForm = typeof blankForm;

export function MarksEntryTab({ cache, offeringId, offeringIds, offeringProgrammeId, subjectCode }: { cache?: SubjectClassCache; offeringId: string; offeringIds?: string[]; offeringProgrammeId: string; subjectCode: string }) {
  useLocale();
  const C = useColors();
  const { user } = useAuth();
  const { sections, selectedId, setSelectedId, selected: selectedRecord, assessments, carryMax, eligibleThreshold,
    loading, hasLoaded, detailLoading, error: loadError, reload, updateDetailedSections } = useSubjectClassData(offeringId, offeringIds, cache);
  const selected = selectedRecord ? { ...selectedRecord, students: selectedRecord.students.map(student => ({ ...student, id: student.enrolmentId })) } : null;
  const [correctionTarget, setCorrectionTarget] = useState<ReleasedMarkTarget | null>(null);
  useEffect(() => { setCorrectionTarget(null); }, [selectedId]);
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([]);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(blankForm);
  const [synced, setSynced] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const pendingMarks = useRef(new Map<string, { enrolmentId: string; assessmentId: string; score: number; enteredBy: string }>());
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); };
  }, [offeringId]);
  const [programmeError, setProgrammeError] = useState("");
  const [programmeLoading, setProgrammeLoading] = useState(false);
  useEffect(() => {
    if (!modal) return;
    let active = true;
    setProgrammeError(""); setProgrammeLoading(true);
    listProgrammes().then(rows => { if (active) setProgrammes(rows); })
      .catch(reason => { if (active) setProgrammeError(userError(reason, "Unable to load programmes.")); })
      .finally(() => { if (active) setProgrammeLoading(false); });
    return () => { active = false; };
  }, [modal]);
  const formValid = !programmeLoading && !programmeError && form.label.trim().length > 0 && Number(form.capacity) > 0 && programmes.some(programme => programme.id === form.programmeId);

  const openAdd = () => { setProgrammeLoading(true); setProgrammeError(""); setForm({ ...blankForm, programmeId: offeringProgrammeId }); setEditingId(null); setModal("add"); };
  const openEdit = (section: ClassSectionSummary) => { setProgrammeLoading(true); setProgrammeError(""); setForm({ label: section.label, capacity: String(section.capacity), programmeId: section.programmeId }); setEditingId(section.id); setMenuId(null); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditingId(null); setForm(blankForm); };
  const saveSection = async () => {
    if (!formValid) return;
    const values = { label: form.label.trim(), capacity: Number(form.capacity), programmeId: form.programmeId };
    if (modal === "edit" && editingId) await updateSection(editingId, values); else {
      const matching = sections.find(section => section.programmeId === values.programmeId);
      await createSection(matching?.offeringId ?? offeringId, values);
    }
    await reload(); closeModal();
  };
  const removeSection = async (section: ClassSectionSummary) => { setMenuId(null); if (window.confirm(t("Remove “{{value0}}”?\n\nThe class section and its mark-entry records will be deleted. This cannot be undone.", { value0: (section.label) }))) { await deleteSection(section.id); await reload(); if (selectedId === section.id) setSelectedId(null); } };
  const flushPendingMarks = async (sectionId: string | null = selectedId) => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const rows = [...pendingMarks.current.values()];
    pendingMarks.current.clear();
    if (!rows.length) return;
    try { if (cache && sectionId) await cache.write(sectionId, () => upsertMarks(rows)); else await upsertMarks(rows); }
    catch (reason) {
      for (const row of rows) {
        const key = `${row.enrolmentId}:${row.assessmentId}`;
        if (!pendingMarks.current.has(key)) pendingMarks.current.set(key, row);
      }
      window.alert(tx(userError(reason, "Unable to save marks.")));
      throw reason;
    }
  };
  const flushRef = useRef(flushPendingMarks);
  flushRef.current = flushPendingMarks;
  useEffect(() => {
    if (!cache || !selectedId) return;
    const flush = () => flushRef.current(selectedId);
    const remove = cache.setFlusher(selectedId, flush);
    return () => {
      // A tab change must commit queued draft edits before Export reads them.
      const pending = flush();
      void pending.catch(() => undefined);
      remove();
    };
  }, [cache, selectedId]);
  const updateMark = (studentId: string, assessmentId: string, rawValue: string) => {
    if (!selected || selected.finalised || !user?.authId) return;
    const assessment = assessments.find(item => item.id === assessmentId);
    if (!assessment) return;
    const value = Math.max(0, Math.min(Number(rawValue) || 0, assessment.maxMarks));
    pendingMarks.current.set(`${studentId}:${assessmentId}`, { enrolmentId: studentId, assessmentId, score: value, enteredBy: user.authId });
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void flushPendingMarks().catch(() => undefined); }, 600);
    updateDetailedSections(previous => previous.map(section => section.id !== selected.id ? section : { ...section, students: section.students.map(student => {
      if (student.enrolmentId !== studentId) return student;
      const scores = { ...student.scores, [assessmentId]: value };
      const totalCarry = Math.round(assessments.reduce((sum, item) => sum + (scores[item.id] ?? 0) / item.maxMarks * item.weightage, 0) * 100) / 100;
      return { ...student, scores, totalCarry, eligible: eligibleThreshold === null ? student.eligible : totalCarry >= eligibleThreshold };
    }) }));
  };
  const finalise = async () => { if (selected && !selected.finalised && window.confirm(t("Release carry marks for {{value0}}?\n\nMarks will be locked, released to students, and students will be notified.", { value0: (selected.label) }))) { await finaliseSection(selected.id); await reload(); } };
  const syncMarks = async () => { await flushPendingMarks(); await reload("detail"); setSynced(true); window.setTimeout(() => setSynced(false), 2200); };
  const copyJoinCode = async (section: Pick<SectionRecord, "id" | "joinCode">) => {
    if (!section.joinCode) return;
    await navigator.clipboard.writeText(section.joinCode);
    setCopiedId(section.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };
  const regenerateJoinCode = async (section: Pick<SectionRecord, "id" | "label">) => {
    setMenuId(null);
    if (!window.confirm(t("Generate a new invitation code for {{value0}}?\n\nThe current code will stop working immediately.", { value0: (section.label) }))) return;
    setRotatingId(section.id);
    try { await rotateJoinCode(section.id); await reload(); } finally { setRotatingId(null); }
  };
  if (!hasLoaded) return <InitialDataState title={t("Select a Class")} label={t("Loading class sections…")} error={tx(loadError)} onRetry={() => void reload().catch(() => undefined)} />;

  if (selectedId && !selected) return <div className="space-y-4 p-5">
    <button onClick={() => setSelectedId(null)} className={W.secondary}>{t("‹ All Classes")}</button>
    {loadError ? <p role="alert" className={W.error}>{tx(loadError)}</p> : <LoadingState label={t("Loading this class's marks…")} layout="table" />}
    {loadError && <button onClick={() => void reload().catch(() => undefined)} className={W.primary}>{t("Try again")}</button>}
  </div>;
  if (!selected) return <div className="space-y-6">
    {loading && <RefreshStatus label={t("Refreshing class sections…")} />}
    {loadError && <p role="alert" className={W.error}>{tx(loadError)}</p>}
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className={W.title}>{t("Select a Class")}</h2><p className={W.muted}>{t("{{value0}} has {{value1}} class section{{value2}}. Choose one to begin entering marks.", { value0: (subjectCode), value1: (sections.length), value2: (sections.length === 1 ? "" : t("pluralSuffix")) })}</p></div><button onClick={openAdd} className={W.primary}><Plus size={16} /> {t(" Add Class Section")}</button></div>
    <div className={W.grid}>{sections.map(section => <div key={section.id} role="button" tabIndex={0} aria-label={t("Enter marks for {{value0}}", { value0: (section.label) })} onClick={() => setSelectedId(section.id)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedId(section.id); } }} className={W.classCard + " flex flex-col " + (section.finalised ? "staff-card-success" : "staff-card-pending")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-800"><Users size={21} /></div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className={W.neutral}>{t("{{value0}} students", { value0: (section.studentCount) })}</span>
          <span aria-label={t("Class marks {{value0}}", { value0: (section.finalised ? t("released") : t("pending")) })} className={section.finalised ? W.success : W.pending}>{section.finalised ? t("RELEASED") : t("PENDING")}</span>
          <button aria-label={t("Manage {{value0}}", { value0: (section.label) })} aria-expanded={menuId === section.id} onClick={event => { event.stopPropagation(); setMenuId(menuId === section.id ? null : section.id); }} className={W.iconButton}><MoreVertical size={20} /></button>
        </div>
      </div>
      {menuId === section.id && <div onClick={event => event.stopPropagation()} className={W.menu}><button onClick={() => openEdit(section)} className={W.menuItem}>{t("Edit class")}</button><button onClick={() => regenerateJoinCode(section)} className={W.menuItem}>{t("Regenerate code")}</button><button onClick={() => removeSection(section)} className={W.menuItem + " text-rose-700"}>{t("Remove class")}</button></div>}
      <h3 className={W.title + " mb-2"}>{section.label}</h3><div className={W.muted}><strong className="staff-card-primary font-bold text-slate-800 dark:text-slate-50">{section.programmeCode}</strong> · {section.studentCount}{t(" enrolled · capacity ")}{section.capacity}</div>
      <button onClick={event => { event.stopPropagation(); void copyJoinCode(section); }} disabled={!section.joinCode} title={t("Copy class invitation code")} className="my-4 flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-100 bg-purple-50/60 px-3 py-2 text-purple-900 disabled:opacity-50">
        <span className="flex items-center gap-2 text-xs font-semibold"><KeyRound size={15} /> {t(" Class Code")}</span><strong className="font-mono text-sm">{rotatingId === section.id ? t("Generating…") : section.joinCode ?? (t("Not set"))}</strong>{copiedId === section.id ? <Check size={16} className="text-emerald-700" /> : <Copy size={16} />}
      </button>
      <div className={W.primary + " mt-auto w-full text-xs"}>{t("Enter Marks ")}<ChevronRight size={16} /></div>
    </div>)}</div>
    {!loading && !loadError && sections.length === 0 && <div className={W.panel + " py-12 text-center text-sm text-slate-500"}>{t("No class sections yet. Select Add Class Section to create the first one.")}</div>}
    {modal && <ClassModal loading={programmeLoading} error={tx(programmeError)} C={C} mode={modal} form={form} setForm={setForm} close={closeModal} save={saveSection} valid={formValid} subjectCode={subjectCode} programmes={programmes} />}
  </div>;
  return <div className="space-y-4">{(loading || detailLoading) && <RefreshStatus label={t("Refreshing class data…")} />}{loadError && <p role="alert" className={W.error}>{tx(loadError)}</p>}<MarkGrid onEditMark={(student: StudentRecord, assessmentId: string) => setCorrectionTarget({ sectionId: selected.id, enrolmentId: student.enrolmentId, assessmentId })} assessments={assessments} carryMax={carryMax} C={C} sections={sections} selected={selected} setSelectedId={setSelectedId} updateMark={updateMark} flushPendingMarks={flushPendingMarks} syncMarks={syncMarks} synced={synced} finalise={finalise} copyJoinCode={copyJoinCode} copiedId={copiedId} regenerateJoinCode={regenerateJoinCode} rotatingId={rotatingId} />{correctionTarget && <ReleasedMarkCorrectionPanel key={`${correctionTarget.sectionId}:${correctionTarget.enrolmentId}:${correctionTarget.assessmentId}`} target={correctionTarget} onClose={() => setCorrectionTarget(null)} onReleased={async () => { cache?.invalidate(correctionTarget.sectionId); await reload("detail"); }} />}</div>;
}

function ClassModal({ loading, error, C, mode, form, setForm, close, save, valid, subjectCode, programmes }: any) {
  useLocale();
  return <div role="dialog" aria-modal="true" aria-labelledby="class-modal-title" className={W.overlay} onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div className={W.modal}>
    <div className="mb-6 flex items-start justify-between gap-4"><div><h3 id="class-modal-title" className={W.title}>{mode === "add" ? t("Add Class Section") : t("Edit Class Section")}</h3><div className={W.muted}>{subjectCode}</div></div><button aria-label={t("Close")} onClick={close} className={W.iconButton}><X size={21} /></button></div>
    {error && <p role="alert" className={W.error}>{tx(error)}</p>}
    {loading && <RefreshStatus label={t("Loading programmes…")} />}
    <div className="space-y-4">
      <div><label htmlFor="class-label" className={W.label}>{t("Class Label")}</label><input id="class-label" autoFocus value={form.label} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, label: event.target.value }))} placeholder={t("e.g. Class D")} className={W.field} /></div>
      <div><label htmlFor="class-programme" className={W.label}>{t("Programme")}</label><select id="class-programme" aria-label={t("Programme")} disabled={loading || Boolean(error)} value={form.programmeId} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, programmeId: event.target.value }))} className={W.field}><option value="">{loading ? t("Loading programmes…") : error ? t("Programmes unavailable") : programmes.length ? t("Select programme") : t("No programmes available")}</option>{programmes.map((programme: ProgrammeOption) => <option key={programme.id} value={programme.id}>{programme.code} — {programme.name}</option>)}</select></div>
      <div><label htmlFor="class-capacity" className={W.label}>{t("Student Capacity")}</label><input id="class-capacity" type="number" min="1" value={form.capacity} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, capacity: event.target.value }))} placeholder="e.g. 20" className={W.field} /></div>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-3"><button onClick={close} className={W.secondary}>{t("Cancel")}</button><button disabled={!valid} onClick={save} className={W.primary}><Plus size={16} /> {mode === "add" ? t("Add Section") : t("Save Changes")}</button></div>
  </div></div>;
}

function MarkGrid({ onEditMark, assessments, carryMax, C, sections, selected, setSelectedId, updateMark, flushPendingMarks, syncMarks, synced, finalise, copyJoinCode, copiedId, regenerateJoinCode, rotatingId }: any) {
  useLocale();
  const markFields = assessments.map((item: AssessmentRecord) => ({ key: item.id, label: item.name, max: item.maxMarks }));
  return <div className={W.panel + (selected.finalised ? " staff-card-success" : "")}>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-6">
      <div className="flex flex-wrap items-start gap-4"><button onClick={() => setSelectedId(null)} className={W.secondary}><ChevronLeft size={16} /> {t(" All Classes")}</button><div><h2 className={W.title}>{t("Mark Entry — {{value0}}", { value0: (selected.label) })}</h2><div className={W.muted}>{t("{{value0}} · {{value1}} students · capacity {{value2}}", { value0: (selected.programmeCode), value1: (selected.students.length), value2: (selected.capacity) })}</div><div className="staff-card-muted mt-1 text-xs text-slate-500 dark:text-slate-300">{selected.finalised ? t("Marks are Released and locked. Use Edit Mark for an exact, privately saved correction.") : t("Draft marks remain private until release.")}</div></div></div>
      <div className="flex flex-wrap gap-3"><button onClick={syncMarks} className={W.secondary}><RefreshCw size={16} /> {synced ? t("Draft Synced") : t("Sync Draft")}</button><button disabled={selected.finalised} onClick={finalise} className={selected.finalised ? W.success + " min-h-11 rounded-lg" : W.primary}><CheckCircle size={16} /> {selected.finalised ? t("Carry Marks Released") : t("Release Marks")}</button></div>
    </div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-purple-100 bg-purple-50/60 p-4">
      <div className="flex flex-wrap items-center gap-3"><KeyRound size={20} className="text-purple-800" /><span className="text-sm font-semibold text-purple-900">{t("Class Invitation Code")}</span><strong className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 font-mono text-base font-bold text-purple-900 shadow-sm">{rotatingId === selected.id ? t("Generating…") : selected.joinCode ?? (t("Not set"))}</strong></div>
      <div className="flex flex-wrap gap-2">
        <button disabled={!selected.joinCode} onClick={() => copyJoinCode(selected)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-900 shadow-sm hover:bg-purple-50 disabled:opacity-50">{copiedId === selected.id ? <Check size={15} /> : <Copy size={15} />}{copiedId === selected.id ? t("Copied") : t("Copy Code")}</button>
        <button disabled={rotatingId === selected.id} onClick={() => regenerateJoinCode(selected)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-900 shadow-sm hover:bg-purple-50 disabled:opacity-50"><RefreshCw size={15} />{rotatingId === selected.id ? t("Generating…") : t("Regenerate")}</button>
      </div>
    </div>
    <div className="mb-6 flex flex-wrap gap-2" aria-label={t("Choose class")}>{sections.map((section: ClassSectionSummary) => <button key={section.id} onClick={() => setSelectedId(section.id)} aria-pressed={selected.id === section.id} className={selected.id === section.id ? W.primary : W.secondary}>{section.label} · {section.programmeCode} ({section.studentCount})</button>)}</div>
    <div className="overflow-x-auto"><table className={W.table + " min-w-[900px]"}><thead className={W.tableHead}><tr><th scope="col">{t("Student ID")}</th><th scope="col">{t("Name")}</th>{markFields.map(field => <th scope="col" key={field.key}>{field.label} /{field.max}</th>)}<th scope="col">{t("Carry Mark /{{value0}}", { value0: (carryMax ?? (t("Not set"))) })}</th><th scope="col">{t("Eligibility")}</th></tr></thead>
      <tbody>{selected.students.map((student: StudentRecord) => { const rawTotal = student.totalCarry; return <tr key={student.id} className={W.tableRow}>
        <td className="staff-card-muted font-mono text-xs text-slate-500 dark:text-slate-300">{student.matrixNo}</td><td className="staff-card-primary font-semibold text-slate-800 dark:text-slate-50">{student.name}</td>
        {markFields.map(field => <td key={field.key}><input aria-label={t("{{value0}} mark for {{value1}}", { value0: (field.label), value1: (student.name) })} disabled={selected.finalised} type="number" min="0" max={field.max} value={student.scores[field.key] ?? ""} onChange={event => updateMark(student.id, field.key, event.target.value)} onBlur={() => void flushPendingMarks().catch(() => undefined)} className="staff-card-field staff-card-primary min-h-11 w-16 rounded-lg border border-slate-400 bg-slate-50 px-2.5 py-1 text-center text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:opacity-65 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-50" />{selected.finalised && <button type="button" aria-label={t("Edit released mark for {{value0}}: {{value1}}", { value0: (student.name), value1: (field.label) })} disabled={student.scores[field.key] == null} onClick={() => onEditMark(student, field.key)} className="staff-card-secondary mt-2 block min-h-9 rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">{t("Edit Mark")}</button>}</td>)}
        <td className="staff-card-primary font-bold text-slate-800 dark:text-slate-50">{rawTotal}</td><td><span className={student.eligible ? W.success : W.danger}>{student.eligible ? t("ELIGIBLE") : t("NOT ELIGIBLE")}</span></td>
      </tr>; })}</tbody>
    </table>{selected.students.length === 0 && <div className="py-10 text-center text-sm text-slate-500">{t("This class has no student roster yet.")}</div>}</div>
  </div>;
}
