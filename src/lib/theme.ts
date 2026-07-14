export type Accent = "gold" | "violet" | "emerald";

export const ACCENTS: Record<Accent, { color: string; deep: string; ink: string }> = {
  gold: { color: "#ffc55c", deep: "#f0a93a", ink: "#241a05" },
  violet: { color: "#8b7bff", deep: "#7463f0", ink: "#120e2e" },
  emerald: { color: "#3ddc97", deep: "#2bbb7d", ink: "#062318" },
};

export const colors = {
  bg: "#0b0e14",
  surface: "rgba(255,255,255,0.05)",
  surface2: "rgba(255,255,255,0.08)",
  surface3: "rgba(255,255,255,0.12)",
  stroke: "rgba(255,255,255,0.10)",
  strokeSoft: "rgba(255,255,255,0.06)",
  text: "#eef2f8",
  dim: "#8793a6",
  faint: "#5b6577",
  red: "#f0616d",
  green: "#3fb950",
  amber: "#e3a53a",
};

export function fontSize(size: "sm" | "md" | "lg"): number {
  return size === "sm" ? 13 : size === "lg" ? 16 : 14.5;
}

/** Floating WhatsApp-style tab bar metrics (see navigation.tsx). */
export const TAB_BAR_HEIGHT = 66;
export const TAB_BAR_SIDE_MARGIN = 14;

/** Vertical space screens must leave free so content doesn't hide under the floating bar. */
export function tabClearance(bottomInset: number): number {
  return Math.max(bottomInset, 12) + TAB_BAR_HEIGHT + 12;
}
