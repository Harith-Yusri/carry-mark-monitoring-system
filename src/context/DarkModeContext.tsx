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
        bg: "#111827",
        chrome: "#0D1524",
        surface: "#202C40",
        elevated: "#29384F",
        input: "#304159",
        rowHover: "#28374D",
        border: "#41516A",
        borderMid: "#566780",
        focusRing: "#C878D5",
        maroon: "#C273D0",
        maroonHover: "#D18BDD",
        maroonLight: "rgba(184,88,201,0.18)",
        accentSolid: "#9143A2",
        code: "#F7F8FC",
        metadata: "#C2CDDC",
        metadataLight: "rgba(137,158,187,0.16)",
        panelShadow: "0 10px 28px rgba(2,8,18,0.18)",
        panelShadowHover: "0 14px 34px rgba(2,8,18,0.27)",
        amber: "#E4B958",
        amberLight: "rgba(196,143,42,0.17)",
        green: "#62C58A",
        greenLight: "rgba(53,159,98,0.17)",
        red: "#EC8190",
        redLight: "rgba(196,67,86,0.16)",
        text: "#F7F8FC",
        textSub: "#E0E6EF",
        textMuted: "#BEC9D9",
        chartGrid: "rgba(190,201,217,0.27)",
        tooltipBg: "#29384F",
        mono: "'DM Mono', monospace",
        sans: "'Inter', sans-serif",
        display: "'Outfit', sans-serif",
      }
    : {
        bg: "#F2F4F8",
        chrome: "#FFFFFF",
        surface: "#FFFFFF",
        elevated: "#E8EBF2",
        input: "#F3F3F5",
        rowHover: "#F6F1F8",
        border: "rgba(0,0,0,0.08)",
        borderMid: "rgba(0,0,0,0.14)",
        focusRing: "#702082",
        maroon: "#702082",
        maroonHover: "#702082",
        maroonLight: "rgba(112,32,130,0.09)",
        accentSolid: "#702082",
        code: "#702082",
        metadata: "#702082",
        metadataLight: "rgba(112,32,130,0.09)",
        panelShadow: "none",
        panelShadowHover: "0 8px 22px rgba(15,23,42,0.10)",
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
