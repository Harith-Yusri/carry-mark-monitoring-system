import React, { useEffect, useState } from "react";
import { Check, CheckCircle, ChevronLeft, ChevronRight, Copy, KeyRound, MoreVertical, Plus, RefreshCw, Users, X } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { useAuth } from "../../context/AuthContext";
import { AssessmentRecord, loadOfferingWeightage, createSection, deleteSection, finaliseSection, listProgrammes, loadOfferingData, rotateJoinCode, SectionRecord, updateSection, upsertMark } from "../../services/carryMarkApi";
import { ProgrammeOption } from "../../types";
import { classSelectorActionStyle, classSelectorCardStyle, classSelectorGridStyle, classSelectorIconStyle, classSelectorMetaStyle, classSelectorTitleStyle } from "./classSelectorStyles";

type StudentRecord = SectionRecord["students"][number] & { id: string };
type ClassSection = Omit<SectionRecord, "students"> & { students: StudentRecord[] };
const blankForm = { label: "", capacity: "", programmeId: "" };
type ClassForm = typeof blankForm;

export function MarksEntryTab({ offeringId, offeringProgrammeId, subjectCode }: { offeringId: string; offeringProgrammeId: string; subjectCode: string }) {
  const C = useColors();
  const { user } = useAuth();
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [carryMax, setCarryMax] = useState<number | null>(null);
  const [eligibleThreshold, setEligibleThreshold] = useState<number | null>(null);
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(blankForm);
  const [synced, setSynced] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const reload = async () => {
    const [data, settings, programmeOptions] = await Promise.all([loadOfferingData(offeringId), loadOfferingWeightage(offeringId), listProgrammes()]);
    setAssessments(data.assessments);
    setCarryMax(settings.carryMax); setEligibleThreshold(settings.eligibleThreshold);
    setProgrammes(programmeOptions);
    setSections(data.sections.map(section => ({ ...section, students: section.students.map(student => ({ ...student, id: student.enrolmentId })) })));
  };
  useEffect(() => { reload().catch(console.error); }, [offeringId]);
  const selected = sections.find(section => section.id === selectedId) ?? null;
  const formValid = form.label.trim().length > 0 && Number(form.capacity) > 0 && programmes.some(programme => programme.id === form.programmeId);

  const openAdd = () => { setForm({ ...blankForm, programmeId: offeringProgrammeId }); setEditingId(null); setModal("add"); };
  const openEdit = (section: ClassSection) => { setForm({ label: section.label, capacity: String(section.capacity), programmeId: section.programmeId }); setEditingId(section.id); setMenuId(null); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditingId(null); setForm(blankForm); };
  const saveSection = async () => {
    if (!formValid) return;
    const values = { label: form.label.trim(), capacity: Number(form.capacity), programmeId: form.programmeId };
    if (modal === "edit" && editingId) await updateSection(editingId, values); else await createSection(offeringId, values);
    await reload(); closeModal();
  };
  const removeSection = async (section: ClassSection) => { setMenuId(null); if (window.confirm(`Remove “${section.label}”?\n\nThe class section and its mark-entry records will be deleted. This cannot be undone.`)) { await deleteSection(section.id); await reload(); if (selectedId === section.id) setSelectedId(null); } };
  const updateMark = async (studentId: string, assessmentId: string, rawValue: string) => {
    if (!selected || selected.finalised || !user?.authId) return;
    const assessment = assessments.find(item => item.id === assessmentId);
    if (!assessment) return;
    const value = Math.max(0, Math.min(Number(rawValue) || 0, assessment.maxMarks));
    try {
      await upsertMark(studentId, assessmentId, value, user.authId);
      setSections(previous => previous.map(section => section.id !== selected.id ? section : { ...section, students: section.students.map(student => {
        if (student.id !== studentId) return student;
        const scores = { ...student.scores, [assessmentId]: value };
        const totalCarry = Math.round(assessments.reduce((sum, item) => sum + (scores[item.id] ?? 0) / item.maxMarks * item.weightage, 0) * 100) / 100;
        return { ...student, scores, totalCarry, eligible: eligibleThreshold === null ? student.eligible : totalCarry >= eligibleThreshold };
      }) }));
    } catch (reason) { window.alert((reason as { message?: string }).message ?? "Unable to save mark."); }
  };
  const finalise = async () => { if (selected && !selected.finalised && window.confirm(`Finalise carry marks for ${selected.label}?\n\nMarks will be locked and submitted to the administrator.`)) { await finaliseSection(selected.id); await reload(); } };
  const syncMarks = async () => { await reload(); setSynced(true); window.setTimeout(() => setSynced(false), 2200); };
  const copyJoinCode = async (section: ClassSection) => {
    if (!section.joinCode) return;
    await navigator.clipboard.writeText(section.joinCode);
    setCopiedId(section.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };
  const regenerateJoinCode = async (section: ClassSection) => {
    setMenuId(null);
    if (!window.confirm(`Generate a new invitation code for ${section.label}?\n\nThe current code will stop working immediately.`)) return;
    setRotatingId(section.id);
    try { await rotateJoinCode(section.id); await reload(); } finally { setRotatingId(null); }
  };
  const fieldStyle: React.CSSProperties = { width: "100%", height: "43px", boxSizing: "border-box", padding: "0 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", color: C.text, fontSize: "13px", outline: "none" };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "7px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px", letterSpacing: ".06em" };

  if (!selected) return <div>
    <div className="responsive-action-header" style={{ marginBottom: "20px" }}><div><h2 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "20px", color: C.text, margin: "0 0 5px" }}>Select a Class</h2><p style={{ color: C.textMuted, fontSize: "12px", margin: 0 }}>{subjectCode} has {sections.length} class section{sections.length === 1 ? "" : "s"}. Choose one to begin entering marks.</p></div><button onClick={openAdd} style={{ padding: "10px 15px", border: "none", borderRadius: "7px", background: C.maroon, color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "7px" }}><Plus size={16} /> Add Class Section</button></div>
    <div style={classSelectorGridStyle}>{sections.map(section => <div key={section.id} role="button" tabIndex={0} aria-label={`Enter marks for ${section.label}`} onClick={() => setSelectedId(section.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(section.id); } }} style={{ ...classSelectorCardStyle, background: C.surface, border: `1px solid ${C.borderMid}` }} onMouseEnter={event => { event.currentTarget.style.borderColor = `${C.maroon}88`; event.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={event => { event.currentTarget.style.borderColor = C.borderMid; event.currentTarget.style.transform = "none"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ ...classSelectorIconStyle, background: C.maroonLight, border: `1px solid ${C.maroon}55`, color: C.maroon }}><Users size={21} /></div><div style={{ display: "flex", alignItems: "center", gap: "7px" }}><span style={{ padding: "5px 8px", border: `1px solid ${C.borderMid}`, borderRadius: "5px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>{section.students.length} students</span><button aria-label={`Manage ${section.label}`} onClick={event => { event.stopPropagation(); setMenuId(menuId === section.id ? null : section.id); }} style={{ padding: "3px", border: "none", background: "transparent", color: C.textMuted, cursor: "pointer" }}><MoreVertical size={18} /></button></div></div>
      {menuId === section.id && <div onClick={event => event.stopPropagation()} style={{ position: "absolute", right: "18px", top: "53px", zIndex: 4, minWidth: "145px", padding: "5px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}><button onClick={() => openEdit(section)} style={{ width: "100%", padding: "7px 8px", border: "none", background: "transparent", color: C.text, textAlign: "left", cursor: "pointer", fontSize: "11px" }}>Edit class</button><button onClick={() => regenerateJoinCode(section)} style={{ width: "100%", padding: "7px 8px", border: "none", background: "transparent", color: C.text, textAlign: "left", cursor: "pointer", fontSize: "11px" }}>Regenerate code</button><button onClick={() => removeSection(section)} style={{ width: "100%", padding: "7px 8px", border: "none", background: "transparent", color: C.red, textAlign: "left", cursor: "pointer", fontSize: "11px" }}>Remove class</button></div>}
      <h3 style={{ ...classSelectorTitleStyle, color: C.text, fontFamily: C.display }}>{section.label}</h3><div style={{ ...classSelectorMetaStyle, color: C.textMuted }}>{section.programmeCode} · {section.students.length} enrolled · capacity {section.capacity}</div>
      <button onClick={event => { event.stopPropagation(); void copyJoinCode(section); }} disabled={!section.joinCode} title="Copy class invitation code" style={{ width: "100%", marginTop: "12px", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.textSub, cursor: section.joinCode ? "pointer" : "default" }}><span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: C.textMuted }}><KeyRound size={13} /> CLASS CODE</span><strong style={{ fontFamily: C.mono, fontSize: "12px", color: C.maroon, letterSpacing: ".08em" }}>{rotatingId === section.id ? "GENERATING…" : section.joinCode ?? "NOT SET"}</strong>{copiedId === section.id ? <Check size={13} color={C.green} /> : <Copy size={13} />}</button>
      <div style={{ ...classSelectorActionStyle, color: C.maroon }}>Enter Marks <ChevronRight size={14} /></div>
    </div>)}</div>
    {sections.length === 0 && <div style={{ padding: "40px", textAlign: "center", background: C.surface, border: `1px dashed ${C.borderMid}`, borderRadius: "10px", color: C.textMuted, fontSize: "12px" }}>No class sections yet. Select Add Class Section to create the first one.</div>}
    {modal && <ClassModal C={C} mode={modal} form={form} setForm={setForm} close={closeModal} save={saveSection} valid={formValid} subjectCode={subjectCode} programmes={programmes} fieldStyle={fieldStyle} labelStyle={labelStyle} />}
  </div>;
  return <MarkGrid assessments={assessments} carryMax={carryMax} C={C} sections={sections} selected={selected} setSelectedId={setSelectedId} updateMark={updateMark} syncMarks={syncMarks} synced={synced} finalise={finalise} copyJoinCode={copyJoinCode} copiedId={copiedId} regenerateJoinCode={regenerateJoinCode} rotatingId={rotatingId} />;
}

function ClassModal({ C, mode, form, setForm, close, save, valid, subjectCode, programmes, fieldStyle, labelStyle }: any) {
  return <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0,0,0,.72)" }} onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div style={{ width: "100%", maxWidth: "480px", padding: "28px", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "11px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "22px" }}><div><h3 style={{ margin: "0 0 5px", color: C.text, fontFamily: C.display, fontSize: "21px", fontWeight: 700 }}>{mode === "add" ? "Add Class Section" : "Edit Class Section"}</h3><div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "11px" }}>{subjectCode}</div></div><button aria-label="Close" onClick={close} style={{ border: "none", background: "transparent", color: C.textMuted, cursor: "pointer" }}><X size={21} /></button></div>
    <div style={{ marginBottom: "15px" }}><label style={labelStyle}>CLASS LABEL</label><input autoFocus value={form.label} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, label: event.target.value }))} placeholder="e.g. Class D" style={fieldStyle} /></div>
    <div style={{ marginBottom: "15px" }}><label style={labelStyle}>PROGRAMME</label><select aria-label="Programme" value={form.programmeId} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, programmeId: event.target.value }))} style={fieldStyle}><option value="">Select programme</option>{programmes.map((programme: ProgrammeOption) => <option key={programme.id} value={programme.id}>{programme.code} — {programme.name}</option>)}</select></div>
    <div style={{ marginBottom: "22px" }}><label style={labelStyle}>STUDENT CAPACITY</label><input type="number" min="1" value={form.capacity} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, capacity: event.target.value }))} placeholder="e.g. 20" style={fieldStyle} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><button onClick={close} style={{ height: "44px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", color: C.textSub, cursor: "pointer" }}>Cancel</button><button disabled={!valid} onClick={save} style={{ height: "44px", border: "none", borderRadius: "7px", background: valid ? C.maroon : C.elevated, color: valid ? "#fff" : C.textMuted, cursor: valid ? "pointer" : "not-allowed", fontWeight: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}><Plus size={15} /> {mode === "add" ? "Add Section" : "Save Changes"}</button></div>
  </div></div>;
}

