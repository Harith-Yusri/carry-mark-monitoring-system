import React, { useEffect, useState } from "react";
import { useColors } from "../../context/DarkModeContext";
import { requireSupabase } from "../../lib/supabase";
import { userError } from "../../utils/errors";

interface SessionSummary {
  id: string;
  label: string;
  dates: string;
  offerings: number;
  classes: number;
  enrolments: number;
  finalised: number;
}

export function SessionHistory() {
  const C = useColors();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const db = requireSupabase();
      const [{ data: terms, error: termError }, { data: offerings, error: offeringError }] = await Promise.all([
        db.from("academic_terms").select("id,academic_year,semester_no,starts_on,ends_on").eq("status", "closed").order("starts_on", { ascending: false }),
        db.from("subject_offerings").select("id,term_id,class_sections(id,enrolments(count),submissions(status))"),
      ]);
      if (termError) throw termError;
      if (offeringError) throw offeringError;
      setSessions(terms.map(term => {
        const termOfferings = (offerings as any[]).filter(offering => offering.term_id === term.id);
        const classes = termOfferings.flatMap(offering => offering.class_sections ?? []);
        return {
          id: term.id,
          label: `Session ${term.semester_no} · ${term.academic_year}`,
          dates: `${term.starts_on} – ${term.ends_on}`,
          offerings: termOfferings.length,
          classes: classes.length,
          enrolments: classes.reduce((total, section) => total + Number(section.enrolments?.[0]?.count ?? 0), 0),
          finalised: classes.filter(section => section.submissions?.some((submission: any) => submission.status === "finalised")).length,
        };
      }));
    };
    load().catch(reason => setError(userError(reason, "Unable to load session history."))).finally(() => setLoading(false));
  }, []);

  return <div>
    <div style={{ marginBottom: "20px" }}><h1 style={{ fontFamily: C.display, fontSize: "24px", color: C.text, margin: "0 0 5px" }}>Past Sessions</h1><p style={{ color: C.textMuted, fontSize: "13px", margin: 0 }}>Archived academic records are retained for reference and are read-only.</p></div>
    {loading && <p style={{ color: C.textMuted }}>Loading session history…</p>}
    {error && <p role="alert" style={{ color: C.red }}>{error}</p>}
    {!loading && !error && sessions.length === 0 && <p style={{ color: C.textMuted }}>No archived sessions yet.</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
      {sessions.map(session => <section key={session.id} style={{ padding: "18px", background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: "9px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><strong style={{ color: C.text }}>{session.label}</strong><span style={{ color: C.textMuted, fontFamily: C.mono, fontSize: "11px" }}>ARCHIVED</span></div>
        <div style={{ color: C.textMuted, fontSize: "12px", marginTop: "5px" }}>{session.dates}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "14px", color: C.textSub, fontSize: "12px" }}>
          <span><strong style={{ color: C.text }}>{session.offerings}</strong> offerings</span><span><strong style={{ color: C.text }}>{session.classes}</strong> classes</span>
          <span><strong style={{ color: C.text }}>{session.enrolments}</strong> enrolments</span><span><strong style={{ color: C.text }}>{session.finalised}</strong> finalised</span>
        </div>
      </section>)}
    </div>
  </div>;
}
