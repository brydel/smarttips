import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        st: {
          bg: '#0A0E1A',
          card: '#0F1422',
          raised: '#141A2B',
          border: '#1B2236',
          stroke: '#252D45',
          muted: '#3A4366',
          dim: '#5A6485',
          sec: '#8892B0',
          pri: '#C5CCE0',
          hi: '#F4F6FB',
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
