import type { MetadataRoute } from "next";
import { ensureAdminTables, getSql } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://jewelrydept.co";
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/reviews`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/policies/shipping`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/policies/returns`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/policies/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/policies/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
  try {
    await ensureAdminTables();
    const products = await getSql()`SELECT id, updated_at FROM jd_products WHERE active = TRUE ORDER BY id`;
    return [...staticPages, ...products.map(product => ({
      url: `${base}/products/${Number(product.id)}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))];
  } catch {
    return staticPages;
  }
}
