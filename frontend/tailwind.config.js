/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        logo: ['Lemonada', 'cursive'],
      },
      fontSize: {
        // ─────────────────────────────────────────────────────────────
        // Desktop Typography Scale — calibrated for high information density
        // Base: html { font-size: 14px } → 1rem = 14px
        // ─────────────────────────────────────────────────────────────
        '2xs':  ['0.714rem',  { lineHeight: '1rem'   }],  // 10px — badges, timestamps
        'xs':   ['0.786rem',  { lineHeight: '1.071rem'}],  // 11px — table headers, secondary labels
        'sm':   ['0.857rem',  { lineHeight: '1.214rem'}],  // 12px — compact body, tooltips
        'base': ['0.929rem',  { lineHeight: '1.357rem'}],  // 13px — body text (default)
        'lg':   ['1rem',      { lineHeight: '1.429rem'}],  // 14px — stat values, subtext
        'xl':   ['1.143rem',  { lineHeight: '1.571rem'}],  // 16px — card titles
        '2xl':  ['1.286rem',  { lineHeight: '1.714rem'}],  // 18px — section headings
        '3xl':  ['1.571rem',  { lineHeight: '2rem'   }],   // 22px — page headings
        '4xl':  ['2rem',      { lineHeight: '2.429rem'}],  // 28px — large numbers
        '5xl':  ['2.571rem',  { lineHeight: '1'      }],   // 36px — display/hero
      },
      borderRadius: {
        'none': '0px',
        'sm': '0.125rem',
        'DEFAULT': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.375rem',    // Moderated to 6px (Enterprise Button/Input standard)
        '2xl': '0.5rem',      // Moderated to 8px (Enterprise Card standard)
        '3xl': '0.75rem',     // Moderated to 12px (Enterprise Modal standard)
        'full': '9999px',
      },
      colors: {
        primary: 'var(--color-primary)',
        'primary-fg': 'var(--color-primary-fg)',
        bg: 'var(--color-bg)',
        sidebar: 'var(--color-sidebar)',
        'sidebar-navy': 'var(--color-sidebar-navy)',
        'sidebar-navy-border': 'var(--color-sidebar-navy-border)',
        'sidebar-navy-hover': 'var(--color-sidebar-navy-hover)',
        'sidebar-navy-text': 'var(--color-sidebar-navy-text)',
        'sidebar-navy-text-hover': 'var(--color-sidebar-navy-text-hover)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'surface-active': 'var(--color-surface-active)',
        border: 'var(--color-border)',
        'text-main': 'var(--color-text-main)',
        'text-muted': 'var(--color-text-muted)',
        'input-bg': 'var(--color-input-bg)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        info: 'var(--color-info)',
        'primary-dim': 'var(--color-primary-dim)',
        'danger-dim': 'var(--color-danger-dim)',
        'success-dim': 'var(--color-success-dim)',
        'warning-dim': 'var(--color-warning-dim)',
        'info-dim': 'var(--color-info-dim)',
        'primary-rgb': 'rgba(var(--color-primary-rgb), <alpha-value>)',
        emerald: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#059669', // Overridden to be softer and more muted (previously emerald-600)
          600: '#047857', // Overridden to forest green (previously emerald-700)
          700: '#065f46',
          800: '#064e3b',
          900: '#022c22',
          950: '#011510',
        },
      },
      borderColor: {
        DEFAULT: 'var(--color-border)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        card: 'var(--shadow-sm)',
        'card-hover': 'var(--shadow-md)',
      },
      transitionDuration: {
        100: '100ms',
        120: '120ms',
        160: '160ms',
        180: '180ms',
        220: '220ms',
        240: '240ms',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-sm': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'ease-out-back': 'cubic-bezier(0.34, 1.3, 0.64, 1)',
      },
      keyframes: {
        pageEnter: {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.996)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        modalPop: {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        badgePop: {
          '0%': { transform: 'scale(0.8)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(0.96)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'page-enter': 'pageEnter 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'modal-pop': 'modalPop 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'badge-pop': 'badgePop 240ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pulse-subtle': 'pulseSubtle 2.5s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
      },
    },
  },
  plugins: [],
};
