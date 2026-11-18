import { requireSupabase } from "../lib/supabase";

export type CorrectionStatus = "pending" | "approved" | "rejected" | "corrected" | "released";
export type Correction = {
  id: string; dispute_id: string | null; initiation_source?: "student_issue" | "lecturer"; status: CorrectionStatus; reason: string;
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
  events?: Correction["events"]; responded_by?: string | null; responded_at?: string | null;
  can_correct: boolean; editable: boolean; released: boolean; corrections: Correction[];
};
export async function loadMarkIssues(offeringId: string) {
  const { data, error } = await requireSupabase().rpc("get_staff_mark_issues", { target_offering: offeringId });
  if (error) throw error;
  return data as unknown as MarkIssue[];
}
export async function respondToIssue(id: string, decision: "rejected", response: string) {
  const { error } = await requireSupabase().rpc("respond_to_mark_issue", { target_issue: id, decision, lecturer_response: response.trim() });
  if (error) throw error;
}
export async function correctIssue(id: string, score: number, reason: string) {
  const { error } = await requireSupabase().rpc("stage_mark_issue_correction", { target_issue: id, new_score: score, correction_reason: reason.trim() });
  if (error) throw error;
}
export async function releaseCorrection(id: string) {
  const { error } = await requireSupabase().rpc("release_corrected_mark", { target_request: id });
  if (error) throw error;
}
export type ReleasedMarkTarget = { sectionId: string; enrolmentId: string; assessmentId: string };
export type CellCorrection = Pick<Correction, "id" | "dispute_id" | "initiation_source" | "status" | "reason" | "original_score" | "corrected_score" | "requested_at" | "corrected_at" | "released_at" | "snapshot">;
export type ReleasedMarkContext = {
  section_id: string; enrolment_id: string; assessment_id: string; mark_id: string; version: number;
  current_score: number; maximum_score: number; student_name: string; student_number: string;
  subject_code: string; class_label: string; assessment_name: string;
  correction: CellCorrection | null; history: CellCorrection[];
};
export async function loadReleasedMarkCorrection(target: ReleasedMarkTarget): Promise<ReleasedMarkContext> {
  const { data, error } = await requireSupabase().rpc("get_released_mark_correction_context", {
    target_section: target.sectionId, target_enrolment: target.enrolmentId, target_assessment: target.assessmentId,
  });
  if (error) throw error;
  return data as unknown as ReleasedMarkContext;
}
export async function saveReleasedMarkCorrection(context: ReleasedMarkContext, score: number, reason: string): Promise<ReleasedMarkContext> {
  const { data, error } = await requireSupabase().rpc("stage_released_mark_correction", {
    target_section: context.section_id, target_enrolment: context.enrolment_id, target_assessment: context.assessment_id,
    expected_version: context.version, new_score: score, correction_reason: reason.trim(),
  });
  if (error) throw error;
  return data as unknown as ReleasedMarkContext;
}
export function correctionError(reason: unknown, fallback = "Unable to complete this action. Refresh and try again.") {
  const message = (reason as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.startsWith("CAMS: ")) return message.slice(6);
  if (import.meta.env.DEV) console.error("[CAMS mark correction]", reason);
  return fallback;
}
