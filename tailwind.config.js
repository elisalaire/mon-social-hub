/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'festive-pink': '#FF2E95',
        'festive-yellow': '#D1FF4B',
        'festive-blue': '#00F0FF',
        'dark-purple': '#0b0118',
      },
    },
  },
  plugins: [],
}

