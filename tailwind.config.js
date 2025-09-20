/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        '3xl': '1600px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      minHeight: {
        '44': '44px', // Touch-friendly minimum height
        '48': '48px',
        '56': '56px',
      },
      maxWidth: {
        '90vw': '90vw',
      }
    },
  },
  plugins: [],
}
