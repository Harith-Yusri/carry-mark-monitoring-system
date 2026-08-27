import type { CSSProperties } from "react";

export const classSelectorGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "14px",
};

export const classSelectorCardStyle: CSSProperties = {
  position: "relative",
  minHeight: "190px",
  boxSizing: "border-box",
  padding: "20px",
  borderRadius: "10px",
  cursor: "pointer",
  textAlign: "left",
  transition: "border-color .15s, transform .15s",
};

export const classSelectorIconStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "9px",
};

export const classSelectorTitleStyle: CSSProperties = {
  margin: "20px 0 8px",
  fontSize: "20px",
  fontWeight: 700,
};

export const classSelectorMetaStyle: CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.7,
};

export const classSelectorActionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  marginTop: "18px",
  fontSize: "12px",
  fontWeight: 700,
};
