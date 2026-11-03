import React, { useState } from "react";
import { AdminStatus, useCardColors, useColors } from "./adminStyles";
import type { AdminRecordsViewProps } from "../../hooks/useAdminRecords";
import type { ClassTeachingAllocation } from "../../types";

function groupSubjects(allocations: ClassTeachingAllocation[], programmeId: string) {
  const subjects = new Map<string, string[]>();
  allocations.filter(allocation => allocation.programmeId === programmeId).forEach(allocation => {
    subjects.set(allocation.subjectCode, [...(subjects.get(allocation.subjectCode) ?? []), allocation.classLabel]);
  });
  return [...subjects].map(([code, classes]) => ({ code, classes }));
}

export function LecturerDirectory({ records, context, loading, error }: AdminRecordsViewProps) {
  const C = useColors();
  const CC = useCardColors();
  const [searchTerm, setSearchTerm] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const query = searchTerm.trim().toLowerCase();
  const filtered = records.filter(lecturer => {
    const matchesSearch = [lecturer.name, lecturer.id, lecturer.department, lecturer.programmeCodes.join(" "), lecturer.subjects.join(" "), lecturer.subjectName]
      .some(value => value.toLowerCase().includes(query));
    const matchesProgramme = !programmeId || lecturer.programmeAssignments.some(assignment => assignment.id === programmeId);
    return matchesSearch && matchesProgramme;
  });

  return (
    <div>
      <div className="responsive-action-header" style={{ marginBottom: "20px", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: C.brandText, fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, letterSpacing: ".1em", marginBottom: "7px" }}>Academic Staff</div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(1.5rem * var(--staff-text-scale))", color: C.text, margin: "0 0 4px" }}>Lecturer Directory</h1>
          <p style={{ fontSize: "calc(0.8125rem * var(--staff-text-scale))", color: C.textMuted, margin: 0 }}>Teaching allocation, workload and submission activity in one faculty register.</p>
        </div>
        <div style={{ color: C.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>{filtered.length} of {records.length} Records</div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
        <label style={{ display: "block", flex: "1 1 320px", maxWidth: "560px" }}>
          <span style={{ display: "block", color: C.textSub, fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, letterSpacing: ".06em", marginBottom: "6px" }}>Search Staff or Teaching Allocation</span>
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Name, staff ID, programme or subject"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.input, border: `1px solid ${C.borderMid}`, borderRadius: "4px", color: C.text, fontSize: "calc(0.8125rem * var(--staff-text-scale))", outline: "none" }}
          />
        </label>
        <label style={{ display: "block", flex: "0 1 300px", minWidth: "220px" }}>
          <span style={{ display: "block", color: C.textSub, fontSize: "calc(0.6875rem * var(--staff-text-scale))", fontWeight: 700, letterSpacing: ".06em", marginBottom: "6px" }}>Programme</span>
          <select
            aria-label="Filter lecturers by programme"
            value={programmeId}
            onChange={event => setProgrammeId(event.target.value)}
            disabled={loading}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: C.input, border: `1px solid ${C.borderMid}`, borderRadius: "4px", color: C.text, fontSize: "calc(0.8125rem * var(--staff-text-scale))", outline: "none", cursor: loading ? "default" : "pointer" }}
          >
            <option value="">All Programmes</option>
            {(context?.programmes ?? []).map(programme => (
              <option key={programme.id} value={programme.id}>{programme.code} — {programme.name}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p style={{ color: C.textMuted }}>Loading lecturers…</p>}
      {error && <p role="alert" style={{ color: C.red }}>{error}</p>}

      <div className="admin-table-panel"><div className="admin-table-scroll">
        <table className="admin-data-table" style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>
          <colgroup>
            <col style={{ width: "19%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              {["Lecturer", "Programmes Taught", "Teaching Allocations", "Workload", "Submission", "Last Activity"].map(label => (
                <th scope="col" key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(lecturer => {
              return (
                <tr key={lecturer.id}>
                  <td>
                    <div style={{ color: CC.text, fontWeight: 700, fontSize: "calc(0.8125rem * var(--staff-text-scale))" }}>{lecturer.name}</div>
                    <div className="admin-identifier" style={{ color: CC.textMuted, fontSize: "calc(0.75rem * var(--staff-text-scale))", marginTop: "4px" }}>{lecturer.id}</div>
                  </td>
                  <td>
                    <div
                      title={lecturer.programmeAssignments.map(assignment => `${assignment.code} — ${assignment.name}`).join("\n") || "No current teaching allocation"}
                      style={{ color: CC.code, fontWeight: 700 }}
                    >
                      {lecturer.programmeCodes.join(", ") || "—"}
                    </div>
                  </td>
                  <td>
                    {lecturer.programmeAssignments.length ? lecturer.programmeAssignments.map(assignment => (
                      <div key={assignment.id} style={{ marginBottom: "6px" }}>
                        <div style={{ color: CC.code, fontWeight: 700, marginBottom: "2px" }}>{assignment.code}</div>
                        {groupSubjects(lecturer.classAllocations, assignment.id).map(subject => (
                          <div key={subject.code} style={{ color: CC.text, lineHeight: 1.45 }}>
                            <span style={{ fontWeight: 600 }}>{subject.code}</span>
                            <span style={{ color: CC.textMuted }}> ({subject.classes.join(", ")})</span>
                          </div>
                        ))}
                      </div>
                    )) : <span style={{ color: CC.textMuted }}>No current teaching allocation</span>}
                  </td>
                  <td><span style={{ color: CC.text, fontWeight: 700 }}>{lecturer.studentCount}</span> students</td>
                  <td>
                    <AdminStatus status={lecturer.submissionStatus} />
                    <div style={{ color: CC.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))", marginTop: "4px" }}>{lecturer.completionRate}% complete</div>
                  </td>
                  <td>{lecturer.lastUpdated}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div style={{ padding: "24px 10px", borderBottom: `1px solid ${CC.borderMid}`, color: CC.textMuted, fontSize: "calc(0.8125rem * var(--staff-text-scale))" }}>No lecturer records match the selected search and programme filters.</div>}
      </div>
      </div>
    </div>
  );
}
