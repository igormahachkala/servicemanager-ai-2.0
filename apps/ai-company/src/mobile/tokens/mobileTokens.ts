/** Mobile Design System V1 — layout and touch tokens (px). */
export const mobileTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    page: 16,
    section: 20,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  headerHeight: 56,
  bottomNavHeight: 64,
  fabSize: 56,
  fabOffset: 16,
  sheet: {
    padding: 16,
    handleHeight: 4,
    handleWidth: 36,
    headerGap: 12,
    actionGap: 8,
    maxHeightVh: 92,
  },
  touchTarget: 44,
  sectionSpacing: 20,
  contentBottomInset: 96,
  safeAreaTop: 'env(safe-area-inset-top, 0px)',
  safeAreaBottom: 'env(safe-area-inset-bottom, 0px)',
} as const

export type MobileTokenSpacing = keyof typeof mobileTokens.spacing
export type MobileTokenRadius = keyof typeof mobileTokens.radius
