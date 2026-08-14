import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stockwhisk.com";
// Server-side fetch needs an absolute base; fall back to the site origin when
// NEXT_PUBLIC_API_BASE is unset (same-origin /api deployment).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || SITE_URL;

type BlogPost = { slug: string; published_at?: string; updated_at?: string };

// Revalidate the sitemap hourly so newly published blogs show up without a redeploy.
export const revalidate = 3600;

async function getBlogPosts(): Promise<BlogPost[]> {
  // Hard timeout so a build-time fetch (backend not reachable during
  // `docker build`) fails fast instead of hanging past Next's 60s static-page
  // timeout and breaking the whole build. ISR (revalidate) fills blogs at runtime.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_BASE}/api/platform/public/blogs/`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data?.results ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];

  const posts = await getBlogPosts();
  const blogPages: MetadataRoute.Sitemap = posts
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updated_at || p.published_at ? new Date(p.updated_at || p.published_at!) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [...staticPages, ...blogPages];
}
