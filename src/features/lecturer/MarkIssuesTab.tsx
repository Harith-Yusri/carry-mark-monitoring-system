import { InitialDataState, RefreshStatus } from "../../components/StaffDataState";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { workspace as W } from "./workspaceStyles";
import { correctionError, loadMarkIssues, releaseCorrection, correctIssue, respondToIssue, type CorrectionStatus, type MarkIssue } from "../../services/markCorrectionApi";

// Old approval states are historical data, not steps in the current workflow.
export const correctionLabels: Record<CorrectionStatus, string> = {
  pending: "Submitted", approved: "Submitted", rejected: "Closed correction",
  corrected: "Awaiting updated mark release", released: "Corrected",
};
export function MarkIssuesTab({ offeringId, focusedIssueId, onChanged }: { offeringId: string; focusedIssueId?: string; onChanged?: () => void }) {
  const [listData, setItems] = useState<MarkIssue[] | null>(null);
  const items = listData ?? [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, string>>({});
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (focused.current === focusedIssueId || !focusedIssueId || !listData) return;
    const item = document.getElementById(`mark-issue-${focusedIssueId}`);
    if (item) { focused.current = focusedIssueId; item.focus({ preventScroll: true }); item.scrollIntoView({ block: "center", behavior: "instant" }); }
  }, [focusedIssueId, listData]);
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await loadMarkIssues(offeringId)); }
    finally { setLoading(false); }
  }, [offeringId]);
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
      await operation(); onChanged?.(); setNotice(message);
      try { await reload(); } catch { setError("Action saved, but the list could not be refreshed. Select Refresh before continuing."); }
    } catch (reason) { setError(correctionError(reason)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  if (listData === null) return <InitialDataState title="Mark Issues" label="Loading mark issues…" error={error} layout="table" onRetry={() => void reload().catch(reason => setError(correctionError(reason)))} />;

  return <section className={W.panel}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className={W.title}>Mark Issues</h2><p className={W.muted}>Review each report, then Reject or Correct Mark. Corrections stay private until you release the updated mark.</p></div><button className={W.secondary} disabled={busy || loading} onClick={() => void reload().catch(reason => setError(correctionError(reason)))}>Refresh</button></div>
    {loading && <RefreshStatus label="Refreshing mark issues…" />}
    {error && <p role="alert" className={W.error}>{error}</p>}{notice && <p role="status" className="mb-4 text-sm text-emerald-700">{notice}</p>}
    {!error && !items.length && <p className={W.muted}>No mark issues have been reported for this subject.</p>}
    {focusedIssueId && !loading && !error && !items.some(issue => issue.id === focusedIssueId) && <p role="status" className={W.muted}>The linked report is unavailable. Refresh to load the latest issues.</p>}
    <div className="space-y-5">{items.map(issue => {
      const request = issue.corrections[0];
      const draft = request?.status === "corrected";
      const open = ["submitted", "reviewing"].includes(issue.status);
      const note = notes[issue.id] ?? "";
      const scoreText = scores[issue.id] ?? "";
      const score = Number(scoreText);
      const validScore = scoreText.trim() !== "" && Number.isFinite(score) && score >= 0 && issue.maximum_score !== null && score <= issue.maximum_score && Math.abs(score * 100 - Math.round(score * 100)) < 1e-8 && score !== issue.current_score;
      const status = issue.status === "rejected" ? "Rejected" : issue.status === "resolved" ? request?.status === "released" ? "Corrected" : "Closed" : draft ? correctionLabels.corrected : "Submitted";
      return <article id={`mark-issue-${issue.id}`} tabIndex={-1} aria-label={`${issue.student_name} · ${issue.assessment_name} mark issue`} key={issue.id} className={"staff-content-card scroll-mt-32 rounded-xl border border-slate-200 p-5 " + (issue.id === focusedIssueId ? "ring-2 ring-purple-500" : "")}>
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="staff-card-title font-semibold">{issue.student_name} · {issue.student_number}</h3><p className={W.muted}>{issue.assessment_name} · {issue.class_label}</p><p className={W.muted}>{issue.released ? "Current Released mark" : "Current internal mark"}: {issue.current_score === null ? "Unavailable" : `${issue.current_score} / ${issue.maximum_score}`}</p></div><span className={issue.status === "rejected" ? W.danger : open ? W.pending : W.neutral}>{status}</span></div>
        <p className="staff-card-primary my-3 whitespace-pre-wrap text-sm">{issue.explanation}</p>
        <p className={W.muted}>Reported {new Date(issue.created_at).toLocaleString()}</p>
        {issue.response && <p className={W.muted}>Lecturer response: {issue.response}</p>}
        {!issue.editable && <p className={W.muted}>Previous semester · read-only</p>}
        {issue.editable && open && <div className="mt-4 space-y-3">
          <label className={W.label} htmlFor={`issue-note-${issue.id}`}>{draft ? "Response if rejecting this report" : "Response / correction reason (required)"}</label>
          <textarea id={`issue-note-${issue.id}`} maxLength={2000} className={W.field} disabled={busy || loading} value={note} onChange={event => setNotes(previous => ({ ...previous, [issue.id]: event.target.value }))} />
          {!draft && issue.can_correct && <label className={W.label}>Corrected mark for {issue.student_number} · {issue.assessment_name}<input aria-label={`Corrected mark for ${issue.student_number} ${issue.assessment_name}`} className={W.field + " mt-2 max-w-40"} type="number" min="0" max={issue.maximum_score ?? undefined} step="0.01" disabled={busy || loading} value={scoreText} onChange={event => setScores(previous => ({ ...previous, [issue.id]: event.target.value }))} /></label>}
          <div className="flex flex-wrap gap-2">
            <button className={W.secondary} disabled={busy || loading || !note.trim()} onClick={() => { if (window.confirm("Reject this report with your response? The released mark will remain unchanged.")) void act(() => respondToIssue(issue.id, "rejected", note), "Report rejected. The student can read your response."); }}>Reject</button>
            {!draft && <button className={W.primary} disabled={busy || loading || !note.trim() || !issue.can_correct || !validScore} onClick={() => void act(() => correctIssue(issue.id, score, note), "Correction saved privately. Select Release Updated Mark to publish it to the student.")}>Correct Mark</button>}
          </div>
          {!issue.can_correct && <p className={W.muted}>Correction requires a Released mark and unambiguous student/class/assessment links.</p>}
        </div>}
        {request && <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <p className={W.muted}>Original mark: {request.original_score} / {request.maximum_score}</p>
          <p className={W.muted}>Correction reason: {request.reason}</p>
          {request.corrected_score !== null && <p className={W.muted}>Corrected mark: {request.corrected_score} / {request.maximum_score}{draft ? " · private until released" : ""}</p>}
          {issue.editable && open && draft && <button className={W.primary} disabled={busy || loading} onClick={() => { if (window.confirm("Release this exact updated mark to the student and close the report as corrected?")) void act(() => releaseCorrection(request.id), "Updated mark released. The report is closed as corrected."); }}>Release Updated Mark</button>}
        </div>}
        {(issue.corrections.length > 0 || (issue.events?.length ?? 0) > 0) && <details className="mt-4"><summary className={W.muted}>Issue history</summary>
          {issue.events?.map((event, i) => <p key={`issue-${i}`} className={W.muted}>{event.action} · {new Date(event.created_at).toLocaleString()}</p>)}
          {issue.corrections.map(history => <div key={history.id} className="mt-3 text-sm"><p>{correctionLabels[history.status]} · {history.original_score} → {history.corrected_score ?? "—"} · {history.snapshot.lecturer_name} · {history.reason}</p>{history.events.map((event, i) => <p key={i} className={W.muted}>{event.action} · {new Date(event.created_at).toLocaleString()}</p>)}</div>)}
        </details>}
      </article>;
    })}</div>
  </section>;
}
