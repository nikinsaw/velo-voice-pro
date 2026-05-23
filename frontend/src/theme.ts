// Velo Voice Pro design tokens — sourced from /app/design_guidelines.json.
// Centralized so screens & components stay in lockstep with the guidelines.

export const colors = {
  background: "#0A0A0A",
  surface: "#161618",
  surfaceElevated: "#222225",
  primary: "#00FFB2",
  primaryGlow: "rgba(0, 255, 178, 0.5)",
  primarySoft: "rgba(0, 255, 178, 0.15)",
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  danger: "#FF3B30",
  divider: "rgba(255, 255, 255, 0.06)",
  borderSubtle: "rgba(255, 255, 255, 0.08)",
};

export const radii = {
  card: 24,
  pill: 999,
  control: 16,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// Glove-friendly minimums — small enough to fit a single phone width,
// large enough to land a thumb wearing a winter cycling glove.
export const sizes = {
  hitTarget: 56,
  hitTargetLg: 64,
  playPause: 76,
  skip: 56,
  avatar: 44,
  avatarLg: 56,
};

export const typography = {
  display: {
    fontSize: 30,
    fontWeight: "900" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: colors.textPrimary,
  },
  h2: {
    fontSize: 20,
    fontWeight: "800" as const,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    color: colors.textPrimary,
  },
  h3: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: colors.textSecondary,
  },
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.8,
    textTransform: "uppercase" as const,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: colors.textPrimary,
  },
};
