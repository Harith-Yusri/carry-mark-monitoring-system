import React from "react";
import { submissionStatusLabel } from "../../utils/releaseTerminology";
import { useColors as usePortalColors, useDark } from "../../context/DarkModeContext";

// Admin presentation only; lecturer colors and all data hooks remain unchanged.
export function useColors() {
  const colors = usePortalColors();
  const dark = useDark();
  return {
    ...colors,
    ...(dark ? {} : {
      bg: "#f8fafc", chrome: "#ffffff", surface: "#ffffff", elevated: "#f8fafc",
      input: "#ffffff", border: "#e2e8f0", borderMid: "#cbd5e1",
      code: "#475569", text: "#1e293b", textSub: "#334155", textMuted: "#64748b",
    }),
  };
}

export const useCardColors = useColors;

export function AdminStatus({ status, children }: { status: string; children?: React.ReactNode }) {
  const value = status.toLowerCase();
  const tone = ["finalised", "active", "completed"].includes(value) ? "success"
    : ["overdue", "action required", "require action"].includes(value) ? "danger"
    : ["archived", "inactive", "neutral"].includes(value) ? "neutral" : "pending";
  const label = submissionStatusLabel(status).toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
  return <span className={`admin-status admin-status-${tone}`}>{children}{label}</span>;
}
