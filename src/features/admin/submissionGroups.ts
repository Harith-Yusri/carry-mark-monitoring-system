import type { SubmissionAllocation } from "../../hooks/useAdminRecords";

export function groupSubmissionRows(rows: SubmissionAllocation[]) {
  const groups = new Map<string, { staffId: string; lecturerName: string; classes: SubmissionAllocation[] }>();
  for (const row of rows) {
    let group = groups.get(row.staffId);
    if (!group) {
      group = { staffId: row.staffId, lecturerName: row.lecturerName, classes: [] };
      groups.set(row.staffId, group);
    }
    group.classes.push(row);
  }
  return [...groups.values()].map(group => {
    const finalised = group.classes.filter(row => row.submissionStatus === "Finalised").length;
    const attention = group.classes.length - finalised;
    const status = attention === 0 ? "Finalised" : finalised > 0 ? "Partially Finalised" : "Action Required";
    return { ...group, finalised, attention, status };
  });
}
