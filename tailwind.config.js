/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F2A5F',
          50: '#EEF2F9',
          100: '#D6E0EF',
          600: '#0F2A5F',
          700: '#0B2049',
        },
        secondary: {
          DEFAULT: '#1E5EFF',
          50: '#EAF0FF',
          600: '#1E5EFF',
          700: '#154AD1',
        },
        accent: {
          DEFAULT: '#D4A76A',
          50: '#F9F1E6',
        },
        surface: '#F8FAFC',
        card: '#FFFFFF',
        ink: '#111827',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
};
