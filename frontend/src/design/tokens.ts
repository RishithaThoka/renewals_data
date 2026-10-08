/**
 * Design tokens — single source of truth for "Mobileum Horizon".
 * Incorporates brand navy #12284C, teal #00A3AD, violet #8080FF, and blue-to-cyan gradient.
 */

export const colors = {
  // Brand palette
  navy: '#12284C',
  navyLight: '#1B3B6F',
  navyDark: '#0A172C',
  navyDeep: '#050D19',

  teal: '#00A3AD',
  tealLight: '#00C4D0',
  tealDark: '#007A82',

  violet: '#8080FF',
  violetLight: '#A3A3FF',
  violetDark: '#5E5EE6',

  cyan: '#00D2DF',
  blue: '#0052CC',

  // Status & semantic colors
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  danger: '#EF4444',
  dangerLight: '#F87171',
  info: '#3B82F6',

  // Light theme surface & text
  light: {
    bgPrimary: '#F8FAFC',
    bgSecondary: '#F1F5F9',
    bgCard: '#FFFFFF',
    bgCardGlass: 'rgba(255, 255, 255, 0.82)',
    border: '#E2E8F0',
    borderSubtle: '#EDF2F7',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
  },

  // Dark theme surface & text
  dark: {
    bgPrimary: '#081220',
    bgSecondary: '#0B192C',
    bgCard: '#0F213A',
    bgCardGlass: 'rgba(15, 33, 58, 0.85)',
    border: '#1E3A60',
    borderSubtle: '#142944',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
  },
} as const

export const gradients = {
  logoGradient: 'linear-gradient(135deg, #0052CC 0%, #00A3AD 50%, #00D2DF 100%)',
  brand: 'linear-gradient(135deg, #12284C 0%, #00A3AD 60%, #8080FF 100%)',
  tealViolet: 'linear-gradient(90deg, #00A3AD 0%, #8080FF 100%)',
  hero: 'linear-gradient(145deg, #12284C 0%, #15335D 50%, #0A1B33 100%)',
  glassLight: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
  glassDark: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
  accentSubtle: 'linear-gradient(90deg, rgba(0, 163, 173, 0.12) 0%, rgba(128, 128, 255, 0.12) 100%)',
} as const

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  cardLight: '0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(18, 40, 76, 0.06)',
  cardDark: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)',
  cardHover: '0 12px 32px rgba(0, 163, 173, 0.18)',
  glass: '0 8px 32px 0 rgba(0, 163, 173, 0.12)',
  glowTeal: '0 0 24px rgba(0, 163, 173, 0.35)',
  glowViolet: '0 0 24px rgba(128, 128, 255, 0.35)',
} as const

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '22px',
  full: '9999px',
} as const

export const typography = {
  fontUi: 'Inter, system-ui, sans-serif',
  fontDisplay: '"Plus Jakarta Sans", Sora, system-ui, sans-serif',
} as const

export const motionTokens = {
  transitionFast: 0.15,
  transitionNormal: 0.25,
  transitionSmooth: 0.4,
  springDefault: { type: 'spring', damping: 26, stiffness: 320 } as const,
} as const

/** Forecast category → colourblind-safe canonical colours */
export const FORECAST_COLORS: Record<string, string> = {
  Closed: '#10B981',     // emerald green
  Commit: '#00A3AD',     // brand teal
  'Best Case': '#F59E0B', // amber
  Pipeline: '#8080FF',   // brand violet
  Blank: '#94A3B8',      // slate
}

/** Approval status → brand colours */
export const APPROVAL_COLORS: Record<string, string> = {
  Approved: '#10B981',
  'Approved - 2nd': '#00A3AD',
  'Pending Approval': '#F59E0B',
  Rejected: '#EF4444',
  Blank: '#94A3B8',
}

export const FORECAST_ORDER = ['Closed', 'Commit', 'Best Case', 'Pipeline', 'Blank'] as const
export const APPROVAL_ORDER = ['Approved', 'Approved - 2nd', 'Pending Approval', 'Rejected', 'Blank'] as const

export type ForecastCategory = typeof FORECAST_ORDER[number]
export type ApprovalStatus = typeof APPROVAL_ORDER[number]
