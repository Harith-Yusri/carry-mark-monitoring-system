import React, { useState } from "react";
import { Search, Mail, Phone, MapPin, CheckCircle, Clock } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { facultyLecturersData } from "../../mock/mockData";

export function LecturerDirectory() {
  const C = useColors();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = facultyLecturersData.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.id.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "22px", color: C.text, marginBottom: "4px" }}>Faculty Lecturer Directory</h1>
        <p style={{ fontSize: "12px", color: C.textMuted }}>Faculty of Computer & Mathematical Sciences Academic Staff Contact & Submissions Directory</p>
      </div>

      <div style={{ position: "relative", marginBottom: "16px" }}>
        <Search size={16} color={C.textMuted} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search lecturer by name or staff ID..."
          style={{ width: "100%", padding: "10px 14px 10px 38px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "8px", color: C.text, fontSize: "13px", outline: "none" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        {filtered.map(lect => (
          <div key={lect.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: "10px", color: C.maroon, fontWeight: 700 }}>STAFF ID: {lect.id}</div>
                <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "15px", color: C.text }}>{lect.name}</div>
                <div style={{ fontSize: "11px", color: C.textMuted }}>{lect.department}</div>
              </div>
              <span style={{ fontSize: "10px", fontFamily: C.mono, padding: "2px 8px", borderRadius: "4px", background: lect.submissionStatus === "Finalised" ? C.greenLight : C.amberLight, color: lect.submissionStatus === "Finalised" ? C.green : C.amber, border: `1px solid ${C.border}` }}>
                {lect.submissionStatus}
              </span>
            </div>

            <div style={{ fontSize: "11px", color: C.textSub, display: "flex", flexDirection: "column", gap: "4px" }}>
              <div>Assigned Courses: <span style={{ fontFamily: C.mono, color: C.maroon, fontWeight: 600 }}>{lect.subjects.join(", ")}</span></div>
              <div>Last Activity: <span style={{ fontFamily: C.mono, color: C.textMuted }}>{lect.lastUpdated}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
