"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, PageHeader, Spinner, ErrorState } from "@/components/ui";

export default function BlogEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.slug === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (isNew) return;
    
    api<any>(`/platform/blogs/${params.slug}/`)
      .then((data) => {
        setTitle(data.title || "");
        setSlug(data.slug || "");
        setContent(data.content || "");
        setExcerpt(data.excerpt || "");
        setCoverImageUrl(data.cover_image_url || "");
        setIsPublished(data.is_published || false);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || "Failed to load blog.");
        setLoading(false);
      });
  }, [isNew, params.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const payload = {
      title,
      slug,
      content,
      excerpt,
      cover_image_url: coverImageUrl,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
    };

    try {
      if (isNew) {
        await api("/platform/blogs/", { method: "POST", body: payload });
      } else {
        await api(`/platform/blogs/${params.slug}/`, { method: "PUT", body: payload });
      }
      router.push("/platform/blogs");
    } catch (err: any) {
      alert(err?.message || "Failed to save blog post.");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState error={error} />;
  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader 
        title={isNew ? "Create Blog Post" : "Edit Blog Post"} 
        actions={
          <button onClick={() => router.push("/platform/blogs")} className="btn btn-outline-secondary">
            ← Back
          </button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label">Title</label>
              <input 
                type="text" 
                className="form-control" 
                required 
                value={title} 
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (isNew) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                  }
                }} 
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Slug (URL)</label>
              <input 
                type="text" 
                className="form-control" 
                required 
                value={slug} 
                onChange={(e) => setSlug(e.target.value)} 
              />
            </div>
            
            <div className="col-12">
              <label className="form-label">Cover Image URL (Optional)</label>
              <input 
                type="url" 
                className="form-control" 
                value={coverImageUrl} 
                onChange={(e) => setCoverImageUrl(e.target.value)} 
              />
            </div>

            <div className="col-12">
              <label className="form-label">Excerpt (Short summary)</label>
              <textarea 
                className="form-control" 
                rows={2}
                value={excerpt} 
                onChange={(e) => setExcerpt(e.target.value)} 
              />
            </div>
            
            <div className="col-12">
              <label className="form-label">Content (Markdown supported)</label>
              <textarea 
                className="form-control font-monospace" 
                rows={15}
                required
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                style={{ fontSize: '0.9rem' }}
              />
            </div>

            <div className="col-12">
              <div className="form-check form-switch mt-2">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="publishSwitch" 
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="publishSwitch">
                  Publish immediately
                </label>
              </div>
            </div>

            <div className="col-12 mt-4 text-end">
              <button type="submit" className="btn btn-brand px-4" disabled={saving}>
                {saving ? "Saving..." : "Save Blog Post"}
              </button>
            </div>
          </div>
        </form>
      </Card>
    </>
  );
}
