import React, { useState } from "react";
import { Shield, LayoutDashboard, Users, FileText, Settings, ClipboardList } from "lucide-react";
import { useColors } from "../../context/DarkModeContext";
import { AdminDashboard } from "./AdminDashboard";
import { LecturerDirectory } from "./LecturerDirectory";
import { ComplianceReports } from "./ComplianceReports";
import { AdminSettings } from "./AdminSettings";
import { SubmissionMonitor } from "./SubmissionMonitor";
import { AdminTab } from "../../types";

export function AdminWebPortal() {
  const C = useColors();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px 48px", display: "flex", gap: "28px" }}>
      {/* Admin Sidebar Navigation */}
      <div style={{ width: "220px", flexShrink: 0 }}>
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
              { key: "submissions", label: "Submission Monitor", icon: <ClipboardList size={15} /> },
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
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div style={{ flex: 1 }}>
        {activeTab === "overview" && <AdminDashboard />}
        {activeTab === "submissions" && <SubmissionMonitor />}
        {activeTab === "directory" && <LecturerDirectory />}
        {activeTab === "compliance" && <ComplianceReports />}
        {activeTab === "settings" && <AdminSettings />}
      </div>
    </div>
  );
}
