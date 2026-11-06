import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Edit3, Plus, Trash2, X } from "lucide-react";
import { workspace as W } from "./workspaceStyles";
import { userError } from "../../utils/errors";
import type { AssessmentRecord as Assessment } from "../../services/carryMarkApi";
import { loadAssessmentStructure, saveOfferingWeightage, deleteAssessment, saveAssessment as persistAssessment } from "../../services/subjectAssessmentApi";

const componentTypes = ["Quiz", "Assignment", "Test", "Project", "Presentation", "Lab", "Practical", "Case Study", "Final Assessment"];
const emptyForm = { name: "", type: "", customType: "", maxMarks: "", weightage: "" };
type AssessmentForm = typeof emptyForm;

function assessmentDiagnostic(stage: string, details: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) console.info("[CAMS assessment]", stage, details);
}

function requestFailureDetails(reason: unknown) {
  const failure = reason as { code?: unknown; status?: unknown } | null;
  // Never log raw request objects, URLs, headers, credentials or student data.
  return { code: typeof failure?.code === "string" ? failure.code : undefined, status: typeof failure?.status === "number" ? failure.status : undefined };
}

export function AssessmentsTab({ offeringId, subjectCode }: { offeringId: string; subjectCode: string }) {
  const [carryMax, setCarryMax] = useState<number | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Assessment[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssessmentForm>(emptyForm);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState("");
  const [success, setSuccess] = useState("");
  const saveInFlight = useRef(false);

  const reload = async () => {
    const data = await loadAssessmentStructure(offeringId);
    setItems(data.assessments);
    setCarryMax(data.carryMax);
    setWeightInput(data.carryMax === null ? "" : String(data.carryMax));
  };
  useEffect(() => {
    setLoading(true); setError(""); setCarryMax(null); setWeightInput("");
    loadAssessmentStructure(offeringId)
      .then(settings => { setItems(settings.assessments); setCarryMax(settings.carryMax); setWeightInput(settings.carryMax === null ? "" : String(settings.carryMax)); })
      .catch(reason => setError(userError(reason, "Unable to load assessment settings."))).finally(() => setLoading(false));
  }, [offeringId]);
  const saveTotalWeight = async (event: React.FormEvent) => {
    event.preventDefault(); if (savingWeight || loading || saveInFlight.current || refreshWarning) return;
    setSavingWeight(true); setError("");
    try { await saveOfferingWeightage(offeringId, Number(weightInput)); setCarryMax(Number(weightInput)); }
    catch (reason) { setError(userError(reason, "Unable to save total weightage.")); }
    finally { setSavingWeight(false); }
  };

  const totalWeight = useMemo(() => items.reduce((sum, item) => sum + item.weightage, 0), [items]);
  const editingItem = items.find(item => item.id === editingId);
  const weightWithoutEditing = totalWeight - (editingItem?.weightage ?? 0);
  const prospectiveTotal = weightWithoutEditing + (Number(form.weightage) || 0);
  const remaining = Math.max(0, (carryMax ?? 0) - weightWithoutEditing);
  const componentType = (form.type === "Other" ? form.customType : form.type).trim();
  const formValid = form.name.trim().length > 0 && componentType.length > 0 && Number(form.maxMarks) > 0 && Number(form.weightage) > 0 && carryMax !== null && prospectiveTotal <= carryMax;

  const openAdd = () => { if (saveInFlight.current || refreshWarning) return; setError(""); setSuccess(""); setForm(emptyForm); setEditingId(null); setModal("add"); };
  const openEdit = (item: Assessment) => {
    if (saveInFlight.current || refreshWarning) return;
    setError(""); setSuccess("");
    const existingType = item.type.trim();
    const isPredefined = componentTypes.includes(existingType);
    setForm({ name: item.name, type: isPredefined ? existingType : "Other", customType: isPredefined ? "" : existingType, maxMarks: String(item.maxMarks), weightage: String(item.weightage) });
    setEditingId(item.id);
    setModal("edit");
  };
  const resetModal = () => { setModal(null); setEditingId(null); setForm(emptyForm); };
  const closeModal = () => { if (!saveInFlight.current) resetModal(); };

  const refreshSavedAssessment = async () => {
    const started = performance.now();
    assessmentDiagnostic("refresh started", { rpc: "get_my_subject_assessment_structure" });
    try {
      await reload();
      setRefreshWarning("");
      assessmentDiagnostic("refresh succeeded", { elapsedMs: Math.round(performance.now() - started) });
    } catch (reason) {
      setRefreshWarning("Assessment saved, but the latest data could not be refreshed. Please retry refreshing the list.");
      assessmentDiagnostic("refresh failed after confirmed save", { ...requestFailureDetails(reason), elapsedMs: Math.round(performance.now() - started) });
    }
  };

  const retryRefresh = async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true; setSavingAssessment(true);
    try { await refreshSavedAssessment(); }
    finally { saveInFlight.current = false; setSavingAssessment(false); }
  };

  const saveAssessment = async () => {
    if (!formValid || saveInFlight.current || refreshWarning) return;
    saveInFlight.current = true; setSavingAssessment(true);
    const values = { name: form.name.trim(), type: componentType, maxMarks: Number(form.maxMarks), weightage: Number(form.weightage) };
    const operation = editingId ? "edit" : "create";
    const started = performance.now();
    setError(""); setSuccess("");
    assessmentDiagnostic(`${operation} started`, { rpc: "mutate_my_subject_assessment_structure" });
    try {
      try {
        await persistAssessment(offeringId, values, editingId ?? undefined);
      } catch (reason) {
        assessmentDiagnostic(`${operation} request failed`, { ...requestFailureDetails(reason), elapsedMs: Math.round(performance.now() - started) });
        setError(userError(reason, "Unable to save assessment."));
        return;
      }
      // The mutation has committed. A later refresh must never relabel it as a
      // failed save or leave a populated Create dialog inviting another insert.
      assessmentDiagnostic(`${operation} succeeded`, { elapsedMs: Math.round(performance.now() - started), assessmentId: editingId ?? null, returnsAssessmentId: false });
      setSuccess("Assessment saved.");
      resetModal();
      assessmentDiagnostic("modal closed and form reset");
      await refreshSavedAssessment();
    } finally {
      saveInFlight.current = false; setSavingAssessment(false);
    }
  };

  const removeAssessment = async (item: Assessment) => {
    if (saveInFlight.current || refreshWarning) return;
    const confirmed = window.confirm(`Remove “${item.name}” from every class in this Subject Hub?\n\nThis shared assessment component and its configuration will be deleted. Components with student marks or released classes cannot be removed. This action cannot be undone.`);
    if (confirmed) try { await deleteAssessment(offeringId, item.id); await reload(); } catch (reason) { setError(userError(reason, "Unable to remove assessment.")); }
  };

  const mutationDisabled = savingAssessment || Boolean(refreshWarning);
  const weightSaveDisabled = loading || savingWeight || mutationDisabled || !weightInput || Number(weightInput) === carryMax;

  return (
    <div className={W.panel}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><h2 className={W.title}>Continuous Assessment Components</h2><p className={W.muted}>Set the total carry-mark weightage for this subject, then allocate it across assessments.</p></div>
        <button disabled={loading || carryMax === null || savingWeight || mutationDisabled} onClick={openAdd} className={W.primary + " shrink-0"}><Plus size={16} /> Add Assessment</button>
      </div>
      <form onSubmit={saveTotalWeight} className="mb-6">
        <label htmlFor="subject-carry-max" className={W.label}>Total Carry-Mark Weightage (%)</label>
        <div className="flex flex-wrap items-center gap-3"><input id="subject-carry-max" type="number" min="0.01" max="100" step="0.01" required value={weightInput} disabled={loading || savingWeight || mutationDisabled} onChange={event => setWeightInput(event.target.value)} placeholder="e.g. 60" className={W.field + " max-w-32"} /><button type="submit" disabled={weightSaveDisabled} className={W.primary}>{savingWeight ? "Saving…" : "Save Weightage"}</button></div>
      </form>
      {!loading && carryMax === null && <p className={W.muted + " mb-4"}>Enter and save the subject’s total weightage before adding assessments.</p>}
      {!modal && error && <p role="alert" className={W.error}>{error}</p>}
      {!modal && success && <p role="status" className="mb-4 text-sm font-medium text-emerald-700">{success}</p>}
      {refreshWarning && <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{refreshWarning}</p><button onClick={retryRefresh} disabled={savingAssessment} className={W.secondary + " mt-3"}>{savingAssessment ? "Refreshing…" : "Refresh assessments"}</button></div>}
      <progress aria-label="Total weightage allocated" max={100} value={carryMax ? Math.min(totalWeight / carryMax * 100, 100) : 0} className={"block h-2 w-full overflow-hidden rounded-full border-0 bg-slate-100 [&::-webkit-progress-bar]:bg-slate-100 " + (totalWeight === carryMax ? "accent-emerald-600 [&::-moz-progress-bar]:bg-emerald-600 [&::-webkit-progress-value]:bg-emerald-600" : totalWeight > (carryMax ?? 0) ? "accent-rose-600 [&::-moz-progress-bar]:bg-rose-600 [&::-webkit-progress-value]:bg-rose-600" : "accent-purple-900 [&::-moz-progress-bar]:bg-purple-900 [&::-webkit-progress-value]:bg-purple-900")} />
      <div className="staff-card-muted mb-6 mt-3 flex flex-wrap justify-between gap-2 text-sm text-slate-500 dark:text-slate-300"><span>Total weightage allocated</span><strong className={totalWeight === carryMax ? "text-emerald-700" : totalWeight > (carryMax ?? 0) ? "text-rose-700" : "staff-card-primary text-slate-700 dark:text-slate-200"}>{totalWeight}% / {carryMax === null ? "Not set" : `${carryMax}%`}</strong></div>
      <div className="overflow-x-auto">
        <table className={W.table + " min-w-[680px]"}><thead className={W.tableHead}><tr><th scope="col">Assessment Component</th><th scope="col">Type</th><th scope="col">Max Score</th><th scope="col">Weightage</th><th scope="col" className="text-right">Actions</th></tr></thead>
          <tbody>{items.map(item => <tr key={item.id} className={W.tableRow}><td className="staff-card-primary font-semibold text-slate-800 dark:text-slate-50">{item.name}</td><td>{item.type}</td><td>{item.maxMarks}</td><td className="font-semibold">{item.weightage}%</td><td><div className="flex justify-end gap-2"><button disabled={mutationDisabled} onClick={() => openEdit(item)} className={W.secondary + " px-3 text-xs"}><Edit3 size={15} /> Edit</button><button disabled={mutationDisabled} onClick={() => removeAssessment(item)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"><Trash2 size={15} /> Remove</button></div></td></tr>)}</tbody>
        </table>
        {items.length === 0 && <div className="py-10 text-center text-sm text-slate-500">No assessment components yet. Select Add Assessment to create one.</div>}
      </div>
      {modal && <div role="dialog" aria-modal="true" aria-labelledby="assessment-modal-title" className={W.overlay} onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}>
        <div className={W.modal}>
          <div className="mb-6 flex items-start justify-between gap-4"><div><h3 id="assessment-modal-title" className={W.title}>{modal === "add" ? "Add Assessment Component" : "Edit Assessment"}</h3><div className={W.muted}>{subjectCode}</div></div><button aria-label="Close" disabled={savingAssessment} onClick={closeModal} className={W.iconButton}><X size={21} /></button></div>
          <fieldset disabled={savingAssessment} className="min-w-0 space-y-4 border-0 p-0">
            <div><label htmlFor="component-name" className={W.label}>Component Name</label><input id="component-name" autoFocus value={form.name} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} placeholder="e.g. Quiz 3" className={W.field} /></div>
            <div><label htmlFor="component-type" className={W.label}>Component Type</label><select id="component-type" required value={form.type} onChange={event => setForm(previous => ({ ...previous, type: event.target.value }))} className={W.field}><option value="" disabled>Select component type</option>{[...componentTypes, "Other"].map(type => <option key={type} value={type}>{type}</option>)}</select></div>
            {form.type === "Other" && <div><label htmlFor="custom-component-type" className={W.label}>Custom Component Type</label><input id="custom-component-type" required value={form.customType} onChange={event => setForm(previous => ({ ...previous, customType: event.target.value }))} placeholder="Enter custom component type" className={W.field} /></div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label htmlFor="component-max-score" className={W.label}>Max Score</label><input id="component-max-score" type="number" min="1" value={form.maxMarks} onChange={event => setForm(previous => ({ ...previous, maxMarks: event.target.value }))} placeholder="e.g. 20" className={W.field} /></div><div><label htmlFor="component-weightage" className={W.label}>Weightage (%) — {remaining}% Left</label><input id="component-weightage" type="number" min="0.01" step="0.01" max={remaining} value={form.weightage} onChange={event => setForm(previous => ({ ...previous, weightage: event.target.value }))} placeholder={`Max ${remaining}`} className={W.field} /></div></div>
            <div className="flex justify-between gap-3 rounded-lg bg-purple-50 p-4 text-sm text-purple-900"><span>Total after save</span><strong className={prospectiveTotal > (carryMax ?? 0) ? "text-rose-700" : prospectiveTotal === carryMax ? "text-emerald-700" : "text-amber-800"}>{prospectiveTotal}% / {carryMax === null ? "Not set" : `${carryMax}%`}</strong></div>
          </fieldset>
          {error && <div role="alert" className={W.error}>{error}</div>}
          {prospectiveTotal > (carryMax ?? 0) && <div role="alert" className={W.error}>Weightage cannot exceed the remaining {remaining}%.</div>}
          <div className="mt-6 grid grid-cols-2 gap-3"><button disabled={savingAssessment} onClick={closeModal} className={W.secondary}>Cancel</button><button disabled={!formValid || savingAssessment || Boolean(refreshWarning)} aria-busy={savingAssessment} onClick={saveAssessment} className={W.primary}>{modal === "add" ? <Plus size={16} /> : <CheckCircle size={16} />}{savingAssessment ? "Saving…" : modal === "add" ? "Add Assessment" : "Save Changes"}</button></div>
        </div>
      </div>}
    </div>
  );
}
