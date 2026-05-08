import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#050508",
        color: "#e5e5e5",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        padding: "0 1.5rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: "monospace", fontSize: 14, color: "#71717a", letterSpacing: "0.18em", marginBottom: "1rem" }}>
        404
      </div>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
        Page not found
      </h1>
      <p style={{ color: "#a1a1aa", maxWidth: 440, marginBottom: "2rem", lineHeight: 1.6 }}>
        The page you&apos;re looking for has moved or doesn&apos;t exist.
      </p>
      <Link
        href="/"
        style={{
          padding: "0.75rem 1.5rem",
          background: "#a78bfa",
          color: "#0a0a0a",
          borderRadius: 8,
          fontSize: "0.95rem",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Back to home
      </Link>
    </div>
  );
}
