import type { NextConfig } from "next";

const apiUrl = process.env.AGORA_PUBLIC_URL ?? "https://agora-ecru-chi.vercel.app";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Content-Security-Policy",
          value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' ${apiUrl} https://api.stripe.com; frame-src https://js.stripe.com`,
        },
      ],
    },
  ],
};
export default nextConfig;
