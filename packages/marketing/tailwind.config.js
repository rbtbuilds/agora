/** @type {import('tailwindcss').Config} */
// Source of truth for design tokens. Mirror in packages/portal/tailwind.config.js.
module.exports = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surface stack
        bg: "#050508",
        surface: "#0f0f12",
        border: "#1a1a1f",
        // Accent
        accent: "#a78bfa",
        "accent-dim": "#1e1b2e",
        "accent-border": "#2d2640",
        // Text
        secondary: "#a1a1aa",
        // Status
        price: "#22c55e",
      },
      fontFamily: {
        mono: ["'SF Mono'", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
