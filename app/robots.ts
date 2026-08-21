import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] },
    ],
    sitemap: "https://jewelrydept.co/sitemap.xml",
    host: "https://jewelrydept.co",
  };
}
