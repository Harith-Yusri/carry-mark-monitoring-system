import { t, tx, useLocale } from "../../localization/react";
import { InitialDataState } from "../../components/StaffDataState";
import React, { useEffect, useState } from "react";
import { useCardColors, useColors } from "./adminStyles";
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
  useLocale();
  const C = useColors();
  const CC = useCardColors();
  const [semesters, setSemesters] = useState<SemesterSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setSemesters(await listArchivedSemesterSummaries());
    };
    load().catch(reason => setError(userError(reason, "Unable to load academic term history."))).finally(() => setLoading(false));
  }, []);

  if (loading || error) return <InitialDataState title={t("Past Academic Terms")} label={t("Loading academic term history…")} error={tx(error)} />;

  return <div>
    <div style={{ marginBottom: "20px" }}><h1 style={{ fontFamily: C.display, fontSize: "calc(1.5rem * var(--staff-text-scale))", color: C.text, margin: "0 0 5px" }}>{t("Past Academic Terms")}</h1><p style={{ color: C.textMuted, fontSize: "calc(0.8125rem * var(--staff-text-scale))", margin: 0 }}>{t("Archived academic records are retained for reference and are read-only.")}</p></div>
    {!loading && !error && semesters.length === 0 && <p style={{ color: C.textMuted }}>{t("No archived academic terms yet.")}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
      {semesters.map(semester => <section key={semester.id} className="staff-content-card" style={{ padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}><strong style={{ color: CC.text }}>{semester.label}</strong><span style={{ color: CC.textMuted, fontSize: "calc(0.6875rem * var(--staff-text-scale))" }}>{t("Archived")}</span></div>
        <div style={{ color: CC.textMuted, fontSize: "calc(0.75rem * var(--staff-text-scale))", marginTop: "5px" }}>{semester.dates}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "14px", color: CC.textSub, fontSize: "calc(0.75rem * var(--staff-text-scale))" }}>
          <span><strong style={{ color: CC.text }}>{semester.offerings}</strong> {t(" offerings")}</span><span><strong style={{ color: CC.text }}>{semester.classes}</strong> {t(" classes")}</span>
          <span><strong style={{ color: CC.text }}>{semester.enrolments}</strong> {t(" enrolments")}</span><span><strong style={{ color: CC.text }}>{semester.finalised}</strong> {t(" released")}</span>
        </div>
      </section>)}
    </div>
  </div>;
}
