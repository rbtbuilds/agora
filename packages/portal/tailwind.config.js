/** @type {import('tailwindcss').Config} */
// Mirrors packages/marketing/tailwind.config.js. Treat marketing as the
// design bible — keep these in sync.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#050508",
        surface: "#0f0f12",
        border: "#1a1a1f",
        accent: "#a78bfa",
        "accent-dim": "#1e1b2e",
        "accent-border": "#2d2640",
        secondary: "#a1a1aa",
        price: "#22c55e",
      },
      fontFamily: {
        mono: ["'SF Mono'", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
