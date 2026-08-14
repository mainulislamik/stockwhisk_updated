"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearTokens, getAccess, setTokens } from "@/lib/api";

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string; // "owner" | "manager" | "cashier" | ...
  shop: number | null;
  shop_name: string | null;
  shop_code: string | null;
  shop_phone: string | null;
  shop_logo: string | null;
  shop_emi_enabled: boolean;
  shop_delivery_enabled?: boolean;
  shop_whatsapp_enabled?: boolean;
  shop_is_demo?: boolean;
  shop_barcode_prefix?: string;
  branch: number | null;
  is_staff: boolean;
};

export type BillingStatus = {
  plan: string | null;
  plan_name?: string | null;
  state?: "trial" | "paid" | "expired" | "none";
  days_left?: number;
  ends_at?: string | null;
  current_period_end?: string | null;
  on_trial: boolean;
  trial_ends_at: string | null;
  status: string | null;
};

type AuthState = {
  user: User | null;
  perms: Set<string>;
  billing: BillingStatus | null;
  loading: boolean;
  isOwner: boolean;
  can: (perm: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reload: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!getAccess()) {
      setUser(null);
      setPerms(new Set());
      setLoading(false);
      return;
    }
    // Fetch the profile with a few retries so a transient hiccup — a rate-limit
    // 429 during rapid reloads, a brief 5xx, a network blip — never nukes the
    // session and bounces the user to /login. Only a real auth rejection does.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const me = await api<User>("/auth/me/");
        setUser(me);
        try {
          const p = await api<{ role: string; permissions: string[] }>("/auth/my-permissions/");
          setPerms(new Set(p.permissions || []));
        } catch {
          setPerms(new Set());
        }
        try {
          const b = await api<BillingStatus>("/billing/status/");
          setBilling(b);
        } catch {
          setBilling(null);
        }
        setLoading(false);
        return;
      } catch (e: any) {
        const status = e?.status;
        if (status === 401 || status === 403) {
          // Genuine auth failure (refresh already attempted inside api()).
          clearTokens();
          setUser(null);
          setPerms(new Set());
          setLoading(false);
          return;
        }
        // Transient — back off and retry. Keep tokens intact either way.
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }
    // Retries exhausted on transient errors: do NOT clear tokens, so a reload
    // recovers once the burst passes. We just couldn't load the profile now.
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ access: string; refresh: string }>("/auth/token/", {
        method: "POST",
        body: { email, password },
      });
      setTokens(data.access, data.refresh);
      setLoading(true);
      await loadProfile();
    },
    [loadProfile]
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setPerms(new Set());
    setBilling(null);
    if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const isOwner = user?.role === "owner";
  const can = useCallback(
    (perm: string) => isOwner || perms.has(perm),
    [isOwner, perms]
  );

  return (
    <Ctx.Provider value={{ user, perms, billing, loading, isOwner, can, login, logout, reload: loadProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
