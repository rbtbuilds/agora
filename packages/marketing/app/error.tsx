"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
      <div style={{ fontSize: 14, color: "#71717a", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "1rem" }}>
        Something broke
      </div>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
        Unexpected error
      </h1>
      <p style={{ color: "#a1a1aa", maxWidth: 480, marginBottom: "2rem", lineHeight: 1.6 }}>
        We logged the error and are looking into it. Try the page again, or come back in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: "0.75rem 1.5rem",
          background: "#a78bfa",
          color: "#0a0a0a",
          border: "none",
          borderRadius: 8,
          fontSize: "0.95rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
      {error.digest && (
        <p style={{ marginTop: "2rem", fontFamily: "monospace", fontSize: 12, color: "#52525b" }}>
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
