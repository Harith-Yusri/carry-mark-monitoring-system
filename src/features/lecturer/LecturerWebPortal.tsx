import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { LecturerDashboard, LecturerSubject } from "./LecturerDashboard";
import { AssessmentsTab } from "./AssessmentsTab";
import { MarksEntryTab } from "./MarksEntryTab";
import { ExportTab } from "./ExportTab";
import { LecturerTab, LecturerScreen } from "../../types";
import { useAuth } from "../../context/AuthContext";

export function LecturerWebPortal() {
  const C = useColors();
  const { user } = useAuth();
  const [screen, setScreen] = useState<LecturerScreen>("dashboard");
  const [selectedSubj, setSelectedSubj] = useState<LecturerSubject | null>(null);
  const [activeTab, setActiveTab] = useState<LecturerTab>("assessments");

  const currentSubj = selectedSubj;

  return (
    <div style={{ width: "100%", boxSizing: "border-box", padding: "0 clamp(20px, 3vw, 48px) 48px" }}>
      {screen === "dashboard" ? (
        <LecturerDashboard
          onSelectSubject={(subj) => {
            setSelectedSubj(subj);
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
              style={{ background: "transparent", border: "none", color: C.maroon, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, fontFamily: C.sans }}
            >
              <ChevronLeft size={16} /> Back to My Subjects
            </button>
            <div className="subject-context-label" style={{ fontFamily: C.mono, fontSize: "12px", color: C.textMuted }}>
              SUBJECT HUB · <span style={{ color: C.maroon, fontWeight: 700 }}>{currentSubj.code}</span> · {currentSubj.programmeCode} ({currentSubj.name})
            </div>
          </div>

          {/* Subject Header */}
          <section style={{ borderLeft: `3px solid ${C.maroon}`, padding: "8px 0 8px 18px", marginBottom: "22px" }}>
            <div className="subject-header-row" style={{ alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: "12px", color: C.maroon, fontWeight: 700 }}>COURSE CODE: {currentSubj.code}</div>
                <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "22px", color: C.text, margin: "2px 0 4px" }}>{currentSubj.name}</h1>
                <div style={{ fontSize: "13px", color: C.textMuted }}>
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
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                  transition: "border-color 0.15s, color 0.15s"
                }}
              >
                <span style={{ fontFamily: C.mono, fontSize: "11px", color: activeTab === t.key ? C.maroon : C.textMuted }}>{t.step}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "assessments" && <AssessmentsTab offeringId={currentSubj.offeringId} subjectCode={currentSubj.code} />}
          {activeTab === "marks" && <MarksEntryTab offeringId={currentSubj.offeringId} offeringProgrammeId={currentSubj.programmeId} subjectCode={currentSubj.code} />}
          {activeTab === "export" && <ExportTab offeringId={currentSubj.offeringId} subjectCode={currentSubj.code} subjectName={currentSubj.name} academicYear={currentSubj.academicYear} programmeSemester={currentSubj.progSem} />}
        </div>
      ) : null}
    </div>
  );
}
