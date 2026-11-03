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

export function useColors(forceLight = false) {
  const dark = useDark();
  const brand = {
    primary: "var(--staff-action-purple)",
    primaryHover: "var(--staff-action-hover)",
    brandText: "var(--staff-brand-text)",
    brandSurface: "var(--staff-brand-surface)",
    brandBorder: "var(--staff-brand-border)",
  };
  return dark && !forceLight
    ? {
        ...brand,
        bg: "#141426",
        chrome: "#24213B",
        surface: "#292541",
        elevated: "#322C4C",
        input: "#302B49",
        rowHover: "#3B3355",
        border: "#514766",
        borderMid: "#807393",
        focusRing: "#CEA9EC",
        maroon: "#C273D0",
        maroonHover: "#D18BDD",
        maroonLight: "rgba(169,123,221,0.18)",
        accentSolid: "#9143A2",
        code: "#F7F8FC",
        metadata: "#D0C8E0",
        metadataLight: "rgba(169,148,198,0.16)",
        panelShadow: "0 10px 28px rgba(12,8,30,0.2)",
        panelShadowHover: "0 14px 34px rgba(12,8,30,0.27)",
        amber: "#E4B958",
        amberLight: "rgba(196,143,42,0.17)",
        green: "#62C58A",
        greenLight: "rgba(53,159,98,0.17)",
        red: "#EC8190",
        redLight: "rgba(196,67,86,0.16)",
        text: "#F7F8FC",
        textSub: "#F8FAFC",
        textMuted: "#C5BED8",
        chartGrid: "rgba(201,195,220,0.24)",
        tooltipBg: "#322C4C",
        mono: "'DM Mono', monospace",
        sans: "'Inter', sans-serif",
        display: "'Inter', sans-serif",
      }
    : {
        ...brand,
        bg: "#FFFFFF",
        chrome: "#F8FAFC",
        surface: "#F8FAFC",
        elevated: "#F1F5F9",
        input: "#F8FAFC",
        rowHover: "#F6F1F8",
        border: "#E2E8F0",
        borderMid: "#94A3B8",
        focusRing: "#9333EA",
        maroon: "#581C87",
        maroonHover: "#6B21A8",
        maroonLight: "#FAF5FF",
        accentSolid: "#581C87",
        code: "#702082",
        metadata: "#702082",
        metadataLight: "rgba(112,32,130,0.09)",
        panelShadow: "0 1px 3px rgba(15,23,42,0.06)",
        panelShadowHover: "0 8px 22px rgba(15,23,42,0.10)",
        amber: "#B45309",
        amberLight: "rgba(180,83,9,0.08)",
        green: "#16A34A",
        greenLight: "rgba(22,163,74,0.08)",
        red: "#DC2626",
        redLight: "rgba(220,38,38,0.08)",
        text: "#1E293B",
        textSub: "#1E293B",
        textMuted: "#64748B",
        chartGrid: "rgba(0,0,0,0.06)",
        tooltipBg: "#FFFFFF",
        mono: "'DM Mono', monospace",
        sans: "'Inter', sans-serif",
        display: "'Inter', sans-serif",
      };
}

// Content cards inherit the active palette; surface tokens also preserve subject tints.
export function useCardColors() {
  const colors = useColors();
  const dark = useDark();
  return {
    ...colors,
    surface: "var(--staff-content-card-surface)",
    border: "var(--staff-content-card-border)",
    panelShadow: "var(--staff-content-card-shadow)",
    green: dark ? colors.green : "#166534",
    greenLight: dark ? colors.greenLight : "#DCFCE7",
    amber: dark ? colors.amber : "#92400E",
    amberLight: dark ? colors.amberLight : "#FEF3C7",
    red: dark ? colors.red : "#991B1B",
    redLight: dark ? colors.redLight : "#FEE2E2",
  };
}
