"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Spinner, ErrorState } from "@/components/ui";

type TutorialVideo = {
  id: number;
  title: string;
  youtube_url: string;
  sequence: number;
  video_id: string;
  thumbnail_url: string;
  embed_url: string;
};

export default function TutorialsPage() {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeVideo, setActiveVideo] = useState<TutorialVideo | null>(null);

  useEffect(() => {
    api<TutorialVideo[]>("/tutorials/")
      .then((res) => {
        setVideos(res || []);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e?.message || "Failed to load tutorials");
        setLoading(false);
      });
  }, []);

  if (loading) return <Spinner label="Loading tutorials…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <h1 className="h4 fw-bold text-brand mb-0">Video tutorials</h1>
      {videos.length === 0 ? (
        <div className="text-secondary mt-3">No tutorials available at the moment.</div>
      ) : (
        <div className="row g-3">
          {videos.map((v) => (
            <div className="col-md-6 col-lg-4" key={v.id}>
              <div 
                className="card shadow-sm h-100" 
                style={{ cursor: "pointer" }}
                onClick={() => setActiveVideo(v)}
              >
                <div
                  className="d-flex align-items-center justify-content-center bg-brand text-white position-relative"
                  style={{ 
                    aspectRatio: "16/9", 
                    borderTopLeftRadius: "var(--radius)", 
                    borderTopRightRadius: "var(--radius)",
                    backgroundImage: v.thumbnail_url ? `url(${v.thumbnail_url})` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}
                >
                  <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark" style={{ opacity: 0.4, borderTopLeftRadius: "var(--radius)", borderTopRightRadius: "var(--radius)" }}></div>
                  <i className="bi bi-play-circle-fill position-relative" style={{ fontSize: "3rem", zIndex: 1, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}></i>
                </div>
                <div className="card-body">
                  <div className="fw-semibold">
                    {v.sequence}. {v.title}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Modal */}
      {activeVideo && (
        <>
          <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.8)" }} tabIndex={-1} onClick={() => setActiveVideo(null)}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={e => e.stopPropagation()}>
              <div className="modal-content bg-dark border-0">
                <div className="modal-header border-bottom-0 pb-0">
                  <h5 className="modal-title text-white">{activeVideo.title}</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveVideo(null)}></button>
                </div>
                <div className="modal-body">
                  <div className="ratio ratio-16x9 bg-black rounded">
                    {activeVideo.embed_url ? (
                      <iframe 
                        src={`${activeVideo.embed_url}?autoplay=1`}
                        title={activeVideo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded"
                      ></iframe>
                    ) : (
                      <div className="d-flex align-items-center justify-content-center text-white">
                        <a href={activeVideo.youtube_url} target="_blank" rel="noreferrer" className="btn btn-brand">Open in YouTube</a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
