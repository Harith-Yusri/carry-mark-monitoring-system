import React, { useState } from "react";
import { ChevronLeft, Layers, BookOpen, CheckSquare, Download, Users } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { LecturerDashboard, lecturerSubjects, LecturerSubject } from "./LecturerDashboard";
import { AssessmentsTab } from "./AssessmentsTab";
import { MarksEntryTab } from "./MarksEntryTab";
import { ExportTab } from "./ExportTab";
import { ClassesTab } from "./ClassesTab";
import { LecturerTab, LecturerScreen } from "../../types";

export function LecturerWebPortal() {
  const C = useColors();
  const [screen, setScreen] = useState<LecturerScreen>("dashboard");
  const [selectedSubj, setSelectedSubj] = useState<LecturerSubject | null>(null);
  const [activeTab, setActiveTab] = useState<LecturerTab>("assessments");

  const currentSubj = selectedSubj || lecturerSubjects[0];

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px 48px" }}>
      {screen === "dashboard" ? (
        <LecturerDashboard
          onSelectSubject={(subj) => {
            setSelectedSubj(subj);
            setScreen("subject-hub");
            setActiveTab("assessments");
          }}
        />
      ) : (
        <div>
          {/* Top Back Navigation Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <button
              onClick={() => setScreen("dashboard")}
              style={{ background: "transparent", border: "none", color: C.maroon, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, fontFamily: C.sans }}
            >
              <ChevronLeft size={16} /> Back to My Subjects
            </button>
            <div style={{ fontFamily: C.mono, fontSize: "11px", color: C.textMuted }}>
              SUBJECT HUB · <span style={{ color: C.maroon, fontWeight: 700 }}>{currentSubj.code}</span> ({currentSubj.name})
            </div>
          </div>

          {/* Subject Header */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: "11px", color: C.maroon, fontWeight: 700 }}>COURSE CODE: {currentSubj.code}</div>
                <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "22px", color: C.text, margin: "2px 0 4px" }}>{currentSubj.name}</h1>
                <div style={{ fontSize: "12px", color: C.textMuted }}>
                  Semester {currentSubj.progSem} · {currentSubj.students} Registered Students · Lecturer: Dr. Siti Rahimah
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div style={{ display: "flex", gap: "8px", borderBottom: `1px solid ${C.border}`, paddingBottom: "10px", marginBottom: "20px" }}>
            {[
              { key: "assessments", label: "Assessment Structure", icon: <Layers size={14} /> },
              { key: "marks",       label: "Marks Entry & Eligibility", icon: <CheckSquare size={14} /> },
              { key: "export",      label: "Export Carry Marks", icon: <Download size={14} /> },
              { key: "classes",     label: "Class Sections", icon: <Users size={14} /> },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as LecturerTab)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: `1px solid ${activeTab === t.key ? C.maroon : C.border}`,
                  background: activeTab === t.key ? C.maroonLight : C.surface,
                  color: activeTab === t.key ? C.maroon : C.textSub,
                  fontWeight: activeTab === t.key ? 700 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s"
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "assessments" && <AssessmentsTab subjectCode={currentSubj.code} />}
          {activeTab === "marks" && <MarksEntryTab subjectCode={currentSubj.code} />}
          {activeTab === "export" && <ExportTab subjectCode={currentSubj.code} />}
          {activeTab === "classes" && <ClassesTab subjectCode={currentSubj.code} />}
        </div>
      )}
    </div>
  );
}
