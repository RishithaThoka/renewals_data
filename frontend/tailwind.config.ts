/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#12284C',
          light: '#1A3A6B',
          dark: '#0A1628',
          50: '#E8EDF5',
          100: '#C5D1E8',
          200: '#8FA5CE',
          300: '#5879B4',
          400: '#2F5498',
          500: '#12284C',
          600: '#0F2240',
          700: '#0B1B33',
          800: '#081426',
          900: '#040C18',
        },
        teal: {
          DEFAULT: '#00A3AD',
          light: '#00C2CC',
          dark: '#007E87',
          50: '#E0F7F8',
          100: '#B3ECF0',
          200: '#80DFE6',
          300: '#4DD2DC',
          400: '#26C7D3',
          500: '#00A3AD',
          600: '#008A94',
          700: '#006E76',
          800: '#005259',
          900: '#00363B',
        },
        violet: {
          DEFAULT: '#8080FF',
          light: '#A0A0FF',
          dark: '#6060FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Sora', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #12284C 0%, #00A3AD 60%, #8080FF 100%)',
        'teal-gradient': 'linear-gradient(90deg, #00A3AD 0%, #8080FF 100%)',
        'hero-gradient': 'linear-gradient(160deg, #12284C 0%, #1A3A6B 50%, #0A2A4A 100%)',
        'card-glass': 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(18,40,76,0.06)',
        'card-hover': '0 4px 24px rgba(0,163,173,0.18)',
        glass: '0 8px 32px rgba(18,40,76,0.12), inset 0 1px 0 rgba(255,255,255,0.12)',
        glow: '0 0 24px rgba(0,163,173,0.35)',
        'glow-violet': '0 0 24px rgba(128,128,255,0.35)',
      },
      animation: {
        'count-up': 'countUp 0.8s ease-out',
        'draw-in': 'drawIn 1s ease-out',
        'fade-up': 'fadeUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        countUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
