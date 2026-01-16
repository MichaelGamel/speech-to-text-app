/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#1a1a1a',
          900: '#2a2a2a',
          800: '#3a3a3a',
          700: '#4a4a4a',
        },
        primary: {
          DEFAULT: '#007aff',
          hover: '#0066d6',
        },
        recording: '#ff3b30',
      },
      animation: {
        'pulse-recording': 'pulse-recording 1.5s ease-in-out infinite',
        'toast-in': 'toast-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-recording': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translate(-50%, 20px)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0)' },
        },
      },
    },
  },
  plugins: [],
}
