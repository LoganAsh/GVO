// Single source of truth for theme tokens. Both LeagueApp and the table
// components pull from getTheme so the cream/dark switch is consistent across
// the public-facing app. See LeagueApp.jsx for where the active theme is
// chosen and persisted.

export function getTheme(theme) {
  if (theme === "light") {
    return {
      // Page chrome
      bg: "#EDE8D0",
      bgGradient: "linear-gradient(160deg,#EDE8D0 0%,#D8D3BB 60%,#EDE8D0 100%)",
      surface: "#EDE8D0",
      surfaceAlt: "rgba(79,77,70,0.04)",
      border: "#C9C5B1",
      borderSoft: "rgba(79,77,70,0.12)",
      text: "#4F4D46",
      textMuted: "rgba(79,77,70,0.75)",
      textSubtle: "rgba(79,77,70,0.55)",
      textVeryMuted: "rgba(79,77,70,0.35)",
      closeBtn: "rgba(79,77,70,0.55)",
      rowHover: "rgba(79,77,70,0.06)",
      inputBg: "rgba(79,77,70,0.05)",
      headerBg: "rgba(79,77,70,0.04)",
      backdrop: "rgba(79,77,70,0.45)",
      // Tables and data cards
      tableBg: "#FFFFFF",
      tableHeaderBg: "#F5F2E5",
      tableLine: "#4F4D46",
      tableText: "#4F4D46",
      tableTextMuted: "rgba(79,77,70,0.78)",
      tableTextSubtle: "rgba(79,77,70,0.6)",
      tableTextVeryMuted: "rgba(79,77,70,0.4)",
      tableSectionBg: "#F5F2E5",
      tableStickyBg: "#FFFFFF",
      tableRowHover: "rgba(79,77,70,0.05)",
    };
  }
  return {
    // Page chrome
    bg: "#070b12",
    bgGradient: "linear-gradient(160deg,#070b12 0%,#0d1525 60%,#070b12 100%)",
    surface: "#0d1525",
    surfaceAlt: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
    borderSoft: "rgba(255,255,255,0.06)",
    text: "#f1f5f9",
    textMuted: "#94a3b8",
    textSubtle: "#475569",
    textVeryMuted: "#334155",
    closeBtn: "#64748b",
    rowHover: "rgba(255,255,255,0.04)",
    inputBg: "rgba(255,255,255,0.06)",
    headerBg: "rgba(0,0,0,0.3)",
    backdrop: "rgba(0,0,0,0.65)",
    // Tables and data cards (existing dark values preserved)
    tableBg: "rgba(255,255,255,0.03)",
    tableHeaderBg: "rgba(255,255,255,0.04)",
    tableLine: "rgba(255,255,255,0.04)",
    tableText: "#f1f5f9",
    tableTextMuted: "#94a3b8",
    tableTextSubtle: "#475569",
    tableTextVeryMuted: "#334155",
    tableSectionBg: "rgba(255,255,255,0.03)",
    tableStickyBg: "#0d1525",
    tableRowHover: "rgba(255,255,255,0.04)",
  };
}
