/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#212121',
        },
        sidebar: {
          DEFAULT: '#f7f7f7',
          dark: '#212121',
        },
        chat: {
          DEFAULT: '#e5ddd5',
          dark: '#0d1117',
        },
        bubble: {
          out: '#dcf8c6',
          'out-dark': '#005c4b',
          in: '#ffffff',
          'in-dark': '#202c33',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
