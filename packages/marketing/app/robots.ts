import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.AGORA_MARKETING_URL ?? "https://marketing-six-kohl.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
