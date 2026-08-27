import React, { useEffect, useState } from "react";
import { CheckCircle, ChevronLeft, ChevronRight, MoreVertical, Plus, RefreshCw, Users, X } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { getLecturerClassSections, ELIGIBLE_THRESHOLD } from "../../mock/mockData";
import { ClassSectionRecord, StudentRecord } from "../../types";
import { classSelectorActionStyle, classSelectorCardStyle, classSelectorGridStyle, classSelectorIconStyle, classSelectorMetaStyle, classSelectorTitleStyle } from "./classSelectorStyles";

type ClassSection = ClassSectionRecord;
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const timeSlots = ["8:00–10:00", "10:00–12:00", "12:00–14:00", "14:00–16:00", "16:00–18:00"];
const seedSections = (subjectCode: string): ClassSection[] => getLecturerClassSections(subjectCode);
const blankForm = { label: "", day: "Monday", time: "8:00–10:00", room: "", capacity: "" };
type ClassForm = typeof blankForm;
type MarkField = "quiz1" | "assign1" | "test1" | "quiz2" | "test2";

export function MarksEntryTab({ subjectCode }: { subjectCode: string }) {
  const C = useColors();
  const storageKey = `carrymark_class_sections_v2_${subjectCode}`;
  const [sections, setSections] = useState<ClassSection[]>(() => { try { return JSON.parse(localStorage.getItem(storageKey) || "null") ?? seedSections(subjectCode); } catch { return seedSections(subjectCode); } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(blankForm);
  const [synced, setSynced] = useState(false);
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(sections)), [sections, storageKey]);
  const selected = sections.find(section => section.id === selectedId) ?? null;
  const formValid = form.label.trim().length > 0 && form.room.trim().length > 0 && Number(form.capacity) > 0;

  const openAdd = () => { setForm(blankForm); setEditingId(null); setModal("add"); };
  const openEdit = (section: ClassSection) => { setForm({ label: section.label, day: section.day, time: section.time, room: section.room, capacity: String(section.capacity) }); setEditingId(section.id); setMenuId(null); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditingId(null); setForm(blankForm); };
  const saveSection = () => {
    if (!formValid) return;
    const values = { label: form.label.trim(), day: form.day, time: form.time, room: form.room.trim(), capacity: Number(form.capacity) };
    if (modal === "edit" && editingId) setSections(previous => previous.map(section => section.id === editingId ? { ...section, ...values } : section));
    else setSections(previous => [...previous, { id: `SEC-${Date.now()}`, ...values, students: [], finalised: false }]);
    closeModal();
  };
  const removeSection = (section: ClassSection) => { setMenuId(null); if (window.confirm(`Remove “${section.label}”?\n\nThe class section and its mark-entry records will be deleted. This cannot be undone.`)) { setSections(previous => previous.filter(item => item.id !== section.id)); if (selectedId === section.id) setSelectedId(null); } };
  const updateMark = (studentId: string, field: MarkField, rawValue: string) => {
    if (!selected || selected.finalised) return;
    const limits: Record<MarkField, number> = { quiz1: 10, assign1: 20, test1: 30, quiz2: 10, test2: 30 };
    const value = Math.max(0, Math.min(Number(rawValue) || 0, limits[field]));
    setSections(previous => previous.map(section => section.id !== selected.id ? section : { ...section, students: section.students.map(student => {
      if (student.id !== studentId) return student;
      const updated = { ...student, [field]: value };
      const rawTotal = (updated.quiz1 ?? 0) + (updated.assign1 ?? 0) + (updated.test1 ?? 0) + (updated.quiz2 ?? 0) + (updated.test2 ?? 0);
      const carryTotal = rawTotal / 2;
      return { ...updated, totalCarry: carryTotal, eligible: carryTotal >= ELIGIBLE_THRESHOLD };
    }) }));
  };
  const finalise = () => { if (selected && !selected.finalised && window.confirm(`Finalise carry marks for ${selected.label}?\n\nMarks will be locked and submitted to the administrator.`)) setSections(previous => previous.map(section => section.id === selected.id ? { ...section, finalised: true } : section)); };
  const syncMarks = () => { setSynced(true); window.setTimeout(() => setSynced(false), 2200); };
  const fieldStyle: React.CSSProperties = { width: "100%", height: "43px", boxSizing: "border-box", padding: "0 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", color: C.text, fontSize: "13px", outline: "none" };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "7px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px", letterSpacing: ".06em" };

  if (!selected) return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "18px", marginBottom: "20px" }}><div><h2 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "20px", color: C.text, margin: "0 0 5px" }}>Select a Class</h2><p style={{ color: C.textMuted, fontSize: "12px", margin: 0 }}>{subjectCode} has {sections.length} class section{sections.length === 1 ? "" : "s"}. Choose one to begin entering marks.</p></div><button onClick={openAdd} style={{ padding: "10px 15px", border: "none", borderRadius: "7px", background: C.maroon, color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "7px" }}><Plus size={16} /> Add Class Section</button></div>
    <div style={classSelectorGridStyle}>{sections.map(section => <div key={section.id} role="button" tabIndex={0} aria-label={`Enter marks for ${section.label}`} onClick={() => setSelectedId(section.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(section.id); } }} style={{ ...classSelectorCardStyle, background: C.surface, border: `1px solid ${C.borderMid}` }} onMouseEnter={event => { event.currentTarget.style.borderColor = `${C.maroon}88`; event.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={event => { event.currentTarget.style.borderColor = C.borderMid; event.currentTarget.style.transform = "none"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div style={{ ...classSelectorIconStyle, background: C.maroonLight, border: `1px solid ${C.maroon}55`, color: C.maroon }}><Users size={21} /></div><div style={{ display: "flex", alignItems: "center", gap: "7px" }}><span style={{ padding: "5px 8px", border: `1px solid ${C.borderMid}`, borderRadius: "5px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>{section.capacity} students</span><button aria-label={`Manage ${section.label}`} onClick={event => { event.stopPropagation(); setMenuId(menuId === section.id ? null : section.id); }} style={{ padding: "3px", border: "none", background: "transparent", color: C.textMuted, cursor: "pointer" }}><MoreVertical size={18} /></button></div></div>
      {menuId === section.id && <div onClick={event => event.stopPropagation()} style={{ position: "absolute", right: "18px", top: "53px", zIndex: 4, minWidth: "110px", padding: "5px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}><button onClick={() => openEdit(section)} style={{ width: "100%", padding: "7px 8px", border: "none", background: "transparent", color: C.text, textAlign: "left", cursor: "pointer", fontSize: "11px" }}>Edit class</button><button onClick={() => removeSection(section)} style={{ width: "100%", padding: "7px 8px", border: "none", background: "transparent", color: C.red, textAlign: "left", cursor: "pointer", fontSize: "11px" }}>Remove class</button></div>}
      <h3 style={{ ...classSelectorTitleStyle, color: C.text, fontFamily: C.display }}>{section.label}</h3><div style={{ ...classSelectorMetaStyle, color: C.textMuted }}>{section.day} {section.time}<br />{section.room}</div><div style={{ ...classSelectorActionStyle, color: C.maroon }}>Enter Marks <ChevronRight size={14} /></div>
    </div>)}</div>
    {sections.length === 0 && <div style={{ padding: "40px", textAlign: "center", background: C.surface, border: `1px dashed ${C.borderMid}`, borderRadius: "10px", color: C.textMuted, fontSize: "12px" }}>No class sections yet. Select Add Class Section to create the first one.</div>}
    {modal && <ClassModal C={C} mode={modal} form={form} setForm={setForm} close={closeModal} save={saveSection} valid={formValid} subjectCode={subjectCode} fieldStyle={fieldStyle} labelStyle={labelStyle} />}
  </div>;
  return <MarkGrid C={C} sections={sections} selected={selected} setSelectedId={setSelectedId} updateMark={updateMark} syncMarks={syncMarks} synced={synced} finalise={finalise} />;
}

function ClassModal({ C, mode, form, setForm, close, save, valid, subjectCode, fieldStyle, labelStyle }: any) {
  return <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0,0,0,.72)" }} onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div style={{ width: "100%", maxWidth: "480px", padding: "28px", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "11px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "22px" }}><div><h3 style={{ margin: "0 0 5px", color: C.text, fontFamily: C.display, fontSize: "21px", fontWeight: 700 }}>{mode === "add" ? "Add Class Section" : "Edit Class Section"}</h3><div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "11px" }}>{subjectCode}</div></div><button aria-label="Close" onClick={close} style={{ border: "none", background: "transparent", color: C.textMuted, cursor: "pointer" }}><X size={21} /></button></div>
    <div style={{ marginBottom: "15px" }}><label style={labelStyle}>CLASS LABEL</label><input autoFocus value={form.label} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, label: event.target.value }))} placeholder="e.g. Class D" style={fieldStyle} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "13px", marginBottom: "15px" }}><div><label style={labelStyle}>DAY</label><select value={form.day} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, day: event.target.value }))} style={fieldStyle}>{days.map(day => <option key={day}>{day}</option>)}</select></div><div><label style={labelStyle}>TIME SLOT</label><select value={form.time} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, time: event.target.value }))} style={fieldStyle}>{timeSlots.map(time => <option key={time}>{time}</option>)}</select></div></div>
    <div style={{ marginBottom: "15px" }}><label style={labelStyle}>ROOM / VENUE</label><input value={form.room} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, room: event.target.value }))} placeholder="e.g. Lab Komputer 3" style={fieldStyle} /></div><div style={{ marginBottom: "22px" }}><label style={labelStyle}>STUDENT CAPACITY</label><input type="number" min="1" value={form.capacity} onChange={(event: any) => setForm((previous: ClassForm) => ({ ...previous, capacity: event.target.value }))} placeholder="e.g. 20" style={fieldStyle} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><button onClick={close} style={{ height: "44px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", color: C.textSub, cursor: "pointer" }}>Cancel</button><button disabled={!valid} onClick={save} style={{ height: "44px", border: "none", borderRadius: "7px", background: valid ? C.maroon : C.elevated, color: valid ? "#fff" : C.textMuted, cursor: valid ? "pointer" : "not-allowed", fontWeight: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}><Plus size={15} /> {mode === "add" ? "Add Section" : "Save Changes"}</button></div>
  </div></div>;
}

