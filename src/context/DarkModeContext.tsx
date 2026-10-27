import React, { createContext, useContext, useState } from "react";

interface DarkModeContextType {
  dark: boolean;
  toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({
  dark: false,
  toggle: () => {},
});

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dark, setDark] = useState<boolean>(false);
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
        bg: "#101522",
        surface: "#1A2030",
        elevated: "#242C3D",
        border: "rgba(226,232,240,0.12)",
        borderMid: "rgba(226,232,240,0.22)",
        maroon: "#B25CC3",
        maroonHover: "#C270D1",
        maroonLight: "rgba(178,92,195,0.18)",
        accentSolid: "#702082",
        amber: "#F2C35C",
        amberLight: "rgba(242,195,92,0.14)",
        green: "#4ADE80",
        greenLight: "rgba(74,222,128,0.13)",
        red: "#FB7185",
        redLight: "rgba(251,113,133,0.13)",
        text: "#F5F7FB",
        textSub: "#D6DCE7",
        textMuted: "#B3BDCC",
        chartGrid: "rgba(226,232,240,0.13)",
        tooltipBg: "#242C3D",
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
        maroon: "#702082",
        maroonHover: "#702082",
        maroonLight: "rgba(112,32,130,0.09)",
        accentSolid: "#702082",
        amber: "#B45309",
        amberLight: "rgba(180,83,9,0.08)",
        green: "#16A34A",
        greenLight: "rgba(22,163,74,0.08)",
        red: "#DC2626",
        redLight: "rgba(220,38,38,0.08)",
        text: "#0F1117",
        textSub: "#374151",
        textMuted: "#6B7280",
        chartGrid: "rgba(0,0,0,0.06)",
        tooltipBg: "#FFFFFF",
        mono: "'DM Mono', monospace",
        sans: "'Inter', sans-serif",
        display: "'Outfit', sans-serif",
      };
}
