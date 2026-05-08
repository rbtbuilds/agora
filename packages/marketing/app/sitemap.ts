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
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-05-08"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date("2026-05-08"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
