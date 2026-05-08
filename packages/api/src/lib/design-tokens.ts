// Shared design tokens for HTML responses served from the API (landing,
// playground, approval flow). Mirrors packages/marketing/tailwind.config.js.

export const DESIGN_TOKENS_CSS = `
  :root {
    --bg: #050508;
    --surface: #0f0f12;
    --border: #1a1a1f;
    --accent: #a78bfa;
    --accent-soft: #c4b5fd;
    --accent-dim: #1e1b2e;
    --accent-border: #2d2640;
    --secondary: #a1a1aa;
    --secondary-dim: #71717a;
    --text: #e5e5e5;
    --status-ok: #22c55e;
    --status-ok-bg: #052e16;
    --danger: #ef4444;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'SF Mono', SFMono-Regular, Consolas, monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }
  @keyframes agora-pulse-dot {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.4; }
  }
  @keyframes agora-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
  }
`;
