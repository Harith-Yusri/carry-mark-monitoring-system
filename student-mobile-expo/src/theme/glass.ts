import type { ViewStyle } from "react-native";
import type { Palette } from "./colors";

export type GlassVariant = "standard" | "elevated" | "secondary";
export type GlassTone = "neutral" | "brand" | "success" | "warning" | "danger";

// Palette objects are stable. Cache a small set of styles per theme so long
// scrolling lists reuse their surface styles without blur/offscreen effects.
const cache = new WeakMap<Palette, Map<string, ViewStyle>>();

function tint(base: string, accent: string, strength: number) {
  return "#" + [1, 3, 5].map(start => Math.round(
    parseInt(base.slice(start, start + 2), 16) * (1 - strength)
    + parseInt(accent.slice(start, start + 2), 16) * strength,
  ).toString(16).padStart(2, "0")).join("") + base.slice(7);
}

export function getGlassStyle(colors: Palette, variant: GlassVariant = "standard", tone: GlassTone = "neutral"): ViewStyle {
  let styles = cache.get(colors);
  if (!styles) { styles = new Map(); cache.set(colors, styles); }
  const key = `${variant}:${tone}`;
  const existing = styles.get(key);
  if (existing) return existing;
  const secondary = variant === "secondary";
  const elevated = variant === "elevated";
  const surface = elevated ? colors.surfaceElevated : secondary ? colors.surfaceSecondary : colors.surface;
  const accent = tone === "neutral" ? null : tone === "brand" ? colors.primary : colors[tone];
  const style: ViewStyle = {
    // Semantic panels use a restrained tint over the standard glass base so
    // rose/green text stays legible even inside a lighter elevated dark card.
    backgroundColor: accent ? tint(colors.surface, accent, colors.glassTintStrength) : surface,
    borderColor: tone === "neutral" ? colors.border : tone === "brand" ? colors.primaryBorder : colors[`${tone}Border`],
    borderWidth: .5,
    borderRadius: secondary ? 16 : 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: elevated ? 5 : 3 },
    shadowOpacity: secondary ? 0 : colors.cardShadowOpacity,
    shadowRadius: secondary ? 0 : elevated ? 14 : 10,
    elevation: secondary ? 0 : colors.cardElevation + (elevated ? 1 : 0),
  };
  styles.set(key, style);
  return style;
}
