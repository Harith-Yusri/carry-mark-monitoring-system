import type { SubjectSummary } from "./carryMarkApi";

export function groupLecturerSubjects(rows: SubjectSummary[]): SubjectSummary[] {
  const groups = new Map<string, SubjectSummary[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.academicYear, row.semesterNo, row.progSem, row.code]);
    const members = groups.get(key) ?? [];
    if (!members.some(member => member.offeringId === row.offeringId)) members.push(row);
    groups.set(key, members);
  }
  return [...groups.values()].map(members => {
    if (members.length === 1) return members[0];
    const programmes = new Map<string, { code: string; name: string }>();
    for (const member of members) member.programmeIds.forEach((id, index) => programmes.set(id, {
      code: member.programmeCodes[index], name: member.programmeNames[index],
    }));
    const sorted = [...programmes].sort((a, b) => a[1].code.localeCompare(b[1].code));
    return {
      ...members[0], offerings: members,
      programmeIds: sorted.map(([id]) => id), programmeCodes: sorted.map(([, p]) => p.code),
      programmeNames: sorted.map(([, p]) => p.name), programmeCode: sorted.map(([, p]) => p.code).join(", "),
      programmeName: sorted.map(([, p]) => p.name).join(", "),
      students: members.reduce((total, row) => total + row.students, 0),
      // Each RPC row already covers every class in this subject context.
      status: members.every(row => row.status === "submitted") ? "submitted" : "active",
      lastSync: members.map(row => row.lastSync).filter((date): date is string => !!date).sort((a,b) => Date.parse(b)-Date.parse(a))[0] ?? null,
    };
  });
}
