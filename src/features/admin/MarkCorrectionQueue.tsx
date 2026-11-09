import { InitialDataState, RefreshStatus } from "../../components/StaffDataState";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { workspace as W } from "../lecturer/workspaceStyles";
import { correctionError, loadCorrectionQueue, reviewCorrection, type Correction } from "../../services/markCorrectionApi";

const labels = { pending: "Pending Approval", approved: "Approved for Correction", rejected: "Rejected", corrected: "Corrected · awaiting release", released: "Completed · Released" };
export function MarkCorrectionQueue({ onChanged }: { onChanged: (knownCount?: number) => void }) {
  const [listData, setItems] = useState<Correction[] | null>(null);
  const items = listData ?? [];
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const guard = useRef(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await loadCorrectionQueue(); setItems(data); setError(""); onChanged(data.filter(item => item.status === "pending" && item.editable).length); }
    finally { setLoading(false); }
  }, [onChanged]);
  useEffect(() => { void reload().catch(reason => setError(correctionError(reason))).finally(() => setLoading(false));
    const focus = () => { if (!guard.current) void reload().catch(reason => setError(correctionError(reason))); };
    window.addEventListener("focus", focus); return () => window.removeEventListener("focus", focus);
  }, [reload]);
  const review = async (request: Correction, approve: boolean) => {
    if (guard.current || !window.confirm(`${approve ? "Approve" : "Reject"} correction for ${request.snapshot.student_number}, ${request.snapshot.assessment_name}? Approval grants a single-cell draft correction and does not change the mark.`)) return;
    guard.current = true; setBusy(true); setError("");
    try {
      await reviewCorrection(request.id, approve, notes[request.id] ?? "");
      try { await reload(); } catch { onChanged(); setError("Decision saved, but the queue could not be refreshed. Select Refresh."); }
    } catch (reason) { setError(correctionError(reason)); }
    finally { guard.current = false; setBusy(false); }
  };
  if (listData === null) return <InitialDataState title="Mark Correction Requests" label="Loading correction requests…" error={error} layout="table" onRetry={() => void reload().catch(reason => setError(correctionError(reason)))} />;

  return <section className={W.panel}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className={W.title}>Mark Correction Requests</h1><p className={W.muted}>Each approval applies to one student and one assessment. Released classes remain locked.</p></div><button disabled={busy} className={W.secondary} onClick={() => void reload().catch(reason => setError(correctionError(reason)))}>Refresh</button></div>
    {loading && <RefreshStatus label="Refreshing correction requests…" />}{error && <p role="alert" className={W.error}>{error}</p>}
    {!items.length && !error && <p className={W.muted}>No mark correction requests.</p>}
    <div className="space-y-4">{items.map(request => <article key={request.id} className="staff-content-card rounded-xl border border-slate-200 p-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="staff-card-title font-semibold">{request.snapshot.student_name} · {request.snapshot.student_number}</h2><span className={request.status === "pending" || request.status === "corrected" ? W.pending : request.status === "rejected" ? W.danger : W.success}>{labels[request.status]}</span></div>
      <p className={W.muted}>{request.snapshot.subject_code} · {request.snapshot.subject_name} · {request.snapshot.class_label}</p>
      <p className={W.muted}>Lecturer: {request.snapshot.lecturer_name} · Semester {request.snapshot.semester_code} · {request.snapshot.academic_year}</p>
      <p className="staff-card-primary my-2 text-sm font-semibold">{request.snapshot.assessment_name} · Original mark: {request.original_score} / {request.maximum_score}</p>
      <p className="staff-card-primary whitespace-pre-wrap text-sm">{request.reason}</p>
      <p className={W.muted}>Requested {new Date(request.requested_at).toLocaleString()}</p>
      {request.decision_note && <p className={W.muted}>Decision note: {request.decision_note}</p>}
      {request.corrected_score !== null && <p className={W.muted}>Corrected mark: {request.corrected_score} / {request.maximum_score}</p>}
      {request.status === "pending" && request.editable && <div className="mt-4 space-y-3"><label className={W.label}>Admin note (optional)<textarea maxLength={2000} value={notes[request.id] ?? ""} className={W.field + " mt-2"} onChange={event => setNotes(previous => ({ ...previous, [request.id]: event.target.value }))} /></label><div className="flex flex-wrap gap-3"><button disabled={busy} className={W.primary} onClick={() => void review(request, true)}>Approve</button><button disabled={busy} className={W.secondary} onClick={() => void review(request, false)}>Reject</button></div></div>}
      {request.editable && ["approved", "corrected"].includes(request.status) && <div className="mt-4 space-y-3"><label className={W.label}>Revocation note<textarea maxLength={2000} className={W.field + " mt-2"} value={notes[request.id] ?? ""} onChange={event => setNotes(previous => ({ ...previous, [request.id]: event.target.value }))} /></label><button className={W.secondary} disabled={busy || !(notes[request.id] ?? "").trim()} onClick={() => void review(request, false)}>Revoke unused correction approval</button></div>}
      {!request.editable && <p className={W.muted}>Previous semester · read-only</p>}
      <details className="mt-3"><summary className={W.muted}>Audit history</summary>{request.events.map((event, i) => <p key={i} className={W.muted}>{event.action} · {new Date(event.created_at).toLocaleString()} · actor {event.actor_id}</p>)}</details>
    </article>)}</div>
  </section>;
}
