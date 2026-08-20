"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Spinner, ErrorState } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";

type TutorialVideo = {
  id: number;
  title: string;
  youtube_url: string;
  sequence: number;
  is_active: boolean;
  video_id?: string;
  target_audience?: string;
  thumbnail_url?: string;
  embed_url?: string;
};

function extractYoutubeId(url: string) {
  if (!url) return "";
  const match = url.match(/(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return "";
}

function getThumbnailUrl(v: TutorialVideo) {
  if (v.thumbnail_url) return v.thumbnail_url;
  const vid = v.video_id || extractYoutubeId(v.youtube_url);
  if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  return "";
}

function getEmbedUrl(v: TutorialVideo) {
  if (v.embed_url) return v.embed_url;
  const vid = v.video_id || extractYoutubeId(v.youtube_url);
  if (vid) return `https://www.youtube.com/embed/${vid}`;
  return "";
}

export default function TutorialsPage() {
  const { t } = useLanguage();
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
        setError(e?.message || t("tut_err_load"));
        setLoading(false);
      });
  }, []);

  if (loading) return <Spinner label={t("tut_loading")} />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="vstack gap-3">
      <h1 className="h4 fw-bold text-brand mb-0">{t("tut_title")}</h1>
      {videos.length === 0 ? (
        <div className="text-secondary mt-3">{t("tut_no_tut")}</div>
      ) : (
        <div className="row g-3">
          {videos.map((v) => {
            const thumb = getThumbnailUrl(v);
            const vid = v.video_id || extractYoutubeId(v.youtube_url);

            return (
              <div className="col-md-6 col-lg-4" key={v.id}>
                <div 
                  className="card shadow-sm h-100 border-0 overflow-hidden" 
                  style={{ cursor: "pointer", transition: "transform 0.2s" }}
                  onClick={() => setActiveVideo(v)}
                >
                  <div
                    className="d-flex align-items-center justify-content-center bg-dark text-white position-relative overflow-hidden"
                    style={{ 
                      aspectRatio: "16/9", 
                      borderTopLeftRadius: "var(--radius, 0.5rem)", 
                      borderTopRightRadius: "var(--radius, 0.5rem)",
                    }}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={v.title}
                        className="position-absolute top-0 start-0 w-100 h-100"
                        style={{ objectFit: "cover" }}
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
                    <div 
                      className="position-absolute top-0 start-0 w-100 h-100 bg-dark" 
                      style={{ opacity: 0.35, zIndex: 1 }}
                    ></div>
                    <i 
                      className="bi bi-play-circle-fill position-relative text-white" 
                      style={{ fontSize: "3rem", zIndex: 2, textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}
                    ></i>
                  </div>
                  <div className="card-body">
                    <div className="fw-semibold">
                      {v.sequence}. {v.title}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
                    {getEmbedUrl(activeVideo) ? (
                      <iframe 
                        src={`${getEmbedUrl(activeVideo)}?autoplay=1`}
                        title={activeVideo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded"
                      ></iframe>
                    ) : (
                      <div className="d-flex align-items-center justify-content-center text-white">
                        <a href={activeVideo.youtube_url} target="_blank" rel="noreferrer" className="btn btn-brand">{t("tut_open_yt")}</a>
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
