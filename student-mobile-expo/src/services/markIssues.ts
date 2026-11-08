import { supabase } from "@/lib/supabase";
import { recordAuthActivity } from "@/lib/authStorage";

export type MarkIssueOption = { assessment_id: string; enrolment_id: string; name: string; class_label: string };
export type StudentMarkIssue = {
  id: string; assessment_name: string; class_label: string | null; explanation: string; created_at: string;
  status: "submitted" | "reviewing" | "resolved" | "rejected";
  correction_status: "pending" | "approved" | "rejected" | "corrected" | "released" | null;
  response: string | null;
};
export type MarkIssueWorkspace = { request_key: string; options: MarkIssueOption[]; issues: StudentMarkIssue[] };

export async function loadMyMarkIssues(offeringId: string): Promise<MarkIssueWorkspace> {
  const { data, error } = await supabase.rpc("get_my_mark_issue_workspace", { target_offering: offeringId });
  if (error) throw error;
  return data as MarkIssueWorkspace;
}
export async function submitStudentMarkIssue(enrolmentId: string, assessmentId: string, explanation: string, requestKey: string) {
  const { data, error } = await supabase.rpc("submit_student_mark_issue", {
    target_enrolment: enrolmentId, target_assessment: assessmentId, explanation: explanation.trim(), request_key: requestKey,
  });
  if (error) throw error;
  // A local activity timestamp failure must never turn a committed report into
  // a failed submission or encourage the student to create it twice.
  void recordAuthActivity().catch(() => {
    if (__DEV__) console.warn("[CAMS mark issues] Report saved; local activity timestamp unavailable.");
  });
  return data as string;
}
export function markIssueStatus(issue: StudentMarkIssue) {
  if (issue.status === "resolved") return "Resolved";
  if (issue.status === "rejected") return "Rejected";
  if (issue.correction_status) return {
    pending: "Correction Requested", approved: "Correction Approved", rejected: "Correction Rejected",
    corrected: "Corrected · awaiting release", released: "Resolved",
  }[issue.correction_status];
  return issue.status === "reviewing" ? "Reviewing" : "Submitted";
}
export function markIssueError(reason: unknown) {
  const message = (reason as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.startsWith("CAMS: ")) return message.slice(6);
  if (__DEV__) console.warn("[CAMS mark issues]", reason instanceof Error ? reason.message : (reason as { code?: unknown } | null)?.code);
  return "Unable to complete the mark issue request. Please check your connection and try again.";
}
