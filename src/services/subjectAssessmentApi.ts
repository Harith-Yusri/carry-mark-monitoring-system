import { requireSupabase } from "../lib/supabase";
import type { AssessmentRecord } from "./carryMarkApi";

// The server derives the whole Hub from the owned offering, never a client list
// of programme IDs. Legacy assessment IDs remain available to class marks queries.
export async function loadAssessmentStructure(offeringId: string): Promise<{ carryMax: number | null; assessments: AssessmentRecord[] }> {
  const { data, error } = await requireSupabase().rpc("get_my_subject_assessment_structure", { target_offering: offeringId });
  if (error) throw error;
  return data as unknown as { carryMax: number | null; assessments: AssessmentRecord[] };
}

export async function saveOfferingWeightage(offeringId: string, total: number) {
  const { error } = await requireSupabase().rpc("mutate_my_subject_assessment_structure", {
    target_offering: offeringId, operation: "weightage", total_weight: total,
  });
  if (error) throw error;
}

export async function saveAssessment(offeringId: string, item: Omit<AssessmentRecord, "id" | "position">, id?: string) {
  const { error } = await requireSupabase().rpc("mutate_my_subject_assessment_structure", {
    target_offering: offeringId, operation: id ? "edit" : "create", target_assessment: id ?? undefined,
    component_name: item.name, component_type: item.type, maximum_score: item.maxMarks, component_weight: item.weightage,
  });
  if (error) throw error;
}

export async function deleteAssessment(offeringId: string, id: string) {
  const { error } = await requireSupabase().rpc("mutate_my_subject_assessment_structure", {
    target_offering: offeringId, operation: "delete", target_assessment: id,
  });
  if (error) throw error;
}
