import React, { lazy, Suspense, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import type { LecturerSubject } from "./LecturerDashboard";
import { LecturerTab, LecturerScreen } from "../../types";
import { useAuth } from "../../context/AuthContext";

const LecturerDashboard = lazy(() => import("./LecturerDashboard").then((module) => ({ default: module.LecturerDashboard })));
const AssessmentsTab = lazy(() => import("./AssessmentsTab").then((module) => ({ default: module.AssessmentsTab })));
const MarksEntryTab = lazy(() => import("./MarksEntryTab").then((module) => ({ default: module.MarksEntryTab })));
const ExportTab = lazy(() => import("./ExportTab").then((module) => ({ default: module.ExportTab })));

export function LecturerWebPortal() {
  const C = useColors();
  const { user } = useAuth();
  const [screen, setScreen] = useState<LecturerScreen>("dashboard");
  const [selectedSubj, setSelectedSubj] = useState<LecturerSubject | null>(null);
  const [activeTab, setActiveTab] = useState<LecturerTab>("assessments");

  const currentSubj = selectedSubj;
  const [assessmentOfferingId, setAssessmentOfferingId] = useState<string | null>(null);

  return (
    <div style={{ width: "100%", boxSizing: "border-box", padding: "0 clamp(20px, 3vw, 48px) 48px" }}>
      <Suspense fallback={<div role="status" aria-live="polite" style={{ color: C.textMuted, padding: "24px" }}>Loading section…</div>}>
        {screen === "dashboard" ? (
          <LecturerDashboard
            onSelectSubject={(subj) => {
              setSelectedSubj(subj);
              setAssessmentOfferingId(subj.offeringId);
              setScreen("subject-hub");
              setActiveTab("assessments");
            }}
          />
        ) : currentSubj ? (
        <div>
          {/* Top Back Navigation Bar */}
          <div className="subject-hub-top" style={{ alignItems: "center", marginBottom: "16px" }}>
            <button
              onClick={() => setScreen("dashboard")}
              style={{ background: "transparent", border: "none", color: C.maroon, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "calc(0.8125rem * var(--staff-text-scale))", fontWeight: 600, fontFamily: C.sans }}
            >
              <ChevronLeft size={16} /> Back to My Subjects
            </button>
            <div className="subject-context-label" style={{ fontFamily: C.mono, fontSize: "calc(0.75rem * var(--staff-text-scale))", color: C.textMuted }}>
              SUBJECT HUB · <span style={{ color: C.maroon, fontWeight: 700 }}>{currentSubj.code}</span> · {currentSubj.programmeCode} ({currentSubj.name})
            </div>
          </div>

          {/* Subject Header */}
          <section style={{ borderLeft: `3px solid ${C.maroon}`, padding: "8px 0 8px 18px", marginBottom: "22px" }}>
            <div className="subject-header-row" style={{ alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: "calc(0.75rem * var(--staff-text-scale))", color: C.maroon, fontWeight: 700 }}>COURSE CODE: {currentSubj.code}</div>
                <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(1.375rem * var(--staff-text-scale))", color: C.text, margin: "2px 0 4px" }}>{currentSubj.name}</h1>
                <div style={{ fontSize: "calc(0.8125rem * var(--staff-text-scale))", color: C.textMuted }}>
                  {currentSubj.programmeCode} · Semester {currentSubj.progSem} · {currentSubj.students} Registered Students · Lecturer: {user?.name}
                </div>
              </div>
            </div>
          </section>

          {/* Tabs Navigation */}
          <div className="subject-tabs" style={{ borderColor: C.border }}>
            {[
              { key: "assessments", step: "01", label: "Assessment Structure" },
              { key: "marks", step: "02", label: "Marks Entry & Eligibility" },
              { key: "export", step: "03", label: "Export Carry Marks" },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as LecturerTab)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 0,
                  border: "none",
                  borderBottom: `2px solid ${activeTab === t.key ? C.maroon : "transparent"}`,
                  background: "transparent",
                  color: activeTab === t.key ? C.maroon : C.textSub,
                  fontWeight: activeTab === t.key ? 700 : 500,
                  fontSize: "calc(0.8125rem * var(--staff-text-scale))",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                  transition: "border-color 0.15s, color 0.15s"
                }}
              >
                <span style={{ fontFamily: C.mono, fontSize: "calc(0.6875rem * var(--staff-text-scale))", color: activeTab === t.key ? C.maroon : C.textMuted }}>{t.step}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "assessments" && <>
            {currentSubj.offerings && <label style={{ display: "block", color: C.textSub, marginBottom: "14px" }}>Assessment structure for classes in <select aria-label="Assessment allocation" value={assessmentOfferingId ?? currentSubj.offeringId} onChange={event => setAssessmentOfferingId(event.target.value)} style={{ background: C.elevated, color: C.text, border: `1px solid ${C.borderMid}`, padding: "8px", borderRadius: "6px" }}>{currentSubj.offerings.map(offering => <option key={offering.offeringId} value={offering.offeringId}>{offering.programmeCode || "Unassigned classes"}</option>)}</select></label>}
            <AssessmentsTab key={assessmentOfferingId ?? currentSubj.offeringId} offeringId={assessmentOfferingId ?? currentSubj.offeringId} subjectCode={currentSubj.code} />
          </>}
          {activeTab === "marks" && <MarksEntryTab offeringIds={currentSubj.offerings?.map(item => item.offeringId)} offeringId={currentSubj.offeringId} offeringProgrammeId={currentSubj.programmeId} subjectCode={currentSubj.code} />}
          {activeTab === "export" && <ExportTab offeringIds={currentSubj.offerings?.map(item => item.offeringId)} offeringId={currentSubj.offeringId} subjectCode={currentSubj.code} subjectName={currentSubj.name} academicYear={currentSubj.academicYear} programmeSemester={currentSubj.progSem} />}
        </div>
        ) : null}
      </Suspense>
    </div>
  );
}
