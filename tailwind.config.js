/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sat: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          brand: '#0284c7', // Professional Satellite Blue
          brandHover: '#0369a1',
          accent: '#0d9488', // Teal accent
          success: '#16a34a',
          warning: '#ea580c',
          danger: '#dc2626',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Consolas', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
