import React, { useState } from "react";
import { Search, Lock, Unlock } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { lecturerClassesData, ELIGIBLE_THRESHOLD } from "../../mock/mockData";
import { StudentRecord } from "../../types";

export function MarksEntryTab({ subjectCode }: { subjectCode: string }) {
  const C = useColors();
  const storageKey = `carrymark_records_${subjectCode}`;
  const lockKey = `carrymark_locked_${subjectCode}`;
  const [records, setRecords] = useState<StudentRecord[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : lecturerClassesData;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [isLocked, setIsLocked] = useState(() => localStorage.getItem(lockKey) === "true");

  const toggleLocked = () => {
    setIsLocked(previous => {
      localStorage.setItem(lockKey, String(!previous));
      return !previous;
    });
  };

  const filtered = records.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.matrixNo.includes(searchTerm);
    const matchesGroup = groupFilter === "ALL" || r.group === groupFilter;
    return matchesSearch && matchesGroup;
  });

  const handleMarkChange = (id: string, field: keyof StudentRecord, value: number) => {
    if (isLocked) return;
    setRecords(prev => prev.map(rec => {
      if (rec.id === id) {
        const limits: Partial<Record<keyof StudentRecord, number>> = { quiz1: 10, assign1: 20, test1: 30, quiz2: 10, test2: 30 };
        const safeValue = Math.max(0, Math.min(value, limits[field] ?? value));
        const updated = { ...rec, [field]: safeValue };
        const q1 = updated.quiz1 || 0;
        const a1 = updated.assign1 || 0;
        const t1 = updated.test1 || 0;
        const q2 = updated.quiz2 || 0;
        const t2 = updated.test2 || 0;
        const total = (q1 + a1 + t1 + q2 + t2) / 2;
        const next = {
          ...updated,
          totalCarry: total,
          eligible: total >= ELIGIBLE_THRESHOLD
        };
        return next;
      }
      return rec;
    }));
  };

  React.useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(records));
  }, [records, storageKey]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "18px", color: C.text }}>Marks Entry & Verification ({subjectCode})</h2>
          <p style={{ fontSize: "12px", color: C.textMuted }}>Enter student raw marks and verify eligibility status before finalising.</p>
        </div>
        <button
          onClick={toggleLocked}
          style={{ background: isLocked ? C.greenLight : C.amberLight, color: isLocked ? C.green : C.amber, border: `1px solid ${isLocked ? C.green : C.amber}44`, borderRadius: "6px", padding: "8px 14px", fontSize: "12px", fontFamily: C.mono, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          {isLocked ? "FINALISED & LOCKED" : "MARKS EDITABLE"}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} color={C.textMuted} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by student name or matrix number..."
            style={{ width: "100%", padding: "8px 12px 8px 34px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "12px", outline: "none" }}
          />
        </div>
        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          style={{ padding: "8px 12px", background: C.elevated, border: `1px solid ${C.borderMid}`, borderRadius: "6px", color: C.text, fontSize: "12px", outline: "none" }}
        >
          <option value="ALL">All Groups</option>
          <option value="CS240 4A">Group CS240 4A</option>
          <option value="CS240 4B">Group CS240 4B</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: C.elevated, borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontFamily: C.mono, fontSize: "10px" }}>
              <th style={{ padding: "10px 14px" }}>MATRIX NO</th>
              <th style={{ padding: "10px 14px" }}>STUDENT NAME</th>
              <th style={{ padding: "10px 14px" }}>GROUP</th>
              <th style={{ padding: "10px 14px" }}>Q1 (10)</th>
              <th style={{ padding: "10px 14px" }}>A1 (20)</th>
              <th style={{ padding: "10px 14px" }}>T1 (30)</th>
              <th style={{ padding: "10px 14px" }}>Q2 (10)</th>
              <th style={{ padding: "10px 14px" }}>T2 (30)</th>
              <th style={{ padding: "10px 14px" }}>TOTAL / 50</th>
              <th style={{ padding: "10px 14px" }}>FINAL EXAM ELIGIBILITY</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "10px 14px", fontFamily: C.mono, color: C.maroon, fontWeight: 600 }}>{row.matrixNo}</td>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: C.text }}>{row.name}</td>
                <td style={{ padding: "10px 14px", color: C.textMuted, fontFamily: C.mono }}>{row.group}</td>
                <td style={{ padding: "6px 8px" }}>
                  <input disabled={isLocked} type="number" value={row.quiz1 ?? ""} onChange={e => handleMarkChange(row.id, "quiz1", Number(e.target.value))} style={{ width: "48px", padding: "4px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "4px", color: C.text, fontFamily: C.mono, textAlign: "center" }} />
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <input disabled={isLocked} type="number" value={row.assign1 ?? ""} onChange={e => handleMarkChange(row.id, "assign1", Number(e.target.value))} style={{ width: "48px", padding: "4px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "4px", color: C.text, fontFamily: C.mono, textAlign: "center" }} />
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <input disabled={isLocked} type="number" value={row.test1 ?? ""} onChange={e => handleMarkChange(row.id, "test1", Number(e.target.value))} style={{ width: "48px", padding: "4px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "4px", color: C.text, fontFamily: C.mono, textAlign: "center" }} />
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <input disabled={isLocked} type="number" value={row.quiz2 ?? ""} onChange={e => handleMarkChange(row.id, "quiz2", Number(e.target.value))} style={{ width: "48px", padding: "4px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "4px", color: C.text, fontFamily: C.mono, textAlign: "center" }} />
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <input disabled={isLocked} type="number" value={row.test2 ?? ""} onChange={e => handleMarkChange(row.id, "test2", Number(e.target.value))} style={{ width: "48px", padding: "4px", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: "4px", color: C.text, fontFamily: C.mono, textAlign: "center" }} />
                </td>
                <td style={{ padding: "10px 14px", fontFamily: C.mono, fontWeight: 700, fontSize: "13px", color: (row.totalCarry || 0) >= ELIGIBLE_THRESHOLD ? C.green : C.amber }}>
                  {row.totalCarry ?? "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ fontSize: "10px", fontFamily: C.mono, fontWeight: 700, padding: "3px 8px", borderRadius: "4px", background: row.eligible ? C.greenLight : C.redLight, color: row.eligible ? C.green : C.red, border: `1px solid ${row.eligible ? C.green : C.red}44` }}>
                    {row.eligible ? "QUALIFIED" : "INELIGIBLE (<40)"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
