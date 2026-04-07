/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#18181b",
        border: "#27272a",
        accent: "#a78bfa",
        "accent-dim": "#1e1b2e",
        "accent-border": "#2d2640",
        price: "#22c55e",
        secondary: "#a1a1aa",
      },
    },
  },
  plugins: [],
};
