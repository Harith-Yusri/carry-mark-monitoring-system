import React, { useState } from "react";
import { useColors } from "../../context/DarkModeContext";
import { useAdminRecords } from "../../hooks/useAdminRecords";

export function LecturerDirectory() {
  const C = useColors();
  const { records, context, loading, error } = useAdminRecords();
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
          <div style={{ color: C.maroon, fontFamily: C.mono, fontSize: "10px", fontWeight: 700, letterSpacing: ".1em", marginBottom: "7px" }}>ACADEMIC STAFF</div>
          <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "24px", color: C.text, margin: "0 0 4px" }}>Lecturer Directory</h1>
          <p style={{ fontSize: "12px", color: C.textMuted, margin: 0 }}>Teaching allocation, workload and submission activity in one faculty register.</p>
        </div>
        <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>{filtered.length} OF {records.length} RECORDS</div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
        <label style={{ display: "block", flex: "1 1 320px", maxWidth: "560px" }}>
          <span style={{ display: "block", color: C.textSub, fontFamily: C.mono, fontSize: "9px", fontWeight: 700, letterSpacing: ".06em", marginBottom: "6px" }}>SEARCH STAFF OR TEACHING ALLOCATION</span>
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Name, staff ID, programme or subject"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "4px", color: C.text, fontSize: "12px", outline: "none" }}
          />
        </label>
        <label style={{ display: "block", flex: "0 1 300px", minWidth: "220px" }}>
          <span style={{ display: "block", color: C.textSub, fontFamily: C.mono, fontSize: "9px", fontWeight: 700, letterSpacing: ".06em", marginBottom: "6px" }}>PROGRAMME</span>
          <select
            aria-label="Filter lecturers by programme"
            value={programmeId}
            onChange={event => setProgrammeId(event.target.value)}
            disabled={loading}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "4px", color: C.text, fontSize: "12px", outline: "none", cursor: loading ? "default" : "pointer" }}
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

      <div className="directory-table">
        <table style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ borderTop: `2px solid ${C.maroon}`, borderBottom: `1px solid ${C.borderMid}` }}>
              {["Lecturer", "Programme", "Teaching allocation", "Workload", "Submission", "Last activity"].map(label => (
                <th key={label} style={{ padding: "10px", textAlign: "left", color: C.textMuted, fontFamily: C.mono, fontSize: "9px", letterSpacing: ".06em", fontWeight: 700 }}>{label.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(lecturer => {
              const statusColor = lecturer.submissionStatus === "Finalised" ? C.green : lecturer.submissionStatus === "Overdue" ? C.red : C.amber;
              return (
                <tr key={lecturer.id} style={{ borderBottom: `1px solid ${C.borderMid}` }}>
                  <td style={{ padding: "14px 10px" }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: "12px" }}>{lecturer.name}</div>
                    <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "9px", marginTop: "4px" }}>{lecturer.id}</div>
                  </td>
                  <td style={{ padding: "14px 10px" }}>
                    <div style={{ color: C.maroon, fontFamily: C.mono, fontWeight: 700 }}>{lecturer.programmeCodes.join(", ") || "—"}</div>
                    <div style={{ color: C.textMuted, fontSize: "9px", marginTop: "4px" }}>{lecturer.department}</div>
                  </td>
                  <td style={{ padding: "14px 10px", color: C.textSub }}>
                    {lecturer.programmeAssignments.length ? lecturer.programmeAssignments.map(assignment => (
                      <div key={assignment.id} style={{ marginBottom: "4px" }}>
                        <span style={{ color: C.maroon, fontFamily: C.mono, fontWeight: 700 }}>{assignment.code}</span>
                        <span style={{ color: C.text, fontFamily: C.mono, fontWeight: 600 }}> · {assignment.subjects.join(", ") || "No subject"}</span>
                      </div>
                    )) : <span style={{ color: C.textMuted }}>No current teaching allocation</span>}
                  </td>
                  <td style={{ padding: "14px 10px", color: C.textSub }}><span style={{ color: C.text, fontFamily: C.mono, fontWeight: 700 }}>{lecturer.studentCount}</span> students</td>
                  <td style={{ padding: "14px 10px" }}>
                    <div style={{ color: statusColor, fontFamily: C.mono, fontSize: "9px", fontWeight: 700, letterSpacing: ".03em" }}>{lecturer.submissionStatus.toUpperCase()}</div>
                    <div style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "9px", marginTop: "4px" }}>{lecturer.completionRate}% complete</div>
                  </td>
                  <td style={{ padding: "14px 10px", color: C.textMuted, fontFamily: C.mono, fontSize: "9px" }}>{lecturer.lastUpdated}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div style={{ padding: "24px 10px", borderBottom: `1px solid ${C.borderMid}`, color: C.textMuted, fontSize: "12px" }}>No lecturer records match the selected search and programme filters.</div>}
      </div>
    </div>
  );
}
