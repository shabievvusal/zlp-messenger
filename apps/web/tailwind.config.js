/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e8f4fd',
          100: '#d1eafb',
          400: '#54a9d9',
          500: '#2AABEE',  // Telegram blue
          600: '#1a96d4',
          700: '#1585bd',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#0e1621',  // Telegram dark background
        },
        sidebar: {
          DEFAULT: '#f4f4f5',
          dark: '#1c2733',  // Telegram dark sidebar
        },
        chat: {
          DEFAULT: '#c8d9e5', // Telegram chat background (light)
          dark: '#0e1621',
        },
        bubble: {
          out: '#effdde',       // Telegram green (light mode outgoing)
          'out-dark': '#2b5278', // Telegram blue-dark (dark mode outgoing)
          in: '#ffffff',
          'in-dark': '#1e2c3a',  // Telegram dark incoming
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.3s ease-out',
        slideInRight: 'slideInRight 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
