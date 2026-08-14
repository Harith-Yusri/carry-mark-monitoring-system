import React, { createContext, useContext, useState } from "react";

interface DarkModeContextType {
  dark: boolean;
  toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({
  dark: true,
  toggle: () => {},
});

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dark, setDark] = useState<boolean>(true);
  const toggle = () => setDark((d) => !d);

  return (
    <DarkModeContext.Provider value={{ dark, toggle }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDark = () => useContext(DarkModeContext).dark;
export const useDarkToggle = () => useContext(DarkModeContext).toggle;

export function useColors() {
  const dark = useDark();
  return dark
    ? {
        bg: "#0B0E17",
        surface: "#131829",
        elevated: "#1A1F2E",
        border: "rgba(255,255,255,0.07)",
        borderMid: "rgba(255,255,255,0.12)",
        maroon: "#C0294F",
        maroonHover: "#D4305A",
        maroonLight: "rgba(192,41,79,0.18)",
        amber: "#D4A72C",
        amberLight: "rgba(212,167,44,0.15)",
        green: "#22C55E",
        greenLight: "rgba(34,197,94,0.12)",
        red: "#EF4444",
        redLight: "rgba(239,68,68,0.12)",
        text: "#E8EAF0",
        textSub: "#9CA3AF",
        textMuted: "#6B7280",
        chartGrid: "rgba(255,255,255,0.05)",
        tooltipBg: "#1A1F2E",
        mono: "'DM Mono', monospace",
        sans: "'Inter', sans-serif",
        display: "'Outfit', sans-serif",
      }
    : {
        bg: "#F2F4F8",
        surface: "#FFFFFF",
        elevated: "#E8EBF2",
        border: "rgba(0,0,0,0.08)",
        borderMid: "rgba(0,0,0,0.14)",
        maroon: "#B02246",
        maroonHover: "#C42B52",
        maroonLight: "rgba(176,34,70,0.09)",
        amber: "#B45309",
        amberLight: "rgba(180,83,9,0.08)",
        green: "#16A34A",
        greenLight: "rgba(22,163,74,0.08)",
        red: "#DC2626",
        redLight: "rgba(220,38,38,0.08)",
        text: "#0F1117",
        textSub: "#374151",
        textMuted: "#9CA3AF",
        chartGrid: "rgba(0,0,0,0.06)",
        tooltipBg: "#FFFFFF",
        mono: "'DM Mono', monospace",
        sans: "'Inter', sans-serif",
        display: "'Outfit', sans-serif",
      };
}
