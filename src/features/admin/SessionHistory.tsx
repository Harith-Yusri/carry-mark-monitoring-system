import React, { useEffect, useState } from "react";
import { useColors } from "../../context/DarkModeContext";
import { listArchivedSemesterSummaries } from "../../services/carryMarkApi";
import { userError } from "../../utils/errors";

interface SemesterSummary {
  id: string;
  label: string;
  dates: string;
  offerings: number;
  classes: number;
  enrolments: number;
  finalised: number;
}

export function SemesterHistory() {
  const C = useColors();
  const [semesters, setSemesters] = useState<SemesterSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setSemesters(await listArchivedSemesterSummaries());
    };
    load().catch(reason => setError(userError(reason, "Unable to load semester history."))).finally(() => setLoading(false));
  }, []);

  return <div>
    <div style={{ marginBottom: "20px" }}><h1 style={{ fontFamily: C.display, fontSize: "calc(1.5rem * var(--staff-text-scale))", color: C.text, margin: "0 0 5px" }}>Past Semesters</h1><p style={{ color: C.textMuted, fontSize: "calc(0.8125rem * var(--staff-text-scale))", margin: 0 }}>Archived academic records are retained for reference and are read-only.</p></div>
    {loading && <p style={{ color: C.textMuted }}>Loading semester history…</p>}
    {error && <p role="alert" style={{ color: C.red }}>{error}</p>}
    {!loading && !error && semesters.length === 0 && <p style={{ color: C.textMuted }}>No archived semesters yet.</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
      {semesters.map(semester => <section key={semester.id} style={{ padding: "18px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "9px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><strong style={{ color: C.text }}>{semester.label}</strong><span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>ARCHIVED</span></div>
        <div style={{ color: C.textMuted, fontSize: "calc(0.75rem * var(--staff-text-scale))", marginTop: "5px" }}>{semester.dates}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "14px", color: C.textSub, fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>
          <span><strong style={{ color: C.text }}>{semester.offerings}</strong> offerings</span><span><strong style={{ color: C.text }}>{semester.classes}</strong> classes</span>
          <span><strong style={{ color: C.text }}>{semester.enrolments}</strong> enrolments</span><span><strong style={{ color: C.text }}>{semester.finalised}</strong> finalised</span>
        </div>
      </section>)}
    </div>
  </div>;
}
