"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

export type Branding = { logo: string | null; favicon: string | null; industryImages: Record<string, string> };

let cache: Branding | null = null;
let inflight: Promise<Branding> | null = null;

function fetchBranding(): Promise<Branding> {
  if (!inflight) {
    inflight = api<any>("/platform/public/site-config/")
      .then((d) => ({ logo: d?.logo ?? null, favicon: d?.favicon ?? null, industryImages: d?.industry_images ?? {} }))
      .catch(() => ({ logo: null, favicon: null, industryImages: {} }));
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
  const [b, setB] = useState<Branding>(cache || { logo: null, favicon: null, industryImages: {} });
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
