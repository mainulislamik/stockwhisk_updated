// Thin fetch client for the Django REST API. The browser calls the backend
// directly at NEXT_PUBLIC_API_BASE (CORS is enabled on the backend). If the
// base is empty, calls are same-origin. JWT access/refresh tokens live in
// localStorage.

import useSWR from 'swr';

// Inlined at build time. In Docker this is set to the published backend origin.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

const ACCESS_KEY = "sw_access";
const REFRESH_KEY = "sw_refresh";

export function getAccess(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    super(typeof data === "string" ? data : data?.detail || "Request failed");
    this.status = status;
    this.data = data;
  }
}

async function refreshAccess(): Promise<string | null> {
  const refresh = getRefresh();
  if (!refresh) return null;
  const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = await res.json();
  setTokens(data.access);
  return data.access;
}

type Opts = {
  method?: string;
  body?: any;
  params?: Record<string, any>;
  raw?: boolean; // return the Response object (for blobs/files)
  _retried?: boolean;
};

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, params, raw } = opts;
  let url = API_BASE + (path.startsWith("/api") ? path : `/api${path}`);
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const s = qs.toString();
    if (s) url += (url.includes("?") ? "&" : "?") + s;
  }

  const headers: Record<string, string> = {};
  const access = getAccess();
  if (access) headers["Authorization"] = `Bearer ${access}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: payload });

  if (res.status === 401 && !opts._retried) {
    const newAccess = await refreshAccess();
    if (newAccess) return api<T>(path, { ...opts, _retried: true });
  }

  if (raw) return res as unknown as T;

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, data ?? text);
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// DRF PageNumberPagination shape
export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export function unwrap<T>(data: Paginated<T> | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

// The backend paginates lists at 25/page. Walk every page and concatenate.
// We rely on `next` only as a boolean (there is another page) — never its URL,
// which is an internal address the browser cannot reach through the proxy.
export async function fetchAll<T = any>(path: string, params: Record<string, any> = {}): Promise<T[]> {
  const firstData = await api<Paginated<T> | T[]>(path, { params: { ...params, page: 1 } });
  
  // If endpoint isn't paginated
  if (Array.isArray(firstData)) return firstData;
  
  const out: T[] = [...(firstData.results ?? [])];
  
  // If there's no next page, we are done
  if (!firstData.next || !firstData.count) return out;
  
  // Calculate how many pages remain
  const pageSize = firstData.results?.length || 25; // fallback to 25 if empty
  const totalPages = Math.ceil(firstData.count / pageSize);
  
  // Fetch remaining pages in parallel for massive performance boost
  if (totalPages > 1) {
    const promises = [];
    // Cap at 200 pages to prevent memory blowouts (5000 items)
    const limit = Math.min(totalPages, 200);
    
    for (let p = 2; p <= limit; p++) {
      promises.push(api<Paginated<T>>(path, { params: { ...params, page: p } }).catch(() => null));
    }
    
    const remainingData = await Promise.all(promises);
    remainingData.forEach(data => {
      if (data && data.results) {
        out.push(...data.results);
      }
    });
  }
  
  return out;
}

// --- SWR Caching Hooks (Advanced Technology) ---

const swrFetcher = (url: string) => api(url);

/**
 * useApi caches the standard API response using SWR.
 * It deduplicates requests, caches data in the browser, and revalidates in the background.
 */
export function useApi<T = any>(path: string | null, params?: Record<string, any>) {
  let key = path;
  if (path && params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const s = qs.toString();
    if (s) key = path + (path.includes("?") ? "&" : "?") + s;
  }

  const { data, error, mutate, isValidating } = useSWR<T>(key, swrFetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  return { data, error, loading: !data && !error, mutate, isValidating };
}

/**
 * useApiAll caches the parallel fetchAll algorithm using SWR.
 * Extremely fast for large lists like products/customers since it caches the aggregated result.
 */
export function useApiAll<T = any>(path: string | null, params?: Record<string, any>) {
  let key = path;
  if (path && params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const s = qs.toString();
    if (s) key = path + (path.includes("?") ? "&" : "?") + s;
  }

  const allKey = key ? `ALL::${key}` : null;
  const fetcher = () => fetchAll<T>(key!);

  const { data, error, mutate, isValidating } = useSWR<T[]>(allKey, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

  return { data, error, loading: !data && !error, mutate, isValidating };
}
