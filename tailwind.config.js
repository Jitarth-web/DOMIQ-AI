/** @type {import('tailwindcss').Config} */
export default {
  important: '#landing-page',
  corePlugins: {
    preflight: false,
  },
  content: [
    "./index.html",
    "./landing/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#040404",
        hero: "#0A0A0A",      // Dark Black
        living: "#CC4A14",    // Burnt Orange
        bedroom: "#0D226B",   // Royal Blue
        kitchen: "#0F5132",   // Emerald Green
        bathroom: "#4A0059",  // Deep Purple
        blueprint: "#071124", // Dark Navy
        features: "#111111",
      },
      fontFamily: {
        sans: ['"Clash Display"', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '60px',
      },
      animation: {
        'scan': 'scan 3s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'float-slow': 'float 10s ease-in-out infinite',
        'steam': 'steam 8s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(0)', opacity: 0 },
          '10%': { opacity: 1 },
          '90%': { opacity: 1 },
          '100%': { transform: 'translateY(400px)', opacity: 0 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-20px) translateX(10px)' },
        },
        steam: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: 0.2 },
          '50%': { transform: 'translateY(-20px) scale(1.1)', opacity: 0.5 },
          '100%': { transform: 'translateY(-40px) scale(1.2)', opacity: 0 },
        }
      }
    },
  },
  plugins: [],
}
