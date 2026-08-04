// "Login as shop" support. A super-admin can enter any shop with no password:
// the backend mints owner JWTs, we stash the admin's own tokens aside, swap in
// the owner tokens, and drop into /app. A banner then lets the admin switch back.
import { getAccess, getRefresh, setTokens } from "@/lib/api";

const ADMIN_ACCESS = "sw_admin_access";
const ADMIN_REFRESH = "sw_admin_refresh";
const FLAG = "sw_impersonating"; // stores the shop name while active

export function isImpersonating(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(FLAG);
}

export function impersonatingShop(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(FLAG) || "";
}

// Called from the platform "Login as" button with the backend's token response.
export function startImpersonation(tokens: { access: string; refresh: string; shop_name: string }) {
  const adminAccess = getAccess();
  const adminRefresh = getRefresh();
  if (adminAccess) localStorage.setItem(ADMIN_ACCESS, adminAccess);
  if (adminRefresh) localStorage.setItem(ADMIN_REFRESH, adminRefresh);
  setTokens(tokens.access, tokens.refresh);
  localStorage.setItem(FLAG, tokens.shop_name || "shop");
  window.location.href = "/app";
}

// Restore the admin's own session and go back to the platform dashboard.
export function returnToAdmin() {
  const access = localStorage.getItem(ADMIN_ACCESS);
  const refresh = localStorage.getItem(ADMIN_REFRESH);
  if (access) setTokens(access, refresh || undefined);
  localStorage.removeItem(ADMIN_ACCESS);
  localStorage.removeItem(ADMIN_REFRESH);
  localStorage.removeItem(FLAG);
  window.location.href = "/platform";
}
