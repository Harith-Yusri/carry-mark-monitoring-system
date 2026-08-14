import React, { useState } from "react";
import { Users, Plus, Trash2 } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";

const classSectionsData = [
  { group: "CS240 4A", studentCount: 22, schedule: "Mon 08:00 - 10:00 (Lab 3)" },
  { group: "CS240 4B", studentCount: 20, schedule: "Wed 14:00 - 16:00 (Lab 1)" },
];

export function ClassesTab({ subjectCode }: { subjectCode: string }) {
  const C = useColors();
  const [classes, setClasses] = useState(classSectionsData);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "18px", color: C.text }}>Enrolled Class Groups ({subjectCode})</h2>
          <p style={{ fontSize: "12px", color: C.textMuted }}>Manage course sections and student rosters.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {classes.map(cls => (
          <div key={cls.group} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontFamily: C.mono, fontSize: "14px", fontWeight: 700, color: C.maroon }}>{cls.group}</span>
              <span style={{ fontSize: "11px", color: C.textMuted }}>{cls.studentCount} Students</span>
            </div>
            <div style={{ fontSize: "12px", color: C.textSub }}>{cls.schedule}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
