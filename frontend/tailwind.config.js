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
        120: '120ms',
        180: '180ms',
        240: '240ms',
      },
    },
  },
  plugins: [],
};
