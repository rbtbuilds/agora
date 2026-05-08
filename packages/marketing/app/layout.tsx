import type { Metadata } from "next";
import "./tailwind.css";

const SITE_URL =
  process.env.AGORA_MARKETING_URL ?? "https://marketing-six-kohl.vercel.app";

const TITLE = "Agora - The Open Protocol for Agent Commerce";
const DESCRIPTION =
  "The internet's missing commerce layer. Built for AI agents. Open for everyone. Search, cart, and checkout across any store with a single protocol.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Agora",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
          backgroundColor: "#050508",
          color: "#ffffff",
          margin: 0,
          padding: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
