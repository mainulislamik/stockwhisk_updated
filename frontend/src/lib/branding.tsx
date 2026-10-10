"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

const DEFAULT_LOGO = "/logo_simple.svg";
const DEFAULT_FAVICON = "/logo_32.png";

export type Branding = { logo: string | null; favicon: string | null; industryImages: Record<string, string> };

let cache: Branding | null = { logo: DEFAULT_LOGO, favicon: DEFAULT_FAVICON, industryImages: {} };
let inflight: Promise<Branding> | null = null;

function normalizeUrl(u: string | null): string | null {
  if (!u) return null;
  if (typeof window !== "undefined" && window.location.protocol === "https:" && u.startsWith("http://")) {
    return u.replace(/^http:\/\//i, "https://");
  }
  return u;
}

function fetchBranding(): Promise<Branding> {
  if (!inflight) {
    inflight = api<any>("/platform/public/site-config/")
      .then((d) => ({
        logo: normalizeUrl(d?.logo) || DEFAULT_LOGO,
        favicon: normalizeUrl(d?.favicon) || DEFAULT_FAVICON,
        industryImages: d?.industry_images ?? {},
      }))
      .catch(() => ({ logo: DEFAULT_LOGO, favicon: DEFAULT_FAVICON, industryImages: {} }));
  }
  return inflight;
}

function applyFavicon(href: string) {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Platform logo + favicon set by the super admin in Platform Settings. */
export function useBranding(): Branding {
  const [b, setB] = useState<Branding>(cache || { logo: DEFAULT_LOGO, favicon: DEFAULT_FAVICON, industryImages: {} });
  useEffect(() => {
    let alive = true;
    fetchBranding().then((res) => {
      cache = res;
      if (alive) setB(res);
      if (res.favicon) applyFavicon(res.favicon);
    });
    return () => { alive = false; };
  }, []);
  return b;
}
