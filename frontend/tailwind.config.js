/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Readex Pro Variable', 'sans-serif'],
                logo: ['Lemonada', 'cursive'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            colors: {
                primary: 'var(--color-primary)',
                'primary-fg': 'var(--color-primary-fg)',
                'primary-dim': 'var(--color-primary-dim)',
                bg: 'var(--color-bg)',
                sidebar: 'var(--color-sidebar)',
                surface: 'var(--color-surface)',
                'surface-hover': 'var(--color-surface-hover)',
                'surface-active': 'var(--color-surface-active)',
                border: 'var(--color-border)',
                'text-main': 'var(--color-text-main)',
                'text-muted': 'var(--color-text-muted)',
                'input-bg': 'var(--color-input-bg)',
            },
        },
    },
    plugins: [],
}
