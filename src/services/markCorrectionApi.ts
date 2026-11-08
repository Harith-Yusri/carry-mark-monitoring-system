import { requireSupabase } from "../lib/supabase";

export type CorrectionStatus = "pending" | "approved" | "rejected" | "corrected" | "released";
export type Correction = {
  id: string; dispute_id: string; status: CorrectionStatus; reason: string;
  original_score: number; maximum_score: number; corrected_score: number | null;
  requested_at: string; reviewed_at: string | null; corrected_at: string | null; released_at: string | null;
  decision_note: string | null; editable?: boolean;
  snapshot: { student_name: string; student_number: string; subject_code: string; subject_name: string; class_label: string; assessment_name: string; lecturer_name: string; academic_year: string; semester_code: string };
  events: { action: string; created_at: string; actor_id: string; details: Record<string, unknown> }[];
};
export type MarkIssue = {
  id: string; status: "submitted" | "reviewing" | "resolved" | "rejected";
  explanation: string; created_at: string; response: string | null; student_name: string; student_number: string;
  assessment_name: string; class_label: string; current_score: number | null; maximum_score: number | null;
  can_correct: boolean; editable: boolean; released: boolean; corrections: Correction[];
};
export async function loadMarkIssues(offeringId: string) {
  const { data, error } = await requireSupabase().rpc("get_staff_mark_issues", { target_offering: offeringId });
  if (error) throw error;
  return data as unknown as MarkIssue[];
}
export async function loadCorrectionQueue() {
  const { data, error } = await requireSupabase().rpc("get_mark_correction_queue");
  if (error) throw error;
  return data as unknown as Correction[];
}
export async function loadCorrectionPendingCount() {
  const { data, error } = await requireSupabase().rpc("get_mark_correction_pending_count");
  if (error) throw error;
  return Number(data);
}
export async function respondToIssue(id: string, decision: string, response: string) {
  const { error } = await requireSupabase().rpc("respond_to_mark_issue", { target_issue: id, decision, lecturer_response: response.trim() });
  if (error) throw error;
}
export async function requestCorrection(id: string, reason: string) {
  const { error } = await requireSupabase().rpc("request_mark_correction", { target_issue: id, correction_reason: reason.trim() });
  if (error) throw error;
}
export async function reviewCorrection(id: string, approve: boolean, note: string) {
  const { error } = await requireSupabase().rpc("review_mark_correction", { target_request: id, approve, admin_note: note.trim() });
  if (error) throw error;
}
export async function saveCorrection(id: string, score: number) {
  const { error } = await requireSupabase().rpc("update_approved_mark", { target_request: id, new_score: score });
  if (error) throw error;
}
export async function releaseCorrection(id: string) {
  const { error } = await requireSupabase().rpc("release_corrected_mark", { target_request: id });
  if (error) throw error;
}
export function correctionError(reason: unknown, fallback = "Unable to complete this action. Refresh and try again.") {
  const message = (reason as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.startsWith("CAMS: ")) return message.slice(6);
  if (import.meta.env.DEV) console.error("[CAMS mark correction]", reason);
  return fallback;
}
