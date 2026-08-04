"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const fetcher = (url: string) => api(url);

export function ServerMetrics() {
  const { data, error } = useSWR("/platform/metrics/", fetcher, {
    refreshInterval: 3000,
  });

  const [netSpeed, setNetSpeed] = useState({ sent: 0, recv: 0 });
  const [lastNet, setLastNet] = useState<{ sent: number; recv: number; time: number } | null>(null);

  useEffect(() => {
    if (data?.network) {
      const now = Date.now();
      if (lastNet) {
        const timeDiff = (now - lastNet.time) / 1000;
        if (timeDiff > 0) {
          setNetSpeed({
            sent: Math.max(0, (data.network.bytes_sent - lastNet.sent) / timeDiff),
            recv: Math.max(0, (data.network.bytes_recv - lastNet.recv) / timeDiff),
          });
        }
      }
      setLastNet({
        sent: data.network.bytes_sent,
        recv: data.network.bytes_recv,
        time: now,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (error) return <div className="text-danger small p-3">Failed to load server metrics.</div>;
  if (!data) return (
    <Card>
      <div className="placeholder-glow">
        <span className="placeholder col-4 mb-3 rounded"></span>
        <div className="row g-4">
          <div className="col-3"><span className="placeholder col-12 rounded" style={{ height: "40px" }}></span></div>
          <div className="col-3"><span className="placeholder col-12 rounded" style={{ height: "40px" }}></span></div>
          <div className="col-3"><span className="placeholder col-12 rounded" style={{ height: "40px" }}></span></div>
          <div className="col-3"><span className="placeholder col-12 rounded" style={{ height: "40px" }}></span></div>
        </div>
      </div>
    </Card>
  );

  return (
    <Card>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h2 className="h6 fw-bold mb-0 text-secondary">Server Resources</h2>
        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill animate-pulse" style={{ fontSize: '0.75rem' }}>
          <i className="bi bi-broadcast me-1"></i> Live
        </span>
      </div>

      <div className="row g-4">
        <div className="col-12 col-md-6 col-lg-3">
          <div className="text-secondary small mb-2 fw-medium">CPU Usage</div>
          <div className="d-flex align-items-center mb-2">
            <h3 className="h4 fw-bold mb-0 me-2 font-monospace">{data.cpu_percent.toFixed(1)}%</h3>
          </div>
          <div className="progress bg-secondary-subtle" style={{ height: "6px" }}>
            <div className={`progress-bar ${data.cpu_percent > 80 ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${data.cpu_percent}%`, transition: 'width 1s ease-in-out' }}></div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <div className="text-secondary small mb-2 fw-medium">RAM Usage</div>
          <div className="d-flex align-items-center mb-2">
            <h3 className="h4 fw-bold mb-0 me-2 font-monospace">{data.memory.percent.toFixed(1)}%</h3>
            <span className="text-secondary small">({formatBytes(data.memory.used)} / {formatBytes(data.memory.total)})</span>
          </div>
          <div className="progress bg-secondary-subtle" style={{ height: "6px" }}>
            <div className={`progress-bar ${data.memory.percent > 80 ? 'bg-danger' : 'bg-info'}`} style={{ width: `${data.memory.percent}%`, transition: 'width 1s ease-in-out' }}></div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <div className="text-secondary small mb-2 fw-medium">Storage</div>
          <div className="d-flex align-items-center mb-2">
            <h3 className="h4 fw-bold mb-0 me-2 font-monospace">{data.disk.percent.toFixed(1)}%</h3>
            <span className="text-secondary small">({formatBytes(data.disk.used)} / {formatBytes(data.disk.total)})</span>
          </div>
          <div className="progress bg-secondary-subtle" style={{ height: "6px" }}>
            <div className={`progress-bar ${data.disk.percent > 85 ? 'bg-danger' : 'bg-warning'}`} style={{ width: `${data.disk.percent}%`, transition: 'width 1s ease-in-out' }}></div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <div className="text-secondary small mb-2 fw-medium">Bandwidth & Traffic</div>
          <div className="d-flex justify-content-between align-items-center">
            <div className="font-monospace small">
              <div className="text-info fw-semibold"><i className="bi bi-arrow-down-short"></i> {formatBytes(netSpeed.recv)}/s</div>
              <div className="text-primary fw-semibold"><i className="bi bi-arrow-up-short"></i> {formatBytes(netSpeed.sent)}/s</div>
            </div>
            <div className="text-end">
              <div className="fs-3 fw-bold lh-1 text-primary">{data.active_visitors}</div>
              <div className="small text-secondary fw-medium">Active Now</div>
            </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(25, 135, 84, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(25, 135, 84, 0); }
          100% { box-shadow: 0 0 0 0 rgba(25, 135, 84, 0); }
        }
        .animate-pulse {
          animation: pulse-ring 2s infinite;
        }
      `}} />
    </Card>
  );
}
