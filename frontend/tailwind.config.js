/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chiluda: {
          red: '#059669',     // A fresh Emerald Green
          darkred: '#047857', // Deeper Emerald Green for hover
          lightred: '#ECFDF5' // Soft mint white selection background
        },
        brand: {
          50: '#FAF9F6',      // Soft Warm Alabaster White background
          100: '#F5F5F4',     // Light Stone/warm grey
          900: '#064E3B'      // Forest Green 900 for premium contrast text
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 10px 30px -10px rgba(28, 25, 23, 0.04), 0 1px 3px rgba(28, 25, 23, 0.02)',
        'glass': '0 8px 32px 0 rgba(5, 150, 105, 0.03)',
        'float': '0 10px 25px -3px rgba(5, 150, 105, 0.25)', // Emerald glowing shadow
        'card-hover': '0 20px 40px -15px rgba(0, 0, 0, 0.06), 0 10px 25px -3px rgba(5, 150, 105, 0.05)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
