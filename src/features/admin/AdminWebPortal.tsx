import React, { useState } from "react";
import { Shield, LayoutDashboard, Users, FileText, Settings, ClipboardList } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { AdminDashboard } from "./AdminDashboard";
import { LecturerDirectory } from "./LecturerDirectory";
import { ComplianceReports } from "./ComplianceReports";
import { AdminSettings } from "./AdminSettings";
import { SubmissionMonitor } from "./SubmissionMonitor";
import { AdminTab } from "../../types";
import { facultyLecturersData } from "../../mock/mockData";

export function AdminWebPortal() {
  const C = useColors();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const pendingSubmissions = facultyLecturersData.filter(item => item.submissionStatus !== "Finalised").length;

  return (
    <div style={{ width: "100%", boxSizing: "border-box", padding: "0 clamp(20px, 3vw, 48px) 48px", display: "flex", gap: "clamp(20px, 2.5vw, 36px)" }}>
      {/* Admin Sidebar Navigation */}
      <div style={{ width: "clamp(210px, 17vw, 250px)", flexShrink: 0 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 8px 12px", borderBottom: `1px solid ${C.border}`, marginBottom: "12px" }}>
            <Shield size={18} color={C.maroon} />
            <div>
              <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: "13px", color: C.text }}>Faculty Admin</div>
              <div style={{ fontSize: "9px", fontFamily: C.mono, color: C.textMuted }}>FSKM PORTAL</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { key: "overview",   label: "Compliance Overview", icon: <LayoutDashboard size={15} /> },
              { key: "submissions", label: "Submission Monitor", icon: <ClipboardList size={15} />, pending: pendingSubmissions },
              { key: "directory",  label: "Lecturer Directory",  icon: <Users size={15} /> },
              { key: "compliance", label: "Reports & Exports",    icon: <FileText size={15} /> },
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
                  background: activeTab === item.key ? C.maroonLight : "transparent",
                  color: activeTab === item.key ? C.maroon : C.textSub,
                  fontWeight: activeTab === item.key ? 700 : 500,
                  fontSize: "12px",
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
                    aria-label={`${item.pending} pending submissions`}
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
                      fontFamily: C.mono,
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {item.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeTab === "overview" && <AdminDashboard />}
        {activeTab === "submissions" && <SubmissionMonitor />}
        {activeTab === "directory" && <LecturerDirectory />}
        {activeTab === "compliance" && <ComplianceReports />}
        {activeTab === "settings" && <AdminSettings />}
      </div>
    </div>
  );
}
