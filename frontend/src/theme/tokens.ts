export const colors = {
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  surfaceHover: 'var(--color-surface-hover)',
  surfaceActive: 'var(--color-surface-active)',
  sidebar: 'var(--color-sidebar)',
  border: 'var(--color-border)',
  textMain: 'var(--color-text-main)',
  textMuted: 'var(--color-text-muted)',
  inputBg: 'var(--color-input-bg)',
  primary: 'var(--color-primary)',
  primaryFg: 'var(--color-primary-fg)',
  primaryDim: 'var(--color-primary-dim)',
  danger: 'var(--color-danger)',
  dangerDim: 'var(--color-danger-dim)',
  success: 'var(--color-success)',
  successDim: 'var(--color-success-dim)',
  warning: 'var(--color-warning)',
  warningDim: 'var(--color-warning-dim)',
  info: 'var(--color-info)',
  infoDim: 'var(--color-info-dim)',
} as const;

export const radius = {
  none: '0px',
  sm: '0.375rem',
  md: '0.625rem',
  lg: '0.875rem',
  xl: '1.125rem',
  pill: '9999px',
} as const;

export const shadow = {
  none: 'none',
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
} as const;

export const transition = {
  fast: '120ms var(--ease-out)',
  normal: '180ms var(--ease-out)',
  slow: '240ms var(--ease-out)',
} as const;

export const size = {
  touchTarget: '44px',
  sidebarCollapsed: '76px',
  sidebarExpanded: '240px',
} as const;

export const z = {
  overlay: 50,
  modal: 70,
  toast: 90,
  command: 100,
} as const;
