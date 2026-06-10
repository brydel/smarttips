import type { Config } from 'tailwindcss';

/**
 * Theme-aware tokens.
 *
 * Surface colours (st-bg → st-hi) are wired to CSS variables that swap based
 * on `[data-theme="light"|"dark"]` on the <html> element — see globals.css.
 * Accent colours stay fixed: indigo / emerald / gold are brand identity,
 * not tied to light/dark.
 *
 * Side-effect: existing utilities (`bg-st-bg`, `text-st-hi`, …) keep working
 * verbatim, no per-component refactor needed.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        st: {
          // Surface scale — themable via CSS variables.
          bg: 'var(--st-bg)',
          card: 'var(--st-card)',
          raised: 'var(--st-raised)',
          border: 'var(--st-border)',
          stroke: 'var(--st-stroke)',
          muted: 'var(--st-muted)',
          dim: 'var(--st-dim)',
          sec: 'var(--st-sec)',
          pri: 'var(--st-pri)',
          hi: 'var(--st-hi)',

          // Brand accents — fixed across themes.
          indigo: '#6366F1',
          'indigo-dim': '#4F46E5',
          'indigo-glow': '#818CF8',
          emerald: '#10B981',
          'emerald-dim': '#059669',
          'emerald-glow': '#34D399',
          gold: '#D4A574',
          'gold-dim': '#B8884F',
          'gold-glow': '#E8C49A',
          danger: '#EF4444',
          warn: '#F59E0B',
        },
      },
      fontFamily: {
        display: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,.4)',
        md: '0 8px 24px -8px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.3)',
        lg: '0 24px 60px -20px rgba(0,0,0,.6), 0 8px 20px -10px rgba(0,0,0,.4)',
        indigo: '0 0 0 1px rgba(99,102,241,.3), 0 8px 24px -8px rgba(99,102,241,.4)',
        emerald: '0 0 0 1px rgba(16,185,129,.3), 0 8px 24px -8px rgba(16,185,129,.35)',
        gold: '0 0 0 1px rgba(212,165,116,.3), 0 8px 24px -8px rgba(212,165,116,.35)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
