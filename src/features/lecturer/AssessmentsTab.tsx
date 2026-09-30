import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, Edit3, Plus, Trash2, X } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { loadOfferingWeightage, saveOfferingWeightage, AssessmentRecord as Assessment, deleteAssessment, listAssessments, saveAssessment as persistAssessment } from "../../services/carryMarkApi";

const emptyForm = { name: "", type: "Quiz", maxMarks: "", weightage: "" };
type AssessmentForm = typeof emptyForm;

export function AssessmentsTab({ offeringId, subjectCode }: { offeringId: string; subjectCode: string }) {
  const C = useColors();
  const [carryMax, setCarryMax] = useState<number | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Assessment[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssessmentForm>(emptyForm);

  const reload = () => listAssessments(offeringId).then(setItems).catch(reason => setError(reason.message));
  useEffect(() => {
    setLoading(true); setError(""); setCarryMax(null); setWeightInput("");
    Promise.all([listAssessments(offeringId), loadOfferingWeightage(offeringId)])
      .then(([assessments, settings]) => { setItems(assessments); setCarryMax(settings.carryMax); setWeightInput(settings.carryMax === null ? "" : String(settings.carryMax)); })
      .catch(reason => setError(reason.message)).finally(() => setLoading(false));
  }, [offeringId]);
  const saveTotalWeight = async (event: React.FormEvent) => {
    event.preventDefault(); if (savingWeight || loading) return;
    setSavingWeight(true); setError("");
    try { await saveOfferingWeightage(offeringId, Number(weightInput)); setCarryMax(Number(weightInput)); }
    catch (reason) { setError((reason as { message?: string }).message ?? "Unable to save total weightage."); }
    finally { setSavingWeight(false); }
  };

  const totalWeight = useMemo(() => items.reduce((sum, item) => sum + item.weightage, 0), [items]);
  const editingItem = items.find(item => item.id === editingId);
  const weightWithoutEditing = totalWeight - (editingItem?.weightage ?? 0);
  const prospectiveTotal = weightWithoutEditing + (Number(form.weightage) || 0);
  const remaining = Math.max(0, (carryMax ?? 0) - weightWithoutEditing);
  const formValid = form.name.trim().length > 0 && Number(form.maxMarks) > 0 && Number(form.weightage) > 0 && carryMax !== null && prospectiveTotal <= carryMax;

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setModal("add"); };
  const openEdit = (item: Assessment) => {
    setForm({ name: item.name, type: item.type, maxMarks: String(item.maxMarks), weightage: String(item.weightage) });
    setEditingId(item.id);
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setEditingId(null); setForm(emptyForm); };

  const saveAssessment = async () => {
    if (!formValid) return;
    const values = { name: form.name.trim(), type: form.type, maxMarks: Number(form.maxMarks), weightage: Number(form.weightage) };
    setError("");
    try { await persistAssessment(offeringId, values, editingId ?? undefined); await reload(); closeModal(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save assessment."); }
  };

  const removeAssessment = async (item: Assessment) => {
    const confirmed = window.confirm(`Remove “${item.name}”?\n\nThis assessment component and its configuration will be deleted. This action cannot be undone.`);
    if (confirmed) try { await deleteAssessment(item.id); await reload(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove assessment."); }
  };

  const weightSaveDisabled = loading || savingWeight || !weightInput || Number(weightInput) === carryMax;

  const inputStyle: React.CSSProperties = { width: "100%", height: "43px", boxSizing: "border-box", padding: "0 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "7px", color: C.text, fontSize: "13px", outline: "none" };
  const labelStyle: React.CSSProperties = { display: "block", marginBottom: "7px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px", letterSpacing: ".06em" };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "10px", padding: "24px" }}>
      <div className="responsive-action-header" style={{ marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "20px", color: C.text, margin: "0 0 4px" }}>Continuous Assessment Components</h2>
          <p style={{ fontSize: "12px", color: C.textMuted, margin: 0 }}>Set the total carry-mark weightage for this subject, then allocate it across assessments.</p>
        </div>
        <button disabled={loading || carryMax === null || savingWeight} onClick={openAdd} style={{ flexShrink: 0, padding: "9px 14px", background: C.maroon, color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><Plus size={15} /> Add Assessment</button>
      </div>

      <form onSubmit={saveTotalWeight} style={{ marginBottom: "20px" }}>
        <label htmlFor="subject-carry-max" style={labelStyle}>TOTAL CARRY-MARK WEIGHTAGE (%)</label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <input id="subject-carry-max" type="number" min="0.01" max="100" step="0.01" required value={weightInput} disabled={loading || savingWeight} onChange={event => setWeightInput(event.target.value)} placeholder="e.g. 60" style={{ ...inputStyle, width: "120px", height: "36px", padding: "0 10px", borderRadius: "6px", fontFamily: C.mono, fontSize: "12px", opacity: loading || savingWeight ? .6 : 1 }} />
          <button type="submit" disabled={weightSaveDisabled} style={{ height: "36px", boxSizing: "border-box", padding: "0 14px", border: `1px solid ${weightSaveDisabled ? C.borderMid : C.maroon}`, borderRadius: "6px", background: weightSaveDisabled ? C.elevated : C.maroon, color: weightSaveDisabled ? C.textMuted : "#fff", fontFamily: C.sans, fontSize: "12px", fontWeight: 700, lineHeight: 1, cursor: savingWeight ? "wait" : weightSaveDisabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap" }}>{savingWeight ? "Saving…" : "Save Weightage"}</button>
        </div>
      </form>
      {!loading && carryMax === null && <p style={{ color: C.textMuted, fontSize: "12px" }}>Enter and save the subject’s total weightage before adding assessments.</p>}
      {!modal && error && <p role="alert" style={{ color: C.red }}>{error}</p>}
      <div style={{ height: "6px", background: C.elevated, borderRadius: "4px", overflow: "hidden" }}><div style={{ width: `${carryMax ? Math.min(totalWeight / carryMax * 100, 100) : 0}%`, height: "100%", background: totalWeight === carryMax ? C.green : totalWeight > (carryMax ?? 0) ? C.red : C.maroon, transition: "width .2s" }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0 20px", color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}><span>Total weightage allocated</span><strong style={{ color: totalWeight === carryMax ? C.green : totalWeight > (carryMax ?? 0) ? C.red : C.textSub }}>{totalWeight}% / {carryMax === null ? "Not set" : `${carryMax}%`}</strong></div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: "680px", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
          <thead><tr style={{ borderBottom: `1px solid ${C.borderMid}`, color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}><th style={{ padding: "11px 12px" }}>ASSESSMENT COMPONENT</th><th style={{ padding: "11px 12px" }}>TYPE</th><th style={{ padding: "11px 12px" }}>MAX SCORE</th><th style={{ padding: "11px 12px" }}>WEIGHTAGE</th><th style={{ padding: "11px 12px", textAlign: "right" }}>ACTIONS</th></tr></thead>
          <tbody>{items.map(item => <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "13px 12px", color: C.text, fontWeight: 600 }}>{item.name}</td><td style={{ padding: "13px 12px", color: C.textSub }}>{item.type}</td><td style={{ padding: "13px 12px", color: C.textSub, fontFamily: C.mono }}>{item.maxMarks}</td><td style={{ padding: "13px 12px", color: C.text, fontFamily: C.mono, fontWeight: 700 }}>{item.weightage}%</td><td style={{ padding: "13px 12px" }}><div style={{ display: "flex", justifyContent: "flex-end", gap: "7px" }}><button onClick={() => openEdit(item)} style={{ padding: "6px 9px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "5px", color: C.textSub, cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" }}><Edit3 size={11} /> Edit</button><button onClick={() => removeAssessment(item)} style={{ padding: "6px 9px", background: C.redLight, border: `1px solid ${C.red}44`, borderRadius: "5px", color: C.red, cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" }}><Trash2 size={11} /> Remove</button></div></td></tr>)}</tbody>
        </table>
        {items.length === 0 && <div style={{ padding: "28px", textAlign: "center", color: C.textMuted, fontSize: "12px" }}>No assessment components yet. Select Add Assessment to create one.</div>}
      </div>

      {modal && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0,0,0,.72)" }} onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}>
        <div style={{ width: "100%", maxWidth: "500px", boxSizing: "border-box", padding: "28px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "11px", boxShadow: "0 24px 70px rgba(0,0,0,.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" }}><div><h3 style={{ margin: "0 0 5px", color: C.text, fontFamily: C.display, fontSize: "21px", fontWeight: 700 }}>{modal === "add" ? "Add Assessment Component" : "Edit Assessment"}</h3><div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "11px" }}>{subjectCode}</div></div><button aria-label="Close" onClick={closeModal} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: "2px" }}><X size={21} /></button></div>
          <div style={{ marginBottom: "16px" }}><label style={labelStyle}>COMPONENT NAME</label><input autoFocus value={form.name} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} placeholder="e.g. Quiz 3" style={inputStyle} /></div>
          <div style={{ marginBottom: "16px" }}><label style={labelStyle}>COMPONENT TYPE</label><select value={form.type} onChange={event => setForm(previous => ({ ...previous, type: event.target.value }))} style={inputStyle}><option>Quiz</option><option>Assignment</option><option>Test</option><option>Project</option><option>Presentation</option><option>Lab</option></select></div>
          <div className="form-two-column" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}><div><label style={labelStyle}>MAX SCORE</label><input type="number" min="1" value={form.maxMarks} onChange={event => setForm(previous => ({ ...previous, maxMarks: event.target.value }))} placeholder="e.g. 20" style={inputStyle} /></div><div><label style={labelStyle}>WEIGHTAGE (%) — {remaining}% LEFT</label><input type="number" min="0.01" step="0.01" max={remaining} value={form.weightage} onChange={event => setForm(previous => ({ ...previous, weightage: event.target.value }))} placeholder={`Max ${remaining}`} style={inputStyle} /></div></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", marginBottom: "20px", borderRadius: "7px", background: C.elevated, color: C.textMuted, fontFamily: C.mono, fontSize: "11px" }}><span>Total after save</span><strong style={{ color: prospectiveTotal > (carryMax ?? 0) ? C.red : prospectiveTotal === carryMax ? C.green : C.amber }}>{prospectiveTotal}% / {carryMax === null ? "Not set" : `${carryMax}%`}</strong></div>
          {error && <div style={{ color: C.red, fontSize: "11px", margin: "-10px 0 14px" }}>{error}</div>}
          {prospectiveTotal > (carryMax ?? 0) && <div style={{ color: C.red, fontSize: "11px", margin: "-10px 0 14px" }}>Weightage cannot exceed the remaining {remaining}%.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><button onClick={closeModal} style={{ height: "44px", borderRadius: "7px", background: C.elevated, border: `1px solid ${C.borderMid}`, color: C.textSub, cursor: "pointer", fontSize: "13px" }}>Cancel</button><button disabled={!formValid} onClick={saveAssessment} style={{ height: "44px", borderRadius: "7px", border: "none", background: formValid ? C.maroon : C.elevated, color: formValid ? "#fff" : C.textMuted, cursor: formValid ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all .15s" }}>{modal === "add" ? <Plus size={15} /> : <CheckCircle size={15} />}{modal === "add" ? "Add Assessment" : "Save Changes"}</button></div>
        </div>
      </div>}
    </div>
  );
}
