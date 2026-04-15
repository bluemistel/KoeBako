/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base:    'rgb(var(--color-bg-base) / <alpha-value>)',
          surface: 'rgb(var(--color-bg-surface) / <alpha-value>)',
          elevated:'rgb(var(--color-bg-elevated) / <alpha-value>)',
          card:    'rgb(var(--color-bg-card) / <alpha-value>)',
          hover:   'rgb(var(--color-bg-hover) / <alpha-value>)',
          border:  'rgb(var(--color-bg-border) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          light:   'rgb(var(--color-accent-light) / <alpha-value>)',
          dark:    'rgb(var(--color-accent-dark) / <alpha-value>)',
          muted:   'rgb(var(--color-accent-muted) / <alpha-value>)',
        },
        success:    'rgb(var(--color-success) / <alpha-value>)',
        warning:    'rgb(var(--color-warning) / <alpha-value>)',
        danger:     'rgb(var(--color-danger) / <alpha-value>)',
        txt: {
          primary:   'rgb(var(--color-txt-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-txt-secondary) / <alpha-value>)',
          muted:     'rgb(var(--color-txt-muted) / <alpha-value>)',
          disabled:  'rgb(var(--color-txt-disabled) / <alpha-value>)',
        },
        commercial: 'rgb(var(--color-commercial) / <alpha-value>)',
        original:   'rgb(var(--color-original) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Consolas"', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out'
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
