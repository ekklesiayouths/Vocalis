/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FEFEFB',
          100: '#FAFAF7',
          200: '#F5F4EE',
          300: '#EDEBE2',
          400: '#E2DFD2',
        },
        charcoal: {
          DEFAULT: '#2D2C2A',
          light: '#4A4845',
          muted: '#8A8780',
        },
        sage: {
          light: '#E8F0E6',
          DEFAULT: '#A8C9A0',
          dark: '#7BA872',
          deep: '#5E8A56',
        },
        terracotta: {
          light: '#F5E0DC',
          DEFAULT: '#E4A598',
          dark: '#D4887A',
          deep: '#B86B5E',
        },
        mustard: {
          light: '#F5EAC8',
          DEFAULT: '#E8C547',
          dark: '#D4AD2E',
          deep: '#B89520',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        hand: ['"Caveat"', 'cursive'],
      },
      boxShadow: {
        'paper': '4px 4px 0px 0px rgba(45, 44, 42, 0.12)',
        'paper-sm': '3px 3px 0px 0px rgba(45, 44, 42, 0.08)',
        'paper-lg': '6px 6px 0px 0px rgba(45, 44, 42, 0.15)',
        'paper-sage': '4px 4px 0px 0px rgba(91, 138, 86, 0.2)',
        'paper-terracotta': '4px 4px 0px 0px rgba(184, 107, 94, 0.2)',
        'paper-mustard': '4px 4px 0px 0px rgba(184, 149, 32, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'bounce-note': 'bounceNote 1.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'wobble': 'wobble 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceNote: {
          '0%, 100%': { transform: 'translateY(0) rotate(-3deg)' },
          '50%': { transform: 'translateY(-12px) rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        wobble: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
      },
    },
  },
  plugins: [],
};
