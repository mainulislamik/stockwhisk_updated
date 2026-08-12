import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stockwhisk.com";
// Server-side fetch needs an absolute base; fall back to the site origin.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || SITE_URL;

type BlogPost = {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  published_at?: string;
  updated_at?: string;
  cover_image_url?: string;
};

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_BASE}/api/platform/public/blogs/${slug}/`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function plainText(html: string, max = 160): string {
  const text = (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) {
    return { title: "Blog", robots: { index: false } };
  }
  const description = post.excerpt?.trim() || plainText(post.content);
  const url = `/blog/${post.slug}`;
  const images = post.cover_image_url ? [{ url: post.cover_image_url }] : undefined;
  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
      images,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at || post.published_at,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

export default async function BlogPostLayout(
  { children, params }: { children: React.ReactNode; params: { slug: string } }
) {
  const post = await getPost(params.slug);
  const jsonLd = post
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.excerpt?.trim() || plainText(post.content),
        image: post.cover_image_url || undefined,
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
        publisher: {
          "@type": "Organization",
          name: "StockWhisk",
          logo: { "@type": "ImageObject", url: `${SITE_URL}/opengraph-image` },
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
