/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef7f2', 100: '#d5ecdf', 500: '#2f7d5b', 600: '#256649', 700: '#1c4f39', 900: '#10291e' },
        ink: { DEFAULT: '#0b0b0b', 2: '#52514e', 3: '#8a8984' },
        surface: '#fcfcfb',
      },
    },
  },
  plugins: [],
}
