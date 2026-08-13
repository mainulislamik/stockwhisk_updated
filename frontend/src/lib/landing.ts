/**
 * Permission-based landing-page resolver.
 *
 * After login (and when an unauthorized user hits the dashboard directly) we must
 * send the user to the first page they are actually allowed to use — never to a
 * page that will 403. The dashboard itself stays protected server-side by the
 * `view_reports` permission; this only decides *where to point the user*.
 *
 * Priority mirrors the sidebar order and uses the real RBAC codes from
 * `accounts/rbac.py` (`PERMISSION_CATALOG`). First match wins.
 */

export type PermCheck = { isOwner: boolean; can: (code: string) => boolean };

// [permission code, route the code actually unlocks]. Owners implicitly hold
// every permission, so they resolve to the dashboard.
const LANDING_PRIORITY: ReadonlyArray<readonly [string, string]> = [
  ["view_reports", "/app"],                        // Analytics dashboard
  ["create_sale", "/app/pos"],                     // POS / sales
  ["manage_products", "/app/products"],            // Catalog
  ["view_inventory", "/app/inventory"],            // Inventory & stock
  ["manage_purchasing", "/app/purchases"],         // Purchasing
  ["manage_customers", "/app/customers"],          // CRM
  ["manage_service", "/app/service/tickets"],      // Service (manage)
  ["view_service", "/app/service/warranty-coverage"], // Service (view only)
  ["manage_expenses", "/app/expenses"],            // Finance
  ["view_profit", "/app/accounting"],              // Accounting
];

/**
 * Safe fallback for an authenticated user with no module permission: the
 * account/settings page, whose profile section every user can access (it reads
 * `/auth/me/`, which is not RBAC-gated). Never 403s.
 */
export const SAFE_FALLBACK = "/app/settings";

/** Resolve the best landing route for a user given their permission checker. */
export function getLandingPath({ isOwner, can }: PermCheck): string {
  if (isOwner) return "/app";
  for (const [code, route] of LANDING_PRIORITY) {
    if (can(code)) return route;
  }
  return SAFE_FALLBACK;
}
