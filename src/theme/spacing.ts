export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screenHorizontal: 20,
  bottomDockClearance: 96,
} as const;

export const Radii = {
  sm: 10,
  md: 14,
  lg: 20,
  notchedCard: 26,
  phoneFrame: 36,
  pill: 999,
} as const;

/**
 * Exact notched-card motif metrics matching the 21-screen reference design.
 */
export const NotchedCardMetrics = {
  borderRadius: Radii.notchedCard,
  paddingTop: 22,
  paddingHorizontal: 20,
  paddingBottom: 18,
  notchWidth: 64,
  notchHeight: 11,
  notchBottomRadius: 10,
} as const;
