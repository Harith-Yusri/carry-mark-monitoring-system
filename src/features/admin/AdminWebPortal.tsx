import { t, tx, useLocale } from "../../localization/react";
import { LoadingState } from "../../components/StaffDataState";
import React, { lazy, Suspense, useMemo, useState } from "react";
import { Archive, LayoutDashboard, Users, FileText, Settings, ClipboardList } from "lucide-react";
import { useColors } from "./adminStyles";
import { AdminTab } from "../../types";
import { requiresSubmissionAction, submissionAllocations, useAdminRecords } from "../../hooks/useAdminRecords";

const AdminDashboard = lazy(() => import("./AdminDashboard").then((module) => ({ default: module.AdminDashboard })));
const LecturerDirectory = lazy(() => import("./LecturerDirectory").then((module) => ({ default: module.LecturerDirectory })));
const ComplianceReports = lazy(() => import("./ComplianceReports").then((module) => ({ default: module.ComplianceReports })));
const AdminSettings = lazy(() => import("./AdminSettings").then((module) => ({ default: module.AdminSettings })));
const SubmissionMonitor = lazy(() => import("./SubmissionMonitor").then((module) => ({ default: module.SubmissionMonitor })));
const SemesterHistory = lazy(() => import("./SessionHistory").then((module) => ({ default: module.SemesterHistory })));

export function AdminWebPortal() {
  useLocale();
  const C = useColors();
  const { records, context, loading, error, reload } = useAdminRecords();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const pendingSubmissions = useMemo(
    () => submissionAllocations(records).filter(requiresSubmissionAction).length,
    [records],
  );

  return (
    <div className="admin-portal portal-typography">
      {/* Admin Sidebar Navigation */}
      <div className="admin-sidebar">
        <nav aria-label={t("Faculty administration")} className="admin-sidebar-panel">
          <div style={{ padding: "0 8px 12px", borderBottom: `1px solid ${C.border}`, marginBottom: "10px" }}>
            <div>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(0.875rem * var(--staff-text-scale))", color: C.text }}>{t("Faculty Administration")}</div>
              <div style={{ marginTop: "3px", fontSize: "calc(0.6875rem * var(--staff-text-scale))", color: C.textMuted, letterSpacing: ".06em" }}>{t("FSKM · Continuous Assessment")}</div>
            </div>
          </div>

          <div className="admin-nav-list">
            {[
              { key: "overview",   label: t("Compliance Overview"), icon: <LayoutDashboard size={15} /> },
              { key: "submissions", label: t("Submission Monitor"), icon: <ClipboardList size={15} />, pending: context ? pendingSubmissions : undefined },
              { key: "directory",  label: t("Lecturer Directory"),  icon: <Users size={15} /> },
              { key: "compliance", label: t("Reports & Exports"),    icon: <FileText size={15} /> },
              { key: "history",    label: t("Past Academic Terms"),       icon: <Archive size={15} /> },
              { key: "settings",   label: t("System Settings"),     icon: <Settings size={15} /> },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key as AdminTab)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: activeTab === item.key ? C.brandSurface : "transparent",
                  color: activeTab === item.key ? C.brandText : C.textSub,
                  fontWeight: activeTab === item.key ? 700 : 500,
                  fontSize: "calc(0.8125rem * var(--staff-text-scale))",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  textAlign: "left",
                  transition: "all 0.12s"
                }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.pending !== undefined && (
                  <span
                    aria-label={t("{{value0}} pending submissions", { value0: (item.pending) })}
                    style={{
                      minWidth: "23px",
                      height: "23px",
                      padding: "0 5px",
                      boxSizing: "border-box",
                      borderRadius: "12px",
                      border: `1px solid ${C.amber}88`,
                      background: C.amberLight,
                      color: C.amber,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "calc(0.6875rem * var(--staff-text-scale))",
                      fontWeight: 700,
                    }}
                  >
                    {item.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content Pane */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Suspense fallback={<LoadingState layout={activeTab === "overview" ? "metrics" : "table"} />}>
          {activeTab === "overview" && <AdminDashboard records={records} context={context} loading={loading} error={tx(error)} />}
          {activeTab === "submissions" && <SubmissionMonitor records={records} context={context} loading={loading} error={tx(error)} />}
          {activeTab === "directory" && <LecturerDirectory records={records} context={context} loading={loading} error={tx(error)} />}
          {activeTab === "compliance" && <ComplianceReports records={records} context={context} loading={loading} error={tx(error)} />}
          {activeTab === "history" && <SemesterHistory />}
          {activeTab === "settings" && <AdminSettings onActiveSemesterChanged={reload} />}
        </Suspense>
      </div>
    </div>
  );
}
