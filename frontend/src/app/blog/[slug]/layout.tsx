import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stockwhisk.com";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || SITE_URL;

// Server-side metadata for each blog post — fetched fresh from the public API.
// Falls back to sensible defaults if the API is unreachable during build.
async function getPost(slug: string): Promise<{ title?: string; excerpt?: string; content?: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_BASE}/api/platform/public/blogs/${slug}/`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function stripMd(md: string | undefined): string {
  if (!md) return "";
  return md
    .replace(/[#*`>\-\[\]()!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  const title = post?.title || "Blog Post";
  const desc = (post?.excerpt && stripMd(post.excerpt).slice(0, 158)) || (stripMd(post?.content).slice(0, 158)) || "Guides and tips on inventory management, POS and retail growth from StockWhisk.";

  return {
    title,
    description: desc,
    alternates: { canonical: `/blog/${params.slug}` },
    openGraph: {
      title,
      description: desc,
      url: `/blog/${params.slug}`,
      type: "article",
    },
  };
}

export default function BlogPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
