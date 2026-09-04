"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { confirmAction, showError, showSuccess, showInfo } from "@/lib/dialogs";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, unwrap } from "@/lib/api";
import { Card, EmptyRow, ErrorState, PageHeader, Spinner } from "@/components/ui";
import toast from "react-hot-toast";

type BlogPost = {
  id: number;
  title: string;
  slug: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

export default function BlogsAdminPage() {
  const { lang, t } = useLanguage();
  const [blogs, setBlogs] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState("");

  const fetchBlogs = () => {
    api<any>("/platform/blogs/")
      .then((data) => setBlogs(unwrap(data)))
      .catch((e) => setError(e?.message || "Failed to load blogs."));
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const deleteBlog = async (slug: string, title: string) => {
    if (!(await confirmAction(`Are you sure you want to delete "${title}"?`))) return;
    try {
      await api(`/platform/blogs/${slug}/`, { method: "DELETE" });
      fetchBlogs();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete blog.");
    }
  };

  if (error) return <ErrorState error={error} />;
  if (!blogs) return <Spinner />;

  return (
    <>
      <PageHeader 
        title="Marketing Blogs" 
        actions={
          <Link href="/platform/blogs/new" className="btn btn-brand">
            + New Blog Post
          </Link>
        }
      />

      <Card body={false}>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="thead-1">
              <tr>
                <th>{lang === "bn" ? "শিরোনাম" : "Title"}</th>
                <th>setStatus</th>
                <th>{lang === "bn" ? "প্রকাশের তারিখ" : "Published At"}</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {blogs.length === 0 && <EmptyRow cols={4} />}
              {blogs.map((b) => (
                <tr key={b.id}>
                  <td className="fw-semibold">{b.title}</td>
                  <td>
                    {b.is_published 
                      ? <span className="badge bg-success">Published</span> 
                      : <span className="badge bg-secondary">Draft</span>}
                  </td>
                  <td>{b.published_at ? new Date(b.published_at).toLocaleString() : "—"}</td>
                  <td className="text-end">
                    <Link href={`/platform/blogs/${b.slug}`} className="btn btn-sm btn-link text-decoration-none p-0 me-3">
                      Edit
                    </Link>
                    <button 
                      className="btn btn-sm btn-link text-danger text-decoration-none p-0"
                      onClick={() => deleteBlog(b.slug, b.title)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
