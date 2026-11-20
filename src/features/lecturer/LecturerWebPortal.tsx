import { t, tx, useLocale } from "../../localization/react";
import { SubjectClassCache } from "../../services/subjectClassCache";
import { InitialDataState, LoadingState } from "../../components/StaffDataState";
import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { workspace as W } from "./workspaceStyles";
import type { LecturerSubject } from "./LecturerDashboard";
import { LecturerTab, LecturerScreen } from "../../types";
import { useAuth } from "../../context/AuthContext";

import { useLocation, useSearchParams } from "react-router";
import { useLecturerNotificationStore } from "./LecturerNotifications";
import { correctionError } from "../../services/markCorrectionApi";

const LecturerDashboard = lazy(() => import("./LecturerDashboard").then((module) => ({ default: module.LecturerDashboard })));
const AssessmentsTab = lazy(() => import("./AssessmentsTab").then((module) => ({ default: module.AssessmentsTab })));
const MarksEntryTab = lazy(() => import("./MarksEntryTab").then((module) => ({ default: module.MarksEntryTab })));
const ExportTab = lazy(() => import("./ExportTab").then((module) => ({ default: module.ExportTab })));
const MarkIssuesTab = lazy(() => import("./MarkIssuesTab").then((module) => ({ default: module.MarkIssuesTab })));

export function LecturerWebPortal() {
  useLocale();
  const { user } = useAuth();
  const [screen, setScreen] = useState<LecturerScreen>("dashboard");
  const [selectedSubj, setSelectedSubj] = useState<LecturerSubject | null>(null);
  const [activeTab, setActiveTab] = useState<LecturerTab>("assessments");

  const store = useLecturerNotificationStore();
  const locationKey = useLocation().key;
  const [searchParams, setSearchParams] = useSearchParams();
  const notificationId = searchParams.get("markIssueNotification");
  const [target, setTarget] = useState<{ notificationId: string; issueId: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!notificationId || !store) return;
    let active = true;
    setOpening(true); setOpenError("");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)) {
      setOpening(false); setOpenError("This notification link is invalid."); return;
    }
    store.open(notificationId).then(result => {
      if (!active) return;
      setSelectedSubj(result.subject); setScreen("subject-hub"); setActiveTab("issues");
      setTarget({ notificationId, issueId: result.issueId });
    }).catch(reason => { if (active) setOpenError(correctionError(reason, "Unable to open this mark issue. Try again.")); })
      .finally(() => { if (active) setOpening(false); });
    return () => { active = false; };
  }, [notificationId, locationKey, store, retry]);

  const currentSubj = selectedSubj;
  const classCache = useMemo(() => new SubjectClassCache(), [user?.authId, currentSubj?.offeringId]);

  if (notificationId && (opening || openError || target?.notificationId !== notificationId)) return <div className="px-5 sm:px-8 lg:px-12">
    <InitialDataState title={t("Open mark issue")} label={t("Opening the reported mark issue…")} error={tx(openError)} onRetry={() => setRetry(value => value + 1)} />
    <button className={W.secondary} onClick={() => { setSearchParams({}); setScreen("dashboard"); }}>{t("Back to My Subjects")}</button>
  </div>;
  return (
    <div className="lecturer-workspace w-full min-w-0 px-5 pb-12 font-sans text-sm text-slate-800 dark:text-slate-100 sm:px-8 lg:px-12">
      <Suspense fallback={<LoadingState layout={activeTab === "assessments" || activeTab === "issues" ? "table" : "cards"} />}>
        {screen === "dashboard" ? <LecturerDashboard onSelectSubject={subj => { setSelectedSubj(subj); setScreen("subject-hub"); setActiveTab("assessments"); }} /> : currentSubj ? <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button onClick={() => { setSearchParams({}); setTarget(null); setScreen("dashboard"); }} className={W.secondary}><ChevronLeft size={16} /> {t(" Back to My Subjects")}</button>
            <span className={W.muted}>{t("Subject Hub · {{value0}}", { value0: (currentSubj.code) })}</span>
          </div>
          <section className={W.panel + " border-l-4 border-l-purple-900"}>
            <span className={W.code}>{currentSubj.code}</span><h1 className="staff-card-title mb-2 mt-3 text-2xl font-bold tracking-tight">{currentSubj.name}</h1>
            <p className={W.muted}>{t("Academic Year")}: {currentSubj.academicYear} · {t("Academic Term")}: {currentSubj.termCode} · {t("{{value0}} · Programme Semester {{value1}} · {{value2}} Registered Students · Lecturer: {{value3}}", { value0: (currentSubj.programmeCode), value1: (currentSubj.progSem), value2: (currentSubj.students), value3: (user?.name) })}</p>
          </section>
          <nav aria-label={t("Subject workspace")} className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
            {[
              { key: "assessments", step: "01", label: t("Assessment Structure") },
              { key: "marks", step: "02", label: t("Marks Entry & Eligibility") },
              { key: "export", step: "03", label: t("Export Carry Marks") },
              { key: "issues", step: "04", label: t("Mark Issues") },
            ].map(t => <button key={t.key} onClick={() => setActiveTab(t.key as LecturerTab)} aria-pressed={activeTab === t.key} className={"flex min-h-11 items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-sm transition-colors " + (activeTab === t.key ? "border-[var(--staff-brand-border)] bg-[var(--staff-brand-surface)] font-semibold text-[var(--staff-brand-text)]" : "border-transparent font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[var(--staff-row-hover)]")}><span className="text-xs">{t.step}</span>{t.label}</button>)}
          </nav>
          {activeTab === "assessments" && <AssessmentsTab onChanged={() => classCache.invalidate()} key={currentSubj.offeringId} offeringId={currentSubj.offeringId} subjectCode={currentSubj.code} />}
          {activeTab === "marks" && <MarksEntryTab cache={classCache} offeringIds={currentSubj.offerings?.map(item => item.offeringId)} offeringId={currentSubj.offeringId} offeringProgrammeId={currentSubj.programmeId} subjectCode={currentSubj.code} />}
          {activeTab === "export" && <ExportTab cache={classCache} offeringIds={currentSubj.offerings?.map(item => item.offeringId)} offeringId={currentSubj.offeringId} subjectCode={currentSubj.code} subjectName={currentSubj.name} academicYear={currentSubj.academicYear} academicTermCode={currentSubj.termCode} programmeSemester={currentSubj.progSem} />}
          {activeTab === "issues" && <MarkIssuesTab focusedIssueId={notificationId ? target?.issueId : undefined} onChanged={() => classCache.invalidate()} key={currentSubj.offeringId} offeringId={currentSubj.offeringId} />}
        </div> : null}
      </Suspense>
    </div>
  );
}
