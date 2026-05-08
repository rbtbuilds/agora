import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.AGORA_MARKETING_URL ?? "https://marketing-six-kohl.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
