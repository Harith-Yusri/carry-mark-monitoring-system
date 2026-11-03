import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Plus, Users, Clock, ChevronRight, MoreVertical, Trash2, X } from "lucide-react";
import { workspace as W } from "./workspaceStyles";
import { useAuth } from "../../context/AuthContext";
import { createLecturerSubject, deleteLecturerSubject, listProgrammes, loadLecturerSubjectDashboard, loadOfferingData, loadSubjectCreationData, SubjectCatalogueEntry, listLecturerSubjects, SubjectSummary, updateLecturerSubject } from "../../services/carryMarkApi";
import { ProgrammeOption } from "../../types";
import { userError } from "../../utils/errors";

export type LecturerSubject = SubjectSummary;

const subjectThemes = [
  { ink: '#3730A3', tint: '#E0E7FF', accent: '#6366F1' },
  { ink: '#0F5F59', tint: '#CCFBF1', accent: '#14B8A6' },
  { ink: '#8A3B0B', tint: '#FEF0C7', accent: '#F59E0B' },
  { ink: '#5B21B6', tint: '#EDE9FE', accent: '#8B5CF6' },
  { ink: '#075985', tint: '#E0F2FE', accent: '#0EA5E9' },
  { ink: '#86198F', tint: '#FAE8FF', accent: '#D946EF' },
  { ink: '#9A3412', tint: '#FFEDD5', accent: '#FB923C' },
  { ink: '#3F6212', tint: '#ECFCCB', accent: '#84CC16' },
];

function getCardTheme(index: number) {
  if (index < subjectThemes.length) return subjectThemes[index];
  // Extend the palette without wrapping or using error-red / success-green hues.
  const hue = 180 + ((index - subjectThemes.length) * 137.508) % 140;
  return {
    accent: `hsl(${hue} 70% 45%)`,
    tint: `hsl(${hue} 75% 94%)`,
    ink: `hsl(${hue} 70% 25%)`,
  };
}

function assignSubjectThemes(subjects: Pick<LecturerSubject, 'code'>[]) {
  // Allocate across all loaded terms, never separately within semester groups.
  // Sorting makes assignment independent of response order and active filters.
  const codes = [...new Set(subjects.map(subject => subject.code.trim().toUpperCase()))].sort();
  return new Map(codes.map((code, index) => [code, getCardTheme(index)]));
}

function formatSubjectSync(value: string | null) {
  if (!value) return 'Sync pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sync unavailable';
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  return `Synced ${day}, ${time}`;
}

