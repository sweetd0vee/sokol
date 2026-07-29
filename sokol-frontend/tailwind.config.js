/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sber: {
          dark: '#003366',
          DEFAULT: '#2563EB',
          light: '#6699FF',
          muted: '#1D4ED8',
        },
      },
    },
  },
  plugins: [],
}
