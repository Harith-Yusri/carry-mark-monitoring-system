import { LoadingState } from "../../components/StaffDataState";
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, LayoutDashboard, Users, FileText, Settings, ClipboardList } from "lucide-react";
import { useColors } from "./adminStyles";
import { AdminTab } from "../../types";
import { requiresSubmissionAction, submissionAllocations, useAdminRecords } from "../../hooks/useAdminRecords";
import { loadCorrectionPendingCount } from "../../services/markCorrectionApi";

const AdminDashboard = lazy(() => import("./AdminDashboard").then((module) => ({ default: module.AdminDashboard })));
const LecturerDirectory = lazy(() => import("./LecturerDirectory").then((module) => ({ default: module.LecturerDirectory })));
const ComplianceReports = lazy(() => import("./ComplianceReports").then((module) => ({ default: module.ComplianceReports })));
const AdminSettings = lazy(() => import("./AdminSettings").then((module) => ({ default: module.AdminSettings })));
const SubmissionMonitor = lazy(() => import("./SubmissionMonitor").then((module) => ({ default: module.SubmissionMonitor })));
const SemesterHistory = lazy(() => import("./SessionHistory").then((module) => ({ default: module.SemesterHistory })));
const MarkCorrectionQueue = lazy(() => import("./MarkCorrectionQueue").then((module) => ({ default: module.MarkCorrectionQueue })));

export function AdminWebPortal() {
  const C = useColors();
  const { records, context, loading, error, reload } = useAdminRecords();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [pendingCorrections, setPendingCorrections] = useState<number | null>(null);
  const [correctionCountError, setCorrectionCountError] = useState(false);
  const correctionCountRequest = useRef(0);
  const correctionTerm = useRef(context?.termId);
  const refreshCorrectionCount = useCallback(() => {
    const request = ++correctionCountRequest.current;
    void loadCorrectionPendingCount().then(count => {
      if (request === correctionCountRequest.current) { setPendingCorrections(count); setCorrectionCountError(false); }
    }).catch(() => { if (request === correctionCountRequest.current) setCorrectionCountError(true); });
  }, []);
  useEffect(() => {
    // A previous semester's count is not a loaded count for the new semester.
    if (correctionTerm.current !== context?.termId) {
      correctionTerm.current = context?.termId;
      setPendingCorrections(null);
    }
    refreshCorrectionCount();
    window.addEventListener("focus", refreshCorrectionCount);
    const timer = window.setInterval(refreshCorrectionCount, 60000);
    return () => { correctionCountRequest.current++; window.removeEventListener("focus", refreshCorrectionCount); window.clearInterval(timer); };
  }, [context?.termId, activeTab, refreshCorrectionCount]);
  const pendingSubmissions = useMemo(
    () => submissionAllocations(records).filter(requiresSubmissionAction).length,
    [records],
  );

  return (
    <div className="admin-portal portal-typography">
      {/* Admin Sidebar Navigation */}
      <div className="admin-sidebar">
        <nav aria-label="Faculty administration" className="admin-sidebar-panel">
          <div style={{ padding: "0 8px 12px", borderBottom: `1px solid ${C.border}`, marginBottom: "10px" }}>
            <div>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "calc(0.875rem * var(--staff-text-scale))", color: C.text }}>Faculty Administration</div>
              <div style={{ marginTop: "3px", fontSize: "calc(0.6875rem * var(--staff-text-scale))", color: C.textMuted, letterSpacing: ".06em" }}>FSKM · Continuous Assessment</div>
            </div>
          </div>

          <div className="admin-nav-list">
            {[
              { key: "overview",   label: "Compliance Overview", icon: <LayoutDashboard size={15} /> },
              { key: "submissions", label: "Submission Monitor", icon: <ClipboardList size={15} />, pending: context ? pendingSubmissions : undefined },
              { key: "corrections", label: "Mark Corrections", icon: <ClipboardList size={15} />, pending: pendingCorrections ?? undefined },
              { key: "directory",  label: "Lecturer Directory",  icon: <Users size={15} /> },
              { key: "compliance", label: "Reports & Exports",    icon: <FileText size={15} /> },
              { key: "history",    label: "Past Semesters",       icon: <Archive size={15} /> },
              { key: "settings",   label: "System Settings",     icon: <Settings size={15} /> },
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
                    aria-label={`${item.pending} ${item.key === "corrections" ? "pending correction requests" : "pending submissions"}`}
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
          {correctionCountError && <p role="status" className="px-3 text-xs text-amber-700">Correction count unavailable. Open Mark Corrections to refresh.</p>}
        </nav>
      </div>

      {/* Main Content Pane */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Suspense fallback={<LoadingState layout={activeTab === "overview" ? "metrics" : "table"} />}>
          {activeTab === "overview" && <AdminDashboard records={records} context={context} loading={loading} error={error} />}
          {activeTab === "submissions" && <SubmissionMonitor records={records} context={context} loading={loading} error={error} />}
          {activeTab === "directory" && <LecturerDirectory records={records} context={context} loading={loading} error={error} />}
          {activeTab === "compliance" && <ComplianceReports records={records} context={context} loading={loading} error={error} />}
          {activeTab === "history" && <SemesterHistory />}
          {activeTab === "settings" && <AdminSettings onActiveSemesterChanged={reload} />}
          {activeTab === "corrections" && <MarkCorrectionQueue onChanged={refreshCorrectionCount} />}
        </Suspense>
      </div>
    </div>
  );
}
