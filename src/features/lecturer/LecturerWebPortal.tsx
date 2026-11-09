import { LoadingState } from "../../components/StaffDataState";
import React, { lazy, Suspense, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { workspace as W } from "./workspaceStyles";
import type { LecturerSubject } from "./LecturerDashboard";
import { LecturerTab, LecturerScreen } from "../../types";
import { useAuth } from "../../context/AuthContext";

const LecturerDashboard = lazy(() => import("./LecturerDashboard").then((module) => ({ default: module.LecturerDashboard })));
const AssessmentsTab = lazy(() => import("./AssessmentsTab").then((module) => ({ default: module.AssessmentsTab })));
const MarksEntryTab = lazy(() => import("./MarksEntryTab").then((module) => ({ default: module.MarksEntryTab })));
const ExportTab = lazy(() => import("./ExportTab").then((module) => ({ default: module.ExportTab })));
const MarkIssuesTab = lazy(() => import("./MarkIssuesTab").then((module) => ({ default: module.MarkIssuesTab })));

export function LecturerWebPortal() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<LecturerScreen>("dashboard");
  const [selectedSubj, setSelectedSubj] = useState<LecturerSubject | null>(null);
  const [activeTab, setActiveTab] = useState<LecturerTab>("assessments");

  const currentSubj = selectedSubj;

  return (
    <div className="lecturer-workspace w-full min-w-0 px-5 pb-12 font-sans text-sm text-slate-800 dark:text-slate-100 sm:px-8 lg:px-12">
      <Suspense fallback={<LoadingState layout={activeTab === "assessments" || activeTab === "issues" ? "table" : "cards"} />}>
        {screen === "dashboard" ? <LecturerDashboard onSelectSubject={subj => { setSelectedSubj(subj); setScreen("subject-hub"); setActiveTab("assessments"); }} /> : currentSubj ? <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button onClick={() => setScreen("dashboard")} className={W.secondary}><ChevronLeft size={16} /> Back to My Subjects</button>
            <span className={W.muted}>Subject Hub · {currentSubj.code}</span>
          </div>
          <section className={W.panel + " border-l-4 border-l-purple-900"}>
            <span className={W.code}>{currentSubj.code}</span><h1 className="staff-card-title mb-2 mt-3 text-2xl font-bold tracking-tight">{currentSubj.name}</h1>
            <p className={W.muted}>{currentSubj.programmeCode} · Semester {currentSubj.progSem} · {currentSubj.students} Registered Students · Lecturer: {user?.name}</p>
          </section>
          <nav aria-label="Subject workspace" className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
            {[
              { key: "assessments", step: "01", label: "Assessment Structure" },
              { key: "marks", step: "02", label: "Marks Entry & Eligibility" },
              { key: "export", step: "03", label: "Export Carry Marks" },
              { key: "issues", step: "04", label: "Mark Issues" },
            ].map(t => <button key={t.key} onClick={() => setActiveTab(t.key as LecturerTab)} aria-pressed={activeTab === t.key} className={"flex min-h-11 items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-sm transition-colors " + (activeTab === t.key ? "border-[var(--staff-brand-border)] bg-[var(--staff-brand-surface)] font-semibold text-[var(--staff-brand-text)]" : "border-transparent font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[var(--staff-row-hover)]")}><span className="text-xs">{t.step}</span>{t.label}</button>)}
          </nav>
          {activeTab === "assessments" && <AssessmentsTab key={currentSubj.offeringId} offeringId={currentSubj.offeringId} subjectCode={currentSubj.code} />}
          {activeTab === "marks" && <MarksEntryTab offeringIds={currentSubj.offerings?.map(item => item.offeringId)} offeringId={currentSubj.offeringId} offeringProgrammeId={currentSubj.programmeId} subjectCode={currentSubj.code} />}
          {activeTab === "export" && <ExportTab offeringIds={currentSubj.offerings?.map(item => item.offeringId)} offeringId={currentSubj.offeringId} subjectCode={currentSubj.code} subjectName={currentSubj.name} academicYear={currentSubj.academicYear} programmeSemester={currentSubj.progSem} />}
          {activeTab === "issues" && <MarkIssuesTab key={currentSubj.offeringId} offeringId={currentSubj.offeringId} />}
        </div> : null}
      </Suspense>
    </div>
  );
}
