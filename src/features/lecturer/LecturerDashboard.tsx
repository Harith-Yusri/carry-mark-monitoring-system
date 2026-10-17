import React, { useEffect, useRef, useState } from "react";
import { Archive, BookOpen, Plus, CheckCircle, ChevronRight, MoreVertical, X } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { useAuth } from "../../context/AuthContext";
import { createLecturerSubject, listArchivedLecturerSubjects, listProgrammes, loadCurrentTermLabel, loadOfferingData, loadSubjectCreationData, SubjectCatalogueEntry, listLecturerSubjects, SubjectSummary, updateLecturerSubject } from "../../services/carryMarkApi";
import { ProgrammeOption } from "../../types";
import { userError } from "../../utils/errors";

export type LecturerSubject = SubjectSummary;

export function LecturerDashboard({ onSelectSubject }: { onSelectSubject: (subj: LecturerSubject) => void }) {
  const C = useColors();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<LecturerSubject | null>(null);
  const [menuOfferingId, setMenuOfferingId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<LecturerSubject[]>([]);
  const [archivedSubjects, setArchivedSubjects] = useState<LecturerSubject[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedDetail, setArchivedDetail] = useState<{ subject: LecturerSubject; data: Awaited<ReturnType<typeof loadOfferingData>> } | null>(null);
  const [archiveError, setArchiveError] = useState("");
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
  const existingSubject = catalogue.find(subject => subject.code === code.trim().toUpperCase());
  const validForm = editingSubject
    ? name.trim().length > 0 && name.trim().length <= 200 && Boolean(programmeId) && Number(semester) >= 1 && Number(semester) <= 12 && !saving
    : /^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(code.trim().toUpperCase()) &&
      (existingSubject ? existingSubject.is_active : name.trim().length > 0 && name.trim().length <= 200) &&
      Number(semester) >= 1 && Number(semester) <= 12 && Boolean(creationTerm) && !catalogueLoading && !saving;


  const progSems = [...new Set(subjects.map(s => s.progSem))].sort((a, b) => a - b);
  const programmeCount = new Set(subjects.flatMap(subject => subject.programmeIds)).size;

  useEffect(() => {
    Promise.all([listLecturerSubjects(), listArchivedLecturerSubjects(), loadCurrentTermLabel()])
      .then(([items, archived, termLabel]) => { setSubjects(items); setArchivedSubjects(archived); setCreationTerm(termLabel); })
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
    try { setArchivedDetail({ subject, data: await loadOfferingData(subject.offeringId) }); }
    catch (reason) { setArchiveError(userError(reason, "Unable to load archived subject details.")); }
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
    <div>
      <div className="responsive-action-header" style={{ alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 2px" }}>{showArchived ? "Past Sessions" : "My Subjects"}</h1>
          <p style={{ fontSize: "13px", color: C.textMuted }}>
            {showArchived ? `${archivedSubjects.length} archived teaching assignment${archivedSubjects.length === 1 ? "" : "s"} · read-only` : `${user?.name} (${user?.id}) · ${subjects[0]?.termLabel ?? creationTerm} · ${subjects.length} assignment${subjects.length === 1 ? "" : "s"} across ${programmeCount} programme${programmeCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><button type="button" onClick={() => setShowArchived(value => !value)} style={{ background: "transparent", color: C.maroon, border: `1px solid ${C.maroon}66`, borderRadius: "6px", padding: "9px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Archive size={15} />{showArchived ? "Current Session" : "Past Sessions"}</button>{!showArchived && <button
          onClick={openCreateModal}
          style={{ background: C.maroon, color: "#fff", border: "none", borderRadius: "6px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, fontFamily: C.sans, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={15} /> Create New Subject
        </button>}</div>
      </div>

      {showArchived && <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {archiveError && <p role="alert" style={{ color: C.red }}>{archiveError}</p>}
        {[...new Set(archivedSubjects.map(subject => subject.termLabel))].map(termLabel => <section key={termLabel}>
          <h2 style={{ color: C.text, fontFamily: C.display, fontSize: "16px", margin: "0 0 10px" }}>{termLabel}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
            {archivedSubjects.filter(subject => subject.termLabel === termLabel).map(subject => <div key={subject.offeringId} style={{ padding: "15px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}><strong style={{ color: C.maroon, fontFamily: C.mono }}>{subject.code}</strong><span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>READ-ONLY</span></div>
              <div style={{ color: C.text, fontWeight: 700, marginTop: "5px" }}>{subject.name}</div>
              <div style={{ color: C.textMuted, fontSize: "12px", marginTop: "7px" }}>{subject.programmeCode || "No classes"} · {subject.students} students</div>
              <button type="button" onClick={() => openArchivedDetail(subject)} style={{ marginTop: "10px", padding: 0, border: 0, background: "transparent", color: C.maroon, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>View archived details</button>
            </div>)}
          </div>
        </section>)}
        {!loading && archivedSubjects.length === 0 && <p style={{ color: C.textMuted }}>No archived teaching assignments.</p>}
      </div>}

      {archivedDetail && <div role="dialog" aria-modal="true" aria-label="Archived subject details" style={{ position: "fixed", inset: 0, zIndex: 50, padding: "16px", background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "min(680px, 100%)", maxHeight: "85vh", overflowY: "auto", padding: "22px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}><div><div style={{ color: C.maroon, fontFamily: C.mono, fontWeight: 700 }}>{archivedDetail.subject.code} · {archivedDetail.subject.termLabel}</div><h2 style={{ color: C.text, margin: "4px 0" }}>{archivedDetail.subject.name}</h2><span style={{ color: C.textMuted, fontSize: "12px" }}>Archived record · read-only</span></div><button type="button" aria-label="Close archived details" onClick={() => setArchivedDetail(null)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: C.textMuted, cursor: "pointer" }}><X size={18} /></button></div>
          <h3 style={{ color: C.text, fontSize: "14px", margin: "20px 0 8px" }}>Classes</h3>
          {archivedDetail.data.sections.map(section => <div key={section.id} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}`, color: C.textSub, fontSize: "13px" }}><strong style={{ color: C.text }}>{section.programmeCode} · {section.label}</strong> · {section.students.length} students · {section.finalised ? "Finalised" : "Not finalised"}</div>)}
          {!archivedDetail.data.sections.length && <p style={{ color: C.textMuted }}>No classes were recorded.</p>}
          <h3 style={{ color: C.text, fontSize: "14px", margin: "20px 0 8px" }}>Assessment Structure</h3>
          {archivedDetail.data.assessments.map(assessment => <div key={assessment.id} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}`, color: C.textSub, fontSize: "13px" }}><strong style={{ color: C.text }}>{assessment.name}</strong> · {assessment.type} · {assessment.weightage}% carry weight</div>)}
          {!archivedDetail.data.assessments.length && <p style={{ color: C.textMuted }}>No assessments were recorded.</p>}
        </div>
      </div>}

      {!showArchived && loading && <p role="status" style={{ color: C.textMuted, fontSize: "13px" }}>Loading your subjects…</p>}
      {!showArchived && loadError && <p role="alert" style={{ color: C.red, fontSize: "13px" }}>Unable to load your subjects. {loadError}</p>}
      {!showArchived && !loading && !loadError && subjects.length === 0 && (
        <div role="status" style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", padding: "48px 24px", textAlign: "center" }}>
          <BookOpen size={32} aria-hidden="true" style={{ color: C.maroon, marginBottom: "16px" }} />
          <h2 style={{ fontFamily: C.display, color: C.text, fontSize: "20px", fontWeight: 700, margin: "0 0 10px" }}>No Subjects Added</h2>
          <p style={{ color: C.textMuted, fontSize: "13px", lineHeight: 1.7, maxWidth: "460px", margin: "0 auto" }}>
            You have not added any subjects yet. Select “Create New Subject” to set up a subject for your teaching activities.
          </p>
          <p style={{ color: C.textSub, fontSize: "13px", lineHeight: 1.7, margin: "12px 0 0" }}>Your subjects will appear here once they have been added.</p>
        </div>
      )}

      <div style={{ display: showArchived ? "none" : "flex", flexDirection: "column", gap: "28px" }}>
        {progSems.map(ps => {
          const psSubs = subjects.filter(s => s.progSem === ps);
          return (
            <div key={ps}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ width: "28px", height: "28px", background: C.maroonLight, border: `1px solid ${C.maroon}44`, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: C.mono, fontSize: "13px", fontWeight: 700, color: C.maroon }}>{ps}</span>
                </div>
                <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: "14px", color: C.text }}>Programme Semester {ps}</span>
                <span style={{ fontFamily: C.mono, fontSize: "11px", color: C.textMuted }}>· {psSubs.length} subject{psSubs.length !== 1 ? "s" : ""}</span>
                <div style={{ flex: 1, height: "1px", background: C.border }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
                {psSubs.map(subj => {
                  const isSubmitted = subj.status === "submitted";
                  return (
                    <div
                      key={subj.offeringId}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectSubject(subj)}
                      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelectSubject(subj); } }}
                      style={{ position: "relative", textAlign: "left", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "18px 20px", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={event => { event.currentTarget.style.borderColor = `${C.maroon}88`; event.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={event => { event.currentTarget.style.borderColor = C.border; event.currentTarget.style.transform = "none"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, marginBottom: "8px", whiteSpace: "nowrap" }}>
                        <span style={{ flexShrink: 0, fontFamily: C.mono, fontSize: "12px", color: C.maroon, fontWeight: 600 }}>{subj.code}</span>
                        <span title={subj.programmeCodes.join(", ") || "No classes"} aria-label={subj.programmeCodes.length ? `Programmes ${subj.programmeCodes.join(", ")}` : "No classes"} style={{ flexShrink: 1, minWidth: 0, maxWidth: "76px", overflow: "hidden", textOverflow: "ellipsis", fontFamily: C.mono, fontSize: "11px", lineHeight: 1.25, background: C.maroonLight, border: `1px solid ${C.maroon}44`, color: C.maroon, borderRadius: "3px", padding: "2px 5px" }}>{subj.programmeCodes.length > 1 ? `${subj.programmeCodes[0]} +${subj.programmeCodes.length - 1}` : subj.programmeCodes[0] ?? "NO CLASSES"}</span>
                        <span style={{ flexShrink: 0, fontFamily: C.mono, fontSize: "11px", lineHeight: 1.25, background: C.elevated, border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: "3px", padding: "2px 5px" }}>SEM {subj.progSem}</span>
                        <span style={{ flex: 1, minWidth: 0 }} />
                        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", lineHeight: 1.25, fontFamily: C.mono, padding: "2px 6px", borderRadius: "3px", background: isSubmitted ? C.greenLight : C.amberLight, color: isSubmitted ? C.green : C.amber, border: `1px solid ${isSubmitted ? C.green + "44" : C.amber + "44"}` }}>
                          {isSubmitted && <CheckCircle size={9} />}{isSubmitted ? "FINALISED" : "IN PROGRESS"}
                        </span>
                        <button aria-label={`Manage ${subj.code}`} onClick={event => { event.stopPropagation(); setMenuOfferingId(menuOfferingId === subj.offeringId ? null : subj.offeringId); }} style={{ flexShrink: 0, padding: "2px", border: "none", background: "transparent", color: C.textMuted, cursor: "pointer" }}><MoreVertical size={17} /></button>
                      </div>
                      {menuOfferingId === subj.offeringId && <div onClick={event => event.stopPropagation()} style={{ position: "absolute", right: "18px", top: "49px", zIndex: 4, minWidth: "142px", padding: "5px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}><button onClick={() => openEditModal(subj)} style={{ width: "100%", padding: "7px 8px", border: "none", background: "transparent", color: C.text, textAlign: "left", cursor: "pointer", fontSize: "12px" }}>Edit subject</button></div>}
                      <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "14px", color: C.text, marginBottom: "10px" }}>{subj.name}</div>
                      <div style={{ display: "flex", gap: "14px", marginBottom: "10px", fontSize: "12px", color: C.textMuted }}>
                        <div><span style={{ fontFamily: C.mono, color: C.textSub }}>{subj.students}</span> students</div>
                        <div>Last Sync: <span style={{ fontFamily: C.mono, color: C.textSub }}>{subj.lastSync ? new Date(subj.lastSync).toLocaleString() : "Pending"}</span></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", color: C.maroon, fontSize: "13px", fontWeight: 600 }}>
                        <span>Manage Subject Hub</span><ChevronRight size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div role="dialog" aria-modal="true" aria-label={editingSubject ? "Edit Subject" : "Create New Subject"} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", width: "min(420px, calc(100vw - 32px))", boxSizing: "border-box", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "16px", color: C.text }}>{editingSubject ? "Edit Subject" : "Create New Subject"}</div>
              <button type="button" aria-label="Close" disabled={saving || catalogueLoading} onClick={closeSubjectModal} style={{ background: "none", border: 0, color: C.textMuted, cursor: "pointer" }}><X size={18} /></button>
            </div>
            <form onSubmit={createSubject}>
            <p style={{ color: C.textMuted, fontSize: "13px", lineHeight: 1.6, margin: "0 0 20px" }}>
              {editingSubject ? `Update your ${editingSubject.code} subject details for ${editingSubject.termLabel}. Existing classes, assessments and marks will not be changed.` : catalogueLoading ? "Loading subject catalogue…" : creationTerm ? `Add a subject for ${creationTerm}. Select an existing code or enter a new one.` : "Subject creation is unavailable."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "12px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>SUBJECT CODE</label>
                <input aria-label="Subject code" list="subject-catalogue" required maxLength={30} disabled={Boolean(editingSubject) || saving || catalogueLoading} value={code} onChange={event => { const nextCode = event.target.value.toUpperCase(); setCode(nextCode); setFormError(""); }} placeholder="e.g. ITT600" style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "13px", outline: "none", opacity: editingSubject ? .7 : 1 }} />
              </div>
              <datalist id="subject-catalogue">{catalogue.filter(subject => subject.is_active).map(subject => <option key={subject.code} value={subject.code}>{subject.name}</option>)}</datalist>
              {existingSubject && <p role="status" style={{ color: existingSubject.is_active ? C.textSub : C.red, fontSize: "13px", lineHeight: 1.6, margin: 0 }}>{existingSubject.is_active ? "This subject is already registered. Its details will be reused for your own classes and assessments." : "This subject is inactive and cannot be added."}</p>}
              <div>
                <label style={{ fontSize: "12px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>SUBJECT NAME</label>
                <input aria-label="Subject name" required maxLength={200} disabled={(!editingSubject && Boolean(existingSubject)) || saving || catalogueLoading} value={!editingSubject && existingSubject ? existingSubject.name : name} onChange={event => setName(event.target.value)} placeholder="e.g. Cloud Computing & DevOps" style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "13px", outline: "none" }} />
              </div>
              {editingSubject && <div>
                <label style={{ fontSize: "12px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>PROGRAMME</label>
                <select aria-label="Programme" required disabled={saving || catalogueLoading} value={programmeId} onChange={event => { setProgrammeId(event.target.value); setFormError(""); }} style={{ width: "100%", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text }}>
                  <option value="" disabled>Select programme</option>
                  {programmes.map(programme => <option key={programme.id} value={programme.id}>{programme.code} — {programme.name}</option>)}
                </select>
              </div>}
              <div>
                <label style={{ fontSize: "12px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>PROGRAMME SEMESTER</label>
                <select aria-label="Programme semester" disabled={saving || catalogueLoading} value={semester} onChange={event => setSemester(event.target.value)} style={{ width: "100%", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(value => <option key={value} value={value}>Semester {value}</option>)}
                </select>
              </div>
              {formError && <div role="alert" style={{ color: C.red, fontSize: "13px" }}>{formError}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" disabled={saving || catalogueLoading} onClick={closeSubjectModal} style={{ padding: "8px 14px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "6px", color: C.text, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
              <button type="submit" disabled={!validForm} style={{ padding: "8px 14px", background: C.maroon, border: "none", borderRadius: "6px", color: "#fff", fontWeight: 600, fontSize: "13px", cursor: "pointer" , opacity: validForm ? 1 : .55 }}>{saving ? "Saving…" : editingSubject ? "Save Changes" : existingSubject ? "Add Subject" : "Create Subject"}</button>
            </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
