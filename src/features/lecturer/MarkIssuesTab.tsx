import React, { useCallback, useEffect, useRef, useState } from "react";
import { workspace as W } from "./workspaceStyles";
import { correctionError, loadMarkIssues, releaseCorrection, requestCorrection, respondToIssue, saveCorrection, type CorrectionStatus, type MarkIssue } from "../../services/markCorrectionApi";

export const correctionLabels: Record<CorrectionStatus, string> = {
  pending: "Awaiting Admin Approval", approved: "Correction Approved", rejected: "Correction Rejected",
  corrected: "Corrected · awaiting release", released: "Resolved · updated mark released",
};
export function MarkIssuesTab({ offeringId }: { offeringId: string }) {
  const [items, setItems] = useState<MarkIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, string>>({});
  const reload = useCallback(async () => { setItems(await loadMarkIssues(offeringId)); }, [offeringId]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    loadMarkIssues(offeringId).then(data => { if (active) setItems(data); })
      .catch(reason => { if (active) setError(correctionError(reason, "Unable to load mark issues.")); })
      .finally(() => { if (active) setLoading(false); });
    const onFocus = () => { if (!inFlight.current) void reload().catch(reason => setError(correctionError(reason))); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; window.removeEventListener("focus", onFocus); };
  }, [offeringId, reload]);
  const act = async (operation: () => Promise<unknown>, message: string) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await operation(); setNotice(message);
      try { await reload(); } catch { setError("Action saved, but the list could not be refreshed. Select Refresh before continuing."); }
    } catch (reason) { setError(correctionError(reason)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section className={W.panel}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className={W.title}>Mark Issues</h2><p className={W.muted}>Review reports across all classes. Released marks stay locked until an exact correction is approved.</p></div><button className={W.secondary} disabled={busy} onClick={() => void reload().then(() => setError("")).catch(reason => setError(correctionError(reason)))}>Refresh</button></div>
    {loading && <p role="status" className={W.muted}>Loading mark issues…</p>}
    {error && <p role="alert" className={W.error}>{error}</p>}{notice && <p role="status" className="mb-4 text-sm text-emerald-700">{notice}</p>}
    {!loading && !error && !items.length && <p className={W.muted}>No mark issues have been reported for this subject.</p>}
    <div className="space-y-5">{items.map(issue => {
      const request = issue.corrections[0];
      const active = request && ["pending", "approved", "corrected"].includes(request.status);
      const open = ["submitted", "reviewing"].includes(issue.status);
      const note = notes[issue.id] ?? "";
      return <article key={issue.id} className="staff-content-card rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="staff-card-title font-semibold">{issue.student_name} · {issue.student_number}</h3><p className={W.muted}>{issue.assessment_name} · {issue.class_label}</p><p className={W.muted}>{issue.released ? "Current Released mark" : "Current internal mark"}: {issue.current_score === null ? "Unavailable" : `${issue.current_score} / ${issue.maximum_score}`}</p></div><span className={request?.status === "rejected" ? W.danger : active ? W.pending : W.neutral}>{open && request ? correctionLabels[request.status] : issue.status === "resolved" ? "Resolved" : issue.status === "rejected" ? "Rejected" : "Submitted / Reviewing"}</span></div>
        <p className="staff-card-primary my-3 whitespace-pre-wrap text-sm">{issue.explanation}</p>
        <p className={W.muted}>Reported {new Date(issue.created_at).toLocaleString()}</p>
        {issue.response && <p className={W.muted}>Response: {issue.response}</p>}
        {!issue.editable && <p className={W.muted}>Previous semester · read-only</p>}
        {issue.editable && open && !active && <div className="mt-4 space-y-3">
          <label className={W.label} htmlFor={`issue-note-${issue.id}`}>Response / correction reason</label>
          <textarea id={`issue-note-${issue.id}`} maxLength={2000} className={W.field} value={note} onChange={event => setNotes(previous => ({ ...previous, [issue.id]: event.target.value }))} />
          <div className="flex flex-wrap gap-2">
            {[['reviewing', 'Mark as Reviewing'], ['resolved', 'Resolve'], ['rejected', 'Reject']].map(([decision, label]) => <button key={decision} className={W.secondary} disabled={busy || !note.trim()} onClick={() => { if (window.confirm(`${label} this report? This does not change any marks.`)) void act(() => respondToIssue(issue.id, decision, note), "Report response saved."); }}>{label}</button>)}
            <button className={W.primary} disabled={busy || !note.trim() || !issue.can_correct} onClick={() => { if (window.confirm("Request Admin approval to correct only this student's assessment mark?")) void act(() => requestCorrection(issue.id, note), "Correction request submitted to Admin."); }}>Request Mark Correction</button>
          </div>
          {!issue.can_correct && <p className={W.muted}>Correction requires a Released mark and unambiguous student/class/assessment links.</p>}
        </div>}
        {request && <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <p className={W.muted}>{correctionLabels[request.status]} · Original: {request.original_score} / {request.maximum_score}</p>
          <p className={W.muted}>Reason: {request.reason}</p>
          {request.decision_note && <p className={W.muted}>Admin decision: {request.decision_note}</p>}
          {issue.editable && request.status === "approved" && <div className="flex flex-wrap items-end gap-3">
            <label className={W.label}>Corrected mark<input aria-label={`Corrected mark for ${issue.student_number} ${issue.assessment_name}`} className={W.field + " mt-2 max-w-40"} type="number" min="0" max={request.maximum_score} step="0.01" value={scores[request.id] ?? ""} onChange={event => setScores(previous => ({ ...previous, [request.id]: event.target.value }))} /></label>
            <button className={W.primary} disabled={busy || (scores[request.id] ?? "").trim() === "" || !Number.isFinite(Number(scores[request.id])) || Number(scores[request.id]) < 0 || Number(scores[request.id]) > request.maximum_score} onClick={() => void act(() => saveCorrection(request.id, Number(scores[request.id])), "Correction saved as draft. The student still sees the previous Released mark.")}>Save Correction</button>
          </div>}
          {request.corrected_score !== null && <p className={W.muted}>Corrected mark: {request.corrected_score} / {request.maximum_score}{request.status === "corrected" ? " · not yet released" : ""}</p>}
          {issue.editable && request.status === "corrected" && <button className={W.primary} disabled={busy} onClick={() => { if (window.confirm("Release this updated mark to the student? It will lock again and generate a mark-release notification.")) void act(() => releaseCorrection(request.id), "Updated mark released. This mark is locked again."); }}>Release Updated Mark</button>}
          <details><summary className={W.muted}>Correction history ({issue.corrections.length})</summary>{issue.corrections.map(history => <div key={history.id} className="mt-3 text-sm"><p>{correctionLabels[history.status]} · {new Date(history.requested_at).toLocaleString()}</p>{history.events.map((event, i) => <p key={i} className={W.muted}>{event.action} · {new Date(event.created_at).toLocaleString()}</p>)}</div>)}</details>
        </div>}
      </article>;
    })}</div>
  </section>;
}
