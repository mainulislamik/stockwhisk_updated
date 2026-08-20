"use client";

import { useEffect, useState } from "react";
import ResellerShell from "@/components/ResellerShell";
import { api } from "@/lib/api";

type TutorialVideo = {
  id: number;
  title: string;
  youtube_url: string;
  sequence: number;
  video_id: string;
  target_audience?: string;
  thumbnail_url: string;
  embed_url: string;
};

export default function ResellerTutorialsPage() {
  const [videos, setVideos] = useState<TutorialVideo[] | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<TutorialVideo | null>(null);

  useEffect(() => {
    api<TutorialVideo[]>("/tutorials/")
      .then((res) => setVideos(res || []))
      .catch((e: any) => { setError(e?.message || "Failed to load tutorials"); setVideos([]); });
  }, []);

  return (
    <ResellerShell>
      <h3 className="fw-bold mb-1">Video Tutorials</h3>
      <p className="text-secondary mb-4">Learn how to make the most of StockWhisk and grow your partner earnings.</p>

      {error ? (
        <div className="alert alert-warning py-2">{error}</div>
      ) : !videos ? (
        <div className="text-center py-5"><span className="spinner-border" /></div>
      ) : videos.length === 0 ? (
        <div className="card border-0 shadow-sm"><div className="card-body text-center py-5 text-secondary">
          <div className="fs-1 mb-2">🎬</div>
          <div className="fw-semibold">No tutorials available at the moment.</div>
        </div></div>
      ) : (
        <div className="row g-3">
          {videos.map((v) => {
            const vid = v.video_id || (v.youtube_url?.match(/(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/)?.[1] || "");
            const thumb = v.thumbnail_url || (vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : "");
            return (
              <div className="col-md-6 col-lg-4" key={v.id}>
                <div className="card border-0 shadow-sm h-100" style={{ cursor: "pointer" }} onClick={() => setActive(v)}>
                  <div className="d-flex align-items-center justify-content-center bg-dark text-white position-relative overflow-hidden"
                    style={{
                      aspectRatio: "16/9", borderTopLeftRadius: ".5rem", borderTopRightRadius: ".5rem",
                    }}>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={v.title}
                        className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (vid && !target.src.includes("mqdefault")) {
                            target.src = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
                          } else if (vid && !target.src.includes("0.jpg")) {
                            target.src = `https://img.youtube.com/vi/${vid}/0.jpg`;
                          }
                        }}
                      />
                    ) : null}
                    <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark" style={{ opacity: 0.35, zIndex: 1 }} />
                    <i className="bi bi-play-circle-fill position-relative text-white" style={{ fontSize: "3rem", zIndex: 2, textShadow: "0 2px 8px rgba(0,0,0,.7)" }} />
                  </div>
                  <div className="card-body">
                    <div className="fw-semibold">{v.sequence}. {v.title}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {active && (
        <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.8)" }} tabIndex={-1} onClick={() => setActive(null)}>
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-dark border-0">
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title text-white">{active.title}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActive(null)} />
              </div>
              <div className="modal-body">
                <div className="ratio ratio-16x9 bg-black rounded">
                  {active.embed_url ? (
                    <iframe src={`${active.embed_url}?autoplay=1`} title={active.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen className="rounded" />
                  ) : (
                    <div className="d-flex align-items-center justify-content-center text-white">
                      <a href={active.youtube_url} target="_blank" rel="noreferrer" className="btn btn-primary">Open in YouTube</a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ResellerShell>
  );
}
