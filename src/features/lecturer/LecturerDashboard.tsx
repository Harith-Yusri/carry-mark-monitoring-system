import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Plus, CheckCircle, ChevronRight, X } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { useAuth } from "../../context/AuthContext";
import { createLecturerSubject, loadSubjectCreationData, SubjectCatalogueEntry, listLecturerSubjects, SubjectSummary } from "../../services/carryMarkApi";

export type LecturerSubject = SubjectSummary;

export function LecturerDashboard({ onSelectSubject }: { onSelectSubject: (subj: LecturerSubject) => void }) {
  const C = useColors();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subjects, setSubjects] = useState<LecturerSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("1");
  const [formError, setFormError] = useState("");
  const [catalogue, setCatalogue] = useState<SubjectCatalogueEntry[]>([]);
  const [creationTerm, setCreationTerm] = useState("");
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const existingSubject = catalogue.find(subject => subject.code === code.trim().toUpperCase());
  const validForm = /^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(code.trim().toUpperCase()) &&
    (existingSubject ? existingSubject.is_active : name.trim().length > 0 && name.trim().length <= 200) &&
    Boolean(creationTerm) && !catalogueLoading && !saving;


  const progSems = [...new Set(subjects.map(s => s.progSem))].sort((a, b) => a - b);

  useEffect(() => { listLecturerSubjects().then(setSubjects).catch(error => setLoadError(error.message)).finally(() => setLoading(false)); }, []);

  const openCreateModal = async () => {
    setCode(""); setName(""); setSemester("1"); setFormError(""); setCreationTerm(""); setCatalogue([]);
    setShowCreateModal(true); setCatalogueLoading(true);
    try {
      const data = await loadSubjectCreationData();
      setCatalogue(data.catalogue); setCreationTerm(data.termLabel);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : (reason as { message?: string })?.message ?? "Unable to load the subject catalogue. Close this window and try again.");
    } finally { setCatalogueLoading(false); }
  };

  const createSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validForm || saveInFlight.current) return;
    saveInFlight.current = true; setSaving(true); setFormError("");
    try {
      await createLecturerSubject(code, existingSubject?.name ?? name, existingSubject?.programme_semester ?? Number(semester));
      setShowCreateModal(false); setLoading(true); setLoadError("");
      try { setSubjects(await listLecturerSubjects()); }
      catch { setLoadError("Your subject was saved, but the list could not refresh. Please reload the page."); }
      finally { setLoading(false); }
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : (reason as { message?: string })?.message ?? "Unable to create subject. Please try again.");
    } finally { saveInFlight.current = false; setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 2px" }}>My Subjects</h1>
          <p style={{ fontSize: "12px", color: C.textMuted }}>
            {user?.name} ({user?.id}) · {subjects[0]?.termLabel ?? "Current semester"} · {subjects.length} subject{subjects.length === 1 ? "" : "s"} across {progSems.length} programme semester{progSems.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          style={{ background: C.maroon, color: "#fff", border: "none", borderRadius: "6px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, fontFamily: C.sans, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={15} /> Create New Subject
        </button>
      </div>

      {loading && <p role="status" style={{ color: C.textMuted, fontSize: "13px" }}>Loading your subjects…</p>}
      {loadError && <p role="alert" style={{ color: C.red, fontSize: "13px" }}>Unable to load your subjects. {loadError}</p>}
      {!loading && !loadError && subjects.length === 0 && (
        <div role="status" style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", padding: "48px 24px", textAlign: "center" }}>
          <BookOpen size={32} aria-hidden="true" style={{ color: C.maroon, marginBottom: "16px" }} />
          <h2 style={{ fontFamily: C.display, color: C.text, fontSize: "20px", fontWeight: 700, margin: "0 0 10px" }}>No Subjects Added</h2>
          <p style={{ color: C.textMuted, fontSize: "13px", lineHeight: 1.7, maxWidth: "460px", margin: "0 auto" }}>
            You have not added any subjects yet. Select “Create New Subject” to set up a subject for your teaching activities.
          </p>
          <p style={{ color: C.textSub, fontSize: "12px", lineHeight: 1.7, margin: "12px 0 0" }}>Your subjects will appear here once they have been added.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        {progSems.map(ps => {
          const psSubs = subjects.filter(s => s.progSem === ps);
          return (
            <div key={ps}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ width: "28px", height: "28px", background: C.maroonLight, border: `1px solid ${C.maroon}44`, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: C.mono, fontSize: "12px", fontWeight: 700, color: C.maroon }}>{ps}</span>
                </div>
                <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: "14px", color: C.text }}>Programme Semester {ps}</span>
                <span style={{ fontFamily: C.mono, fontSize: "10px", color: C.textMuted }}>· {psSubs.length} subject{psSubs.length !== 1 ? "s" : ""}</span>
                <div style={{ flex: 1, height: "1px", background: C.border }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
                {psSubs.map(subj => {
                  const isSubmitted = subj.status === "submitted";
                  return (
                    <button
                      key={subj.offeringId}
                      onClick={() => onSelectSubject(subj)}
                      style={{ textAlign: "left", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "18px 20px", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={event => { event.currentTarget.style.borderColor = `${C.maroon}88`; event.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={event => { event.currentTarget.style.borderColor = C.border; event.currentTarget.style.transform = "none"; }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                          <span style={{ fontFamily: C.mono, fontSize: "11px", color: C.maroon, fontWeight: 600 }}>{subj.code}</span>
                          <span style={{ fontFamily: C.mono, fontSize: "9px", background: C.elevated, border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: "3px", padding: "1px 5px" }}>SEM {subj.progSem}</span>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", fontFamily: C.mono, padding: "2px 7px", borderRadius: "3px", background: isSubmitted ? C.greenLight : C.amberLight, color: isSubmitted ? C.green : C.amber, border: `1px solid ${isSubmitted ? C.green + "44" : C.amber + "44"}` }}>
                          {isSubmitted && <CheckCircle size={9} />}{isSubmitted ? "FINALISED" : "IN PROGRESS"}
                        </div>
                      </div>
                      <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "14px", color: C.text, marginBottom: "10px" }}>{subj.name}</div>
                      <div style={{ display: "flex", gap: "14px", marginBottom: "10px", fontSize: "11px", color: C.textMuted }}>
                        <div><span style={{ fontFamily: C.mono, color: C.textSub }}>{subj.students}</span> students</div>
                        <div>Last Sync: <span style={{ fontFamily: C.mono, color: C.textSub }}>{subj.lastSync ? new Date(subj.lastSync).toLocaleString() : "Pending"}</span></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", color: C.maroon, fontSize: "12px", fontWeight: 600 }}>
                        <span>Manage Subject Hub</span><ChevronRight size={14} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div role="dialog" aria-modal="true" aria-label="Create New Subject" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", width: "420px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "16px", color: C.text }}>Create New Subject</div>
              <button type="button" aria-label="Close" disabled={saving || catalogueLoading} onClick={() => setShowCreateModal(false)} style={{ background: "none", border: 0, color: C.textMuted, cursor: "pointer" }}><X size={18} /></button>
            </div>
            <form onSubmit={createSubject}>
            <p style={{ color: C.textMuted, fontSize: "12px", lineHeight: 1.6 }}>
              {catalogueLoading ? "Loading subject catalogue…" : creationTerm ? `Add a subject for ${creationTerm}. Select an existing code or enter a new one.` : "Subject creation is unavailable."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "11px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>SUBJECT CODE</label>
                <input aria-label="Subject code" list="subject-catalogue" required maxLength={30} disabled={saving || catalogueLoading} value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setFormError(""); }} placeholder="e.g. ITT600" style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "13px", outline: "none" }} />
              </div>
              <datalist id="subject-catalogue">{catalogue.filter(subject => subject.is_active).map(subject => <option key={subject.code} value={subject.code}>{subject.name}</option>)}</datalist>
              {existingSubject && <p role="status" style={{ color: existingSubject.is_active ? C.textSub : C.red, fontSize: "12px", lineHeight: 1.6, margin: 0 }}>{existingSubject.is_active ? "This subject is already registered. Its details will be reused for your own classes and assessments." : "This subject is inactive and cannot be added."}</p>}
              <div>
                <label style={{ fontSize: "11px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>SUBJECT NAME</label>
                <input aria-label="Subject name" required maxLength={200} disabled={Boolean(existingSubject) || saving || catalogueLoading} value={existingSubject?.name ?? name} onChange={event => setName(event.target.value)} placeholder="e.g. Cloud Computing & DevOps" style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "13px", outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontFamily: C.mono, color: C.textMuted, display: "block", marginBottom: "4px" }}>PROGRAMME SEMESTER</label>
                <select aria-label="Programme semester" disabled={Boolean(existingSubject) || saving || catalogueLoading} value={existingSubject ? String(existingSubject.programme_semester ?? "") : semester} onChange={event => setSemester(event.target.value)} style={{ width: "100%", padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text }}>
                  {existingSubject && existingSubject.programme_semester === null && <option value="">Not specified</option>}
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(value => <option key={value} value={value}>Semester {value}</option>)}
                </select>
              </div>
              {formError && <div role="alert" style={{ color: C.red, fontSize: "12px" }}>{formError}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" disabled={saving || catalogueLoading} onClick={() => setShowCreateModal(false)} style={{ padding: "8px 14px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "6px", color: C.text, fontSize: "12px", cursor: "pointer" }}>Cancel</button>
              <button type="submit" disabled={!validForm} style={{ padding: "8px 14px", background: C.maroon, border: "none", borderRadius: "6px", color: "#fff", fontWeight: 600, fontSize: "12px", cursor: "pointer" , opacity: validForm ? 1 : .55 }}>{saving ? "Saving…" : existingSubject ? "Add Subject" : "Create Subject"}</button>
            </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