function MarkGrid({ C, sections, selected, setSelectedId, updateMark, syncMarks, synced, finalise }: any) {
  const markFields: Array<{ key: MarkField; label: string; max: number }> = [{ key: "quiz1", label: "Quiz 1", max: 10 }, { key: "assign1", label: "Assign. 1", max: 20 }, { key: "test1", label: "Test 1", max: 30 }, { key: "quiz2", label: "Quiz 2", max: 10 }, { key: "test2", label: "Test 2", max: 30 }];
  return <div style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", padding: "20px" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "18px", flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}><button onClick={() => setSelectedId(null)} style={{ padding: "8px 10px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.textSub, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontSize: "11px" }}><ChevronLeft size={14} /> All Classes</button><div><h2 style={{ margin: "2px 0 4px", color: C.text, fontFamily: C.display, fontSize: "20px", fontWeight: 700 }}>Mark Entry — {selected.label}</h2><div style={{ color: C.textMuted, fontSize: "11px" }}>{selected.day} {selected.time} · {selected.room} · {selected.students.length} students</div></div></div><div style={{ display: "flex", gap: "9px" }}><button onClick={syncMarks} style={{ padding: "9px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: synced ? C.green : C.textSub, cursor: "pointer", display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", fontWeight: 600 }}><RefreshCw size={14} /> {synced ? "Marks Synced" : "Sync Marks"}</button><button disabled={selected.finalised} onClick={finalise} style={{ padding: "9px 13px", background: selected.finalised ? C.greenLight : C.maroon, border: `1px solid ${selected.finalised ? C.green : C.maroon}55`, borderRadius: "6px", color: selected.finalised ? C.green : "#fff", cursor: selected.finalised ? "default" : "pointer", display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", fontWeight: 700 }}><CheckCircle size={14} /> {selected.finalised ? "Carry Marks Finalised" : "Finalise Carry Marks"}</button></div></div>
    <div style={{ display: "flex", gap: "7px", marginBottom: "17px", overflowX: "auto" }}>{sections.map((section: ClassSection) => <button key={section.id} onClick={() => setSelectedId(section.id)} style={{ padding: "7px 11px", borderRadius: "6px", border: `1px solid ${selected.id === section.id ? C.maroon : C.borderMid}`, background: selected.id === section.id ? C.maroonLight : C.elevated, color: selected.id === section.id ? C.maroon : C.textMuted, fontFamily: C.mono, fontSize: "10px", fontWeight: selected.id === section.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" }}>{section.label} ({section.capacity})</button>)}</div>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}><thead><tr style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "10px", borderBottom: `1px solid ${C.borderMid}` }}><th style={{ padding: "10px" }}>STUDENT ID</th><th style={{ padding: "10px" }}>NAME</th>{markFields.map(field => <th key={field.key} style={{ padding: "10px" }}>{field.label.toUpperCase()} /{field.max}</th>)}<th style={{ padding: "10px" }}>TOTAL /100</th><th style={{ padding: "10px" }}>ELIGIBILITY</th></tr></thead><tbody>{selected.students.map((student: StudentRecord) => { const rawTotal = (student.quiz1 ?? 0) + (student.assign1 ?? 0) + (student.test1 ?? 0) + (student.quiz2 ?? 0) + (student.test2 ?? 0); return <tr key={student.id} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "10px", color: C.textMuted, fontFamily: C.mono }}>{student.matrixNo}</td><td style={{ padding: "10px", color: C.text, fontWeight: 600 }}>{student.name}</td>{markFields.map(field => <td key={field.key} style={{ padding: "7px 10px" }}><input disabled={selected.finalised} type="number" min="0" max={field.max} value={student[field.key] ?? ""} onChange={event => updateMark(student.id, field.key, event.target.value)} style={{ width: "48px", height: "32px", boxSizing: "border-box", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "5px", color: C.text, textAlign: "center", fontFamily: C.mono, opacity: selected.finalised ? .65 : 1 }} /></td>)}<td style={{ padding: "10px", color: rawTotal >= 80 ? C.green : C.amber, fontFamily: C.mono, fontWeight: 700 }}>{rawTotal}</td><td style={{ padding: "10px" }}><span style={{ padding: "3px 6px", borderRadius: "4px", background: student.eligible ? C.greenLight : C.redLight, color: student.eligible ? C.green : C.red, fontFamily: C.mono, fontSize: "9px", fontWeight: 700 }}>{student.eligible ? "QUALIFIED" : "INELIGIBLE"}</span></td></tr>; })}</tbody></table>{selected.students.length === 0 && <div style={{ padding: "34px", textAlign: "center", color: C.textMuted, fontSize: "12px" }}>This class has no student roster yet.</div>}</div>
  </div>;
}