export function LecturerDashboard({ onSelectSubject }: { onSelectSubject: (subj: LecturerSubject) => void }) {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<LecturerSubject | null>(null);
  const [menuOfferingId, setMenuOfferingId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<LecturerSubject[]>([]);
  const [archivedSubjects, setArchivedSubjects] = useState<LecturerSubject[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedSemesterNo, setSelectedSemesterNo] = useState<number | null>(null);
  const [archivedDetail, setArchivedDetail] = useState<{ subject: LecturerSubject; data: Awaited<ReturnType<typeof loadOfferingData>> } | null>(null);
  const [archiveError, setArchiveError] = useState("");
  const [subjectActionError, setSubjectActionError] = useState("");
  const [deletingOfferingId, setDeletingOfferingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("1");
  const [programmeId, setProgrammeId] = useState("");
  const [formError, setFormError] = useState("");
  const [catalogue, setCatalogue] = useState<SubjectCatalogueEntry[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([]);
  const [creationTerm, setCreationTerm] = useState("");
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [activeTerm, setActiveTerm] = useState<{ academicYear: string; semesterNo: number } | null>(null);
  const existingSubject = catalogue.find(subject => subject.code === code.trim().toUpperCase());
  const validForm = editingSubject
    ? name.trim().length > 0 && name.trim().length <= 200 && Boolean(programmeId) && Number(semester) >= 1 && Number(semester) <= 12 && !saving
    : /^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(code.trim().toUpperCase()) &&
      (existingSubject ? existingSubject.is_active : name.trim().length > 0 && name.trim().length <= 200) &&
      Number(semester) >= 1 && Number(semester) <= 12 && Boolean(creationTerm) && !catalogueLoading && !saving;


  const teachingHistory = [...subjects, ...archivedSubjects];
  const subjectColors = assignSubjectThemes(teachingHistory);
  const currentTermMatch = creationTerm.match(/^Semester\s+(\d+)\s+·\s+(.+)$/);
  const currentAcademicYear = activeTerm?.academicYear ?? subjects[0]?.academicYear ?? currentTermMatch?.[2] ?? "";
  const currentSemesterNo = activeTerm?.semesterNo ?? subjects[0]?.semesterNo ?? (currentTermMatch ? Number(currentTermMatch[1]) : null);
  // The real active term must remain selectable before its first allocation.
  // Otherwise the native select can display a historical year while state still
  // points at the (missing) active option, leaving the semester selector empty.
  const availableTerms = activeTerm ? [...teachingHistory, activeTerm] : teachingHistory;
  const academicYears = [...new Set(availableTerms.map(term => term.academicYear))].sort().reverse();
  const semestersForYear = [...new Set(availableTerms.filter(term => term.academicYear === selectedAcademicYear).map(term => term.semesterNo))].sort((a, b) => b - a);
  const visibleSubjects = teachingHistory.filter(subject => subject.academicYear === selectedAcademicYear && subject.semesterNo === selectedSemesterNo);
  const isCurrentSelection = selectedAcademicYear === currentAcademicYear && selectedSemesterNo === currentSemesterNo;
  const progSems = [...new Set(visibleSubjects.map(s => s.progSem))].sort((a, b) => a - b);
  const programmeCount = new Set(visibleSubjects.flatMap(subject => subject.programmeIds)).size;

  useEffect(() => {
    loadLecturerSubjectDashboard()
      .then(({ current: items, archived, termLabel, activeTerm: term }) => {
        setSubjects(items); setArchivedSubjects(archived); setCreationTerm(termLabel);
        setActiveTerm(term);
        setSelectedAcademicYear(term.academicYear);
        setSelectedSemesterNo(term.semesterNo);
      })
      .catch(error => setLoadError(userError(error, "Unable to load your subjects.")))
      .finally(() => setLoading(false));
  }, []);

  const openCreateModal = async () => {
    setEditingSubject(null);
    setCode(""); setName(""); setSemester("1"); setProgrammeId(""); setFormError(""); setCreationTerm(""); setCatalogue([]); setProgrammes([]);
    setShowCreateModal(true); setCatalogueLoading(true);
    try {
      const data = await loadSubjectCreationData();
      setCatalogue(data.catalogue); setCreationTerm(data.termLabel);
    } catch (reason) {
      setFormError(userError(reason, "Unable to load the subject catalogue. Close this window and try again."));
    } finally { setCatalogueLoading(false); }
  };

  const openEditModal = async (subject: LecturerSubject) => {
    setMenuOfferingId(null); setEditingSubject(subject); setCode(subject.code); setName(subject.name);
    setSemester(String(subject.progSem)); setProgrammeId(subject.programmeId); setFormError(""); setCatalogue([]); setCreationTerm(subject.termLabel);
    setCatalogueLoading(true); setShowCreateModal(true);
    try { setProgrammes(await listProgrammes()); }
    catch (reason) { setFormError(userError(reason, "Unable to load programmes.")); }
    finally { setCatalogueLoading(false); }
  };

  const closeSubjectModal = () => {
    if (saving || catalogueLoading) return;
    setShowCreateModal(false); setEditingSubject(null);
  };

  const openArchivedDetail = async (subject: LecturerSubject) => {
    setArchiveError("");
    try {
      const loaded = await Promise.all((subject.offerings ?? [subject]).map(offering => loadOfferingData(offering.offeringId)));
      setArchivedDetail({ subject, data: { sections: loaded.flatMap(data => data.sections), assessments: loaded.flatMap(data => data.assessments) } });
    }
    catch (reason) { setArchiveError(userError(reason, "Unable to load archived subject details.")); }
  };

  const deleteSubject = async (subject: LecturerSubject) => {
    setMenuOfferingId(null);
    setSubjectActionError("");
    if (!window.confirm(`Delete ${subject.code} from ${subject.termLabel}? All classes, assessments, enrolments and draft marks linked to this offering will also be deleted. Released or archived records cannot be deleted.`)) return;
    setDeletingOfferingId(subject.offeringId);
    try {
      await deleteLecturerSubject(subject.offeringId);
      setSubjects(await listLecturerSubjects());
    } catch (reason) {
      setSubjectActionError(userError(reason, "Unable to delete this subject. Released or archived academic records cannot be deleted."));
    } finally {
      setDeletingOfferingId(null);
    }
  };

  const createSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validForm || saveInFlight.current) return;
    saveInFlight.current = true; setSaving(true); setFormError("");
    try {
      if (editingSubject) {
        const savedName = name.trim();
        const savedSemester = Number(semester);
        await updateLecturerSubject(editingSubject.offeringId, savedName, savedSemester, programmeId);
        setSubjects(await listLecturerSubjects());
        setShowCreateModal(false); setEditingSubject(null);
        return;
      }
      await createLecturerSubject(code, existingSubject?.name ?? name, Number(semester));
      setShowCreateModal(false); setLoading(true); setLoadError("");
      try { setSubjects(await listLecturerSubjects()); }
      catch { setLoadError("Your subject was saved, but the list could not refresh. Please reload the page."); }
      finally { setLoading(false); }
    } catch (reason) {
      setFormError(userError(reason, `Unable to ${editingSubject ? "update" : "create"} subject. Please try again.`));
    } finally { saveInFlight.current = false; setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-50">My Subjects</h1>
          <p className={W.muted}>{user?.name} ({user?.id}) · {visibleSubjects[0]?.termLabel ?? creationTerm} · {visibleSubjects.length} assignment{visibleSubjects.length === 1 ? "" : "s"} across {programmeCount} programme{programmeCount === 1 ? "" : "s"}{!isCurrentSelection && visibleSubjects.length ? " · read-only" : ""}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-36 flex-1"><span className={W.label}>Academic Year</span>
            <select aria-label="Academic year" value={selectedAcademicYear} onChange={event => { const year = event.target.value; const available = [...new Set(availableTerms.filter(term => term.academicYear === year).map(term => term.semesterNo))].sort((a, b) => b - a); setSelectedAcademicYear(year); setSelectedSemesterNo(year === currentAcademicYear && currentSemesterNo !== null && available.includes(currentSemesterNo) ? currentSemesterNo : available[0] ?? null); setMenuOfferingId(null); }} className={W.field}>
              {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="min-w-32 flex-1"><span className={W.label}>Semester</span>
            <select aria-label="Semester" value={selectedSemesterNo ?? ""} onChange={event => { setSelectedSemesterNo(Number(event.target.value)); setMenuOfferingId(null); }} className={W.field}>
              {semestersForYear.map(value => <option key={value} value={value}>Semester {value}</option>)}
            </select>
          </label>
          {isCurrentSelection && <button onClick={openCreateModal} className={W.primary}><Plus size={16} /> Create New Subject</button>}
        </div>
      </div>
      {archiveError && <p role="alert" className={W.error}>{archiveError}</p>}
      {subjectActionError && <p role="alert" className={W.error}>{subjectActionError}</p>}

      {archivedDetail && <div role="dialog" aria-modal="true" aria-label="Archived subject details" className={W.overlay}>
        <div className={W.modal + " max-w-2xl"}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><span className={W.code}>{archivedDetail.subject.code} · {archivedDetail.subject.termLabel}</span><h2 className={W.title + " mt-3"}>{archivedDetail.subject.name}</h2><span className={W.muted}>Archived record · read-only</span></div>
            <button type="button" aria-label="Close archived details" onClick={() => setArchivedDetail(null)} className={W.iconButton}><X size={20} /></button>
          </div>
          <h3 className="mb-3 font-semibold">Classes</h3>
          {archivedDetail.data.sections.map(section => <div key={section.id} className="border-b border-slate-200 py-3 text-sm dark:border-slate-700"><strong>{section.programmeCode} · {section.label}</strong> · {section.students.length} students · {section.finalised ? "Released" : "Not released"}</div>)}
          {!archivedDetail.data.sections.length && <p className={W.muted}>No classes were recorded.</p>}
          <h3 className="mb-3 mt-6 font-semibold">Assessment Structure</h3>
          {archivedDetail.data.assessments.map(assessment => <div key={assessment.id} className="border-b border-slate-200 py-3 text-sm dark:border-slate-700"><strong>{assessment.name}</strong> · {assessment.type} · {assessment.weightage}% carry weight</div>)}
          {!archivedDetail.data.assessments.length && <p className={W.muted}>No assessments were recorded.</p>}
        </div>
      </div>}
      {loading && <p role="status" className={W.muted}>Loading your subjects…</p>}
      {loadError && <p role="alert" className={W.error}>Unable to load your subjects. {loadError}</p>}
      {!loading && !loadError && visibleSubjects.length === 0 && <div role="status" className={W.panel + " py-12 text-center"}>
        <BookOpen size={32} aria-hidden="true" className="mx-auto mb-4 text-purple-800" />
        <h2 className={W.title}>No Teaching Allocations</h2>
        <p className={W.muted + " mx-auto mt-3 max-w-lg"}>{academicYears.length ? "No subjects are available for the selected semester." : "No current or archived teaching allocations were found."}</p>
        {isCurrentSelection && <p className={W.muted + " mt-3"}>Select “Create New Subject” to add your first current-semester subject.</p>}
      </div>}

      <div className="space-y-8">
        {progSems.map(ps => {
          const psSubs = visibleSubjects.filter(s => s.progSem === ps);
          return <section key={ps}>
            <h2 className="subject-semester-heading">
              Programme Semester {ps}<span className="font-normal text-slate-500 dark:text-slate-300">· {psSubs.length} subject{psSubs.length !== 1 ? "s" : ""}</span>
            </h2>
            <div className="subject-card-grid">
              {psSubs.map(subj => {
                const isSubmitted = subj.status === "submitted";
                const theme = subjectColors.get(subj.code.trim().toUpperCase())!;
                const cardStyle = {
                  '--subject-accent': theme.accent,
                  '--subject-light-tint': theme.tint,
                  '--subject-light-ink': theme.ink,
                } as React.CSSProperties;
                const openSubject = () => isCurrentSelection ? onSelectSubject(subj) : openArchivedDetail(subj);
                return <article key={subj.offeringId} role="button" tabIndex={0} aria-label={`${isCurrentSelection ? "Open Subject Hub" : "View archived details"} for ${subj.code}: ${subj.name}`}
                  onClick={openSubject}
                  onKeyDown={event => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      openSubject();
                    }
                  }}
                  style={cardStyle}
                  className="subject-dashboard-card">
                  <div className="subject-card-body">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="subject-code-chip">{subj.code}</span>
                      <span title={subj.programmeCodes.join(", ") || "No classes"} aria-label={subj.programmeCodes.length ? `Programmes ${subj.programmeCodes.join(", ")}` : "No classes"} className="subject-neutral-chip">{subj.programmeCodes.length > 1 ? `${subj.programmeCodes[0]} +${subj.programmeCodes.length - 1}` : subj.programmeCodes[0] ?? "No classes"}</span>
                      <span className="subject-neutral-chip">Sem {subj.progSem}</span>
                      <span className={"subject-card-status" + (isSubmitted ? " is-finalised" : "")}><span aria-hidden="true" />{isSubmitted ? "Released" : "Pending"}</span>
                      {isCurrentSelection ? <button aria-label={`Manage ${subj.code}`} aria-expanded={menuOfferingId === subj.offeringId} onClick={event => { event.stopPropagation(); setMenuOfferingId(menuOfferingId === subj.offeringId ? null : subj.offeringId); }} className={W.iconButton + " ml-auto"}><MoreVertical size={20} aria-hidden="true" /></button> : <span className="text-xs font-medium text-slate-500">Read-only</span>}
                    </div>
                    {menuOfferingId === subj.offeringId && <div onClick={event => event.stopPropagation()} className={W.menu + " subject-card-menu"}>{(subj.offerings ?? [subj]).map(offering => <React.Fragment key={offering.offeringId}>
                      <button onClick={() => openEditModal(offering)} className={W.menuItem}>Edit subject{subj.offerings ? ` · ${offering.programmeCode || "Unassigned"}` : ""}</button>
                      <button disabled={deletingOfferingId === offering.offeringId} onClick={() => deleteSubject(offering)} className={W.menuItem + " text-rose-700 disabled:opacity-50"}><Trash2 size={15} aria-hidden="true" />{deletingOfferingId === offering.offeringId ? "Deleting…" : "Delete subject"}{subj.offerings ? ` · ${offering.programmeCode || "Unassigned"}` : ""}</button>
                    </React.Fragment>)}</div>}
                    <h3 className="subject-card-name">{subj.name}</h3>
                    <div className="subject-card-info">
                      <span><Users size={12} aria-hidden="true" />{subj.students} students</span>
                      <span title={subj.lastSync ? new Date(subj.lastSync).toLocaleString() : undefined}><Clock size={12} aria-hidden="true" />{formatSubjectSync(subj.lastSync)}</span>
                    </div>
                  </div>
                  <button onClick={event => { event.stopPropagation(); openSubject(); }} className="subject-hub-button">{isCurrentSelection ? "Manage Subject Hub" : "View archived details"}<ChevronRight size={16} aria-hidden="true" /></button>
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>

      {showCreateModal && <div role="dialog" aria-modal="true" aria-label={editingSubject ? "Edit Subject" : "Create New Subject"} className={W.overlay}>
        <div className={W.modal}>
          <div className="mb-5 flex items-start justify-between gap-3"><h2 className={W.title}>{editingSubject ? "Edit Subject" : "Create New Subject"}</h2><button type="button" aria-label="Close" disabled={saving || catalogueLoading} onClick={closeSubjectModal} className={W.iconButton}><X size={20} /></button></div>
          <form onSubmit={createSubject}>
            <p className={W.muted + " mb-6"}>{editingSubject ? `Update your ${editingSubject.code} subject details for ${editingSubject.termLabel}. Existing classes, assessments and marks will not be changed.` : catalogueLoading ? "Loading subject catalogue…" : creationTerm ? `Add a subject for ${creationTerm}. Select an existing code or enter a new one.` : "Subject creation is unavailable."}</p>
            <div className="space-y-4">
              <div><label htmlFor="lecturer-subject-code" className={W.label}>Subject Code</label><input id="lecturer-subject-code" aria-label="Subject code" list="subject-catalogue" required maxLength={30} disabled={Boolean(editingSubject) || saving || catalogueLoading} value={code} onChange={event => { const nextCode = event.target.value.toUpperCase(); setCode(nextCode); setFormError(""); }} placeholder="e.g. ITT600" className={W.field} /></div>
              <datalist id="subject-catalogue">{catalogue.filter(subject => subject.is_active).map(subject => <option key={subject.code} value={subject.code}>{subject.name}</option>)}</datalist>
              {existingSubject && <p role="status" className={existingSubject.is_active ? W.muted : W.error}>{existingSubject.is_active ? "This subject is already registered. Its details will be reused for your own classes and assessments." : "This subject is inactive and cannot be added."}</p>}
              <div><label htmlFor="lecturer-subject-name" className={W.label}>Subject Name</label><input id="lecturer-subject-name" aria-label="Subject name" required maxLength={200} disabled={(!editingSubject && Boolean(existingSubject)) || saving || catalogueLoading} value={!editingSubject && existingSubject ? existingSubject.name : name} onChange={event => setName(event.target.value)} placeholder="e.g. Cloud Computing & DevOps" className={W.field} /></div>
              {editingSubject && <div><label htmlFor="lecturer-subject-programme" className={W.label}>Programme</label><select id="lecturer-subject-programme" aria-label="Programme" required disabled={saving || catalogueLoading} value={programmeId} onChange={event => { setProgrammeId(event.target.value); setFormError(""); }} className={W.field}><option value="" disabled>Select programme</option>{programmes.map(programme => <option key={programme.id} value={programme.id}>{programme.code} — {programme.name}</option>)}</select></div>}
              <div><label htmlFor="lecturer-subject-semester" className={W.label}>Programme Semester</label><select id="lecturer-subject-semester" aria-label="Programme semester" disabled={saving || catalogueLoading} value={semester} onChange={event => setSemester(event.target.value)} className={W.field}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(value => <option key={value} value={value}>Semester {value}</option>)}</select></div>
              {formError && <div role="alert" className={W.error}>{formError}</div>}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={saving || catalogueLoading} onClick={closeSubjectModal} className={W.secondary}>Cancel</button><button type="submit" disabled={!validForm} className={W.primary}>{saving ? "Saving…" : editingSubject ? "Save Changes" : existingSubject ? "Add Subject" : "Create Subject"}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
}
