/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gp: {
          primary: {
            50: '#EFF5FF',
            100: '#DBE8FE',
            500: '#3B76ED',
            600: '#2C5FD1',
            700: '#1D4AB5',
          },
          surface: '#FFFFFF',
          sunken: '#F3F5F7',
          bg: '#FAFBFC',
          border: '#E4E8EC',
          'border-strong': '#D0D6DC',
          text: {
            primary: '#14181D',
            secondary: '#4B5563',
            tertiary: '#8A94A0',
          },
          success: '#1E8E5A',
          warning: '#B8710B',
          danger: '#C43D3D',
        }
      }
    },
  },
  plugins: [],
}
