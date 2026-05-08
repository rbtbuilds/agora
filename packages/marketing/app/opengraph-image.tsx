import { ImageResponse } from "next/og";

export const alt = "Agora — The Open Protocol for Agent Commerce";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#050508",
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(167,139,250,0.18), transparent 60%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#a1a1aa",
            fontSize: 24,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#a78bfa",
            }}
          />
          Protocol v1.0
        </div>
        <div
          style={{
            fontSize: 144,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "#ffffff",
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          Agora
        </div>
        <div
          style={{
            fontSize: 40,
            color: "#e5e5e5",
            lineHeight: 1.25,
            maxWidth: 900,
          }}
        >
          The internet&apos;s missing commerce layer.
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#a1a1aa",
            lineHeight: 1.25,
            marginTop: 8,
          }}
        >
          Built for AI agents. Open for everyone.
        </div>
      </div>
    ),
    size,
  );
}
