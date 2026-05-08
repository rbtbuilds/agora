/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0f0f12",
        border: "#1a1a1f",
        accent: "#a78bfa",
        "accent-dim": "#1e1b2e",
        // Bumped from #71717a to #a1a1aa so body text reaches WCAG AA against
        // the #050508 background (was ~4.3:1, now ~9.6:1; with /70 modifier
        // ~5.0:1, still passes AA for body copy).
        secondary: "#a1a1aa",
      },
      fontFamily: {
        mono: ["'SF Mono'", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
