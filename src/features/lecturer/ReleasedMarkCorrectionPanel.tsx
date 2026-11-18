import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { LoadingState, RefreshStatus } from "../../components/StaffDataState";
import { correctionError, loadReleasedMarkCorrection, releaseCorrection, saveReleasedMarkCorrection, type ReleasedMarkContext, type ReleasedMarkTarget } from "../../services/markCorrectionApi";
import { workspace as W } from "./workspaceStyles";

export function ReleasedMarkCorrectionPanel({ target, onClose, onReleased }: {
  target: ReleasedMarkTarget; onClose: () => void; onReleased: () => Promise<void>;
}) {
  const [context, setContext] = useState<ReleasedMarkContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [released, setReleased] = useState(false);
  const flight = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setContext(await loadReleasedMarkCorrection(target)); }
    catch (error) { setError(correctionError(error, "Unable to load this Released mark. Try again.")); }
    finally { setLoading(false); }
  }, [target.sectionId, target.enrolmentId, target.assessmentId]);
  useEffect(() => {
    let active = true;
    loadReleasedMarkCorrection(target).then(value => { if (active) setContext(value); })
      .catch(error => { if (active) setError(correctionError(error, "Unable to load this Released mark. Try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [target.sectionId, target.enrolmentId, target.assessmentId]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  const draft = context?.correction?.status === "corrected" ? context.correction : null;
  const value = Number(score);
  const valid = Boolean(context) && score.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= context!.maximum_score
    && value !== context!.current_score && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8 && reason.trim().length > 0;
  const save = async () => {
    if (!context || !valid || draft || flight.current) return;
    flight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      setContext(await saveReleasedMarkCorrection(context, value, reason));
      setNotice("Correction saved privately. The student still sees the previous Released mark until you select Release Updated Mark.");
    } catch (error) { setError(correctionError(error)); }
    finally { flight.current = false; setBusy(false); }
  };
  const release = async () => {
    if (!draft || released || flight.current || !window.confirm("Release this updated mark to this student? Only this assessment mark will change; the class stays Released.")) return;
    flight.current = true; setBusy(true); setError("");
    try {
      await releaseCorrection(draft.id);
      setReleased(true); setContext(previous => previous ? { ...previous, history: previous.history.map(row => row.id === draft.id ? { ...row, status: "released" } : row) } : previous); setNotice("Updated mark released. The class remains Released and all normal mark inputs remain locked.");
      try { await onReleased(); }
      catch { setError("The mark was released, but the grid could not be refreshed. Close this panel and refresh the class before continuing."); }
    } catch (error) { setError(correctionError(error)); }
    finally { flight.current = false; setBusy(false); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="released-mark-correction-title" className={W.overlay} onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
    if (event.key === "Tab") {
      const fields = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]') ?? []);
      const first = fields[0], last = fields[fields.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    }
  }}><div ref={panel} tabIndex={-1} className={W.modal + " space-y-4"}>
    <div className="flex items-start justify-between gap-3"><h2 id="released-mark-correction-title" className={W.title}>Edit Released Mark</h2><button type="button" aria-label="Close correction" disabled={busy} onClick={onClose} className={W.iconButton}><X size={20} /></button></div>
    {loading && (context ? <RefreshStatus label="Refreshing correction…" /> : <LoadingState label="Loading the selected Released mark…" />)}
    {error && <p role="alert" className={W.error}>{error}</p>}
    {!context && !loading && <button className={W.secondary} onClick={() => void reload()}>Try again</button>}
    {notice && <p role="status" className={W.muted}>{notice}</p>}
    {context && <>
      <dl className="space-y-2 text-sm"><div><dt className={W.muted}>Student</dt><dd className="staff-card-title font-semibold">{context.student_name} · {context.student_number}</dd></div>
        <div><dt className={W.muted}>Subject / Class</dt><dd>{context.subject_code} · {context.class_label}</dd></div>
        <div><dt className={W.muted}>Assessment</dt><dd>{context.assessment_name}</dd></div>
        <div><dt className={W.muted}>{released ? "Updated Released score" : "Current Released score"}</dt><dd>{released ? draft?.corrected_score : context.current_score} / {context.maximum_score}</dd></div></dl>
      <p className={W.muted}>{context.correction?.dispute_id ? "This correction is linked to the student's mark issue." : "Lecturer-initiated correction for this student and assessment only."} Save Correction does not publish the new score.</p>
      <label className={W.label} htmlFor="released-correction-score">Corrected score (maximum {context.maximum_score})</label>
      <input id="released-correction-score" type="number" min="0" max={context.maximum_score} step="0.01" value={draft ? draft.corrected_score ?? "" : score} disabled={busy || loading || Boolean(context.correction) || released} onChange={event => setScore(event.target.value)} className={W.field} />
      <label className={W.label} htmlFor="released-correction-reason">Correction reason (required)</label>
      <textarea id="released-correction-reason" maxLength={2000} value={draft ? draft.reason : reason} disabled={busy || loading || Boolean(context.correction) || released} onChange={event => setReason(event.target.value)} className={W.field} />
      {error && !released && <button className={W.secondary} disabled={busy || loading} onClick={() => void reload()}>Refresh correction</button>}
      {context.correction && !draft && !released && <p className={W.muted}>A correction is already linked to this mark. Continue it in Mark Issues.</p>}
      {draft && !released && <p className={W.muted}>Saved correction: {draft.corrected_score} / {context.maximum_score} · private until released. You can close this panel and return to release it later.</p>}
      <div className="flex flex-wrap gap-3"><button className={W.secondary} disabled={busy || loading || !valid || Boolean(context.correction) || released} onClick={() => void save()}>Save Correction</button>
        <button className={W.primary} disabled={busy || loading || !draft || released} onClick={() => void release()}>Release Updated Mark</button></div>
      {context.history.length > 0 && <details><summary className={W.muted}>Correction history</summary>{context.history.map(row => <div key={row.id} className="my-3 space-y-1 text-sm"><p>{row.original_score} → {row.corrected_score} · {row.status === "released" ? "Released" : row.status === "corrected" ? "Awaiting release" : row.status}</p><p>{row.reason}</p><p className={W.muted}>{row.snapshot.lecturer_name} · {row.initiation_source === "lecturer" ? "Lecturer-initiated" : "Student issue"} · {new Date(row.requested_at).toLocaleString()}{row.released_at ? ` · Released ${new Date(row.released_at).toLocaleString()}` : ""}</p></div>)}</details>}
    </>}
  </div></div>;
}
