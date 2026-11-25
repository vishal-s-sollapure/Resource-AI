/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0d1411',
          900: '#111c17',
          800: '#1a2a22',
          700: '#253a30',
          600: '#385044',
          500: '#51695c',
        },
        forest: {
          50: '#effaf3',
          100: '#d9f3e4',
          200: '#b7e7cc',
          300: '#85d5aa',
          400: '#4abb84',
          500: '#229d64',
          600: '#167f50',
          700: '#126641',
          800: '#115136',
          900: '#0f422d',
        },
        sand: {
          50: '#fbfaf6',
          100: '#f5f2e8',
          200: '#e9e3d3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 20px 50px -24px rgba(13, 20, 17, 0.38)',
        card: '0 1px 2px rgba(13, 20, 17, 0.04), 0 12px 32px -20px rgba(13, 20, 17, 0.22)',
        lifted: '0 24px 60px -28px rgba(13, 20, 17, 0.45)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.3s ease-out both',
        shimmer: 'shimmer 1.8s infinite',
      },
    },
  },
  plugins: [],
}
