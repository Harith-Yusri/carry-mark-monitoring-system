import React from "react";
import { useNavigate } from "react-router";
import { Layers, Shield, BarChart3 } from "lucide-react";
import { useColors } from "../context/DarkModeContext";
import { useAuth } from "../context/AuthContext";

export function LandingPage() {
  const C = useColors();
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    if (user) navigate(`/${user.role}/dashboard`, { replace: true });
  }, [user, navigate]);

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, color: C.text, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ width: "64px", height: "64px", background: C.maroon, borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <BarChart3 size={32} color="#fff" />
        </div>
        <h1 style={{ fontFamily: C.display, fontWeight: 700, fontSize: "28px", color: C.text, margin: "0 0 8px 0" }}>UiTM Carry Mark Monitoring System</h1>
        <p style={{ fontSize: "14px", fontFamily: C.mono, color: C.textMuted, letterSpacing: "0.05em", margin: 0 }}>FACULTY MANAGEMENT & SYSTEM PORTAL</p>
      </div>

      <div style={{ display: "flex", gap: "24px", maxWidth: "800px", width: "100%", justifyContent: "center", flexWrap: "wrap" }}>
        
        {/* Lecturer Portal Card */}
        <div 
          onClick={() => navigate("/lecturer/login")}
          style={{ 
            background: C.surface, 
            border: `1px solid ${C.border}`, 
            borderRadius: "16px", 
            padding: "32px", 
            width: "320px",
            cursor: "pointer",
            transition: "transform 0.2s, box-shadow 0.2s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = `0 12px 24px -8px ${C.borderMid}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ width: "48px", height: "48px", background: C.blue + "20", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: C.blue }}>
            <Layers size={24} />
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 8px 0", color: C.text }}>Lecturer Portal</h2>
          <p style={{ fontSize: "13px", color: C.textSub, margin: 0 }}>Marks Entry & e-Result Export</p>
        </div>

        {/* Admin Portal Card */}
        <div 
          onClick={() => navigate("/admin/login")}
          style={{ 
            background: C.surface, 
            border: `1px solid ${C.border}`, 
            borderRadius: "16px", 
            padding: "32px", 
            width: "320px",
            cursor: "pointer",
            transition: "transform 0.2s, box-shadow 0.2s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = `0 12px 24px -8px ${C.borderMid}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ width: "48px", height: "48px", background: C.maroon + "20", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: C.maroon }}>
            <Shield size={24} />
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 8px 0", color: C.text }}>Admin Portal</h2>
          <p style={{ fontSize: "13px", color: C.textSub, margin: 0 }}>Compliance Oversight & Reports</p>
        </div>

      </div>
    </div>
  );
}