function MarkGrid({ assessments, carryMax, C, sections, selected, setSelectedId, updateMark, syncMarks, synced, finalise, copyJoinCode, copiedId, regenerateJoinCode, rotatingId }: any) {
  const markFields = assessments.map((item: AssessmentRecord) => ({ key: item.id, label: item.name, max: item.maxMarks }));
  return <div style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", padding: "20px" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "18px", flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}><button onClick={() => setSelectedId(null)} style={{ padding: "8px 10px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.textSub, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontSize: "11px" }}><ChevronLeft size={14} /> All Classes</button><div><h2 style={{ margin: "2px 0 4px", color: C.text, fontFamily: C.display, fontSize: "20px", fontWeight: 700 }}>Mark Entry — {selected.label}</h2><div style={{ color: C.textMuted, fontSize: "11px" }}>{selected.programmeCode} · {selected.students.length} students · capacity {selected.capacity}</div></div></div><div style={{ display: "flex", gap: "9px" }}><button onClick={syncMarks} style={{ padding: "9px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: synced ? C.green : C.textSub, cursor: "pointer", display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", fontWeight: 600 }}><RefreshCw size={14} /> {synced ? "Marks Synced" : "Sync Marks"}</button><button disabled={selected.finalised} onClick={finalise} style={{ padding: "9px 13px", background: selected.finalised ? C.greenLight : C.maroon, border: `1px solid ${selected.finalised ? C.green : C.maroon}55`, borderRadius: "6px", color: selected.finalised ? C.green : "#fff", cursor: selected.finalised ? "default" : "pointer", display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", fontWeight: 700 }}><CheckCircle size={14} /> {selected.finalised ? "Carry Marks Finalised" : "Finalise Carry Marks"}</button></div></div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", padding: "12px 14px", marginBottom: "14px", background: C.maroonLight, border: `1px solid ${C.maroon}55`, borderRadius: "7px" }}><div><div style={{ display: "flex", alignItems: "center", gap: "6px", color: C.textMuted, fontFamily: C.mono, fontSize: "9px", letterSpacing: ".06em" }}><KeyRound size={13} /> STUDENT CLASS INVITATION CODE</div><strong style={{ display: "block", marginTop: "5px", color: C.maroon, fontFamily: C.mono, fontSize: "18px", letterSpacing: ".1em" }}>{rotatingId === selected.id ? "GENERATING…" : selected.joinCode ?? "NOT GENERATED"}</strong></div><div style={{ display: "flex", gap: "8px" }}><button disabled={!selected.joinCode} onClick={() => copyJoinCode(selected)} style={{ padding: "8px 11px", display: "flex", alignItems: "center", gap: "6px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: copiedId === selected.id ? C.green : C.textSub, cursor: selected.joinCode ? "pointer" : "default", fontSize: "10px", fontWeight: 700 }}>{copiedId === selected.id ? <Check size={13} /> : <Copy size={13} />}{copiedId === selected.id ? "Copied" : "Copy Code"}</button><button disabled={rotatingId === selected.id} onClick={() => regenerateJoinCode(selected)} style={{ padding: "8px 11px", display: "flex", alignItems: "center", gap: "6px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.textSub, cursor: rotatingId === selected.id ? "wait" : "pointer", fontSize: "10px", fontWeight: 700 }}><RefreshCw size={13} /> New Code</button></div></div>
    <div style={{ display: "flex", gap: "7px", marginBottom: "17px", overflowX: "auto" }}>{sections.map((section: ClassSection) => <button key={section.id} onClick={() => setSelectedId(section.id)} style={{ padding: "7px 11px", borderRadius: "6px", border: `1px solid ${selected.id === section.id ? C.maroon : C.borderMid}`, background: selected.id === section.id ? C.maroonLight : C.elevated, color: selected.id === section.id ? C.maroon : C.textMuted, fontFamily: C.mono, fontSize: "10px", fontWeight: selected.id === section.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" }}>{section.label} · {section.programmeCode} ({section.students.length})</button>)}</div>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}><thead><tr style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "10px", borderBottom: `1px solid ${C.borderMid}` }}><th style={{ padding: "10px" }}>STUDENT ID</th><th style={{ padding: "10px" }}>NAME</th>{markFields.map(field => <th key={field.key} style={{ padding: "10px" }}>{field.label.toUpperCase()} /{field.max}</th>)}<th style={{ padding: "10px" }}>CARRY MARK /{carryMax ?? "Not set"}</th><th style={{ padding: "10px" }}>ELIGIBILITY</th></tr></thead><tbody>{selected.students.map((student: StudentRecord) => { const rawTotal = student.totalCarry; return <tr key={student.id} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "10px", color: C.textMuted, fontFamily: C.mono }}>{student.matrixNo}</td><td style={{ padding: "10px", color: C.text, fontWeight: 600 }}>{student.name}</td>{markFields.map(field => <td key={field.key} style={{ padding: "7px 10px" }}><input disabled={selected.finalised} type="number" min="0" max={field.max} value={student.scores[field.key] ?? ""} onChange={event => updateMark(student.id, field.key, event.target.value)} style={{ width: "48px", height: "32px", boxSizing: "border-box", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "5px", color: C.text, textAlign: "center", fontFamily: C.mono, opacity: selected.finalised ? .65 : 1 }} /></td>)}<td style={{ padding: "10px", color: student.eligible ? C.green : C.amber, fontFamily: C.mono, fontWeight: 700 }}>{rawTotal}</td><td style={{ padding: "10px" }}><span style={{ padding: "3px 6px", borderRadius: "4px", background: student.eligible ? C.greenLight : C.redLight, color: student.eligible ? C.green : C.red, fontFamily: C.mono, fontSize: "9px", fontWeight: 700 }}>{student.eligible ? "QUALIFIED" : "INELIGIBLE"}</span></td></tr>; })}</tbody></table>{selected.students.length === 0 && <div style={{ padding: "34px", textAlign: "center", color: C.textMuted, fontSize: "12px" }}>This class has no student roster yet.</div>}</div>
  </div>;
}
