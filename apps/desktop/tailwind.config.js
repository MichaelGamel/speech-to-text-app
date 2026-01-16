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
        'wave-bar': 'wave-bar 0.3s ease-out',
        'wave-idle': 'wave-idle 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-recording': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        // Animation for waveform bar bounce when audio level changes
        'wave-bar': {
          '0%': { transform: 'scaleY(0.8)' },
          '50%': { transform: 'scaleY(1.1)' },
          '100%': { transform: 'scaleY(1)' },
        },
        // Subtle idle animation for waveform bars when waiting
        'wave-idle': {
          '0%, 100%': { transform: 'scaleY(1)', opacity: '0.5' },
          '50%': { transform: 'scaleY(0.7)', opacity: '0.4' },
        },
      },
      transitionTimingFunction: {
        'waveform': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'waveform-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
}
