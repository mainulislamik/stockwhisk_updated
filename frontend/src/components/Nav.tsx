"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";

type NavGroupProps = {
  id: string;
  icon: string;
  label: string;
  collapsed: boolean;
  openGroup: string;
  setGroup: (g: string) => void;
  children: React.ReactNode;
};

function NavGroup({ id, icon, label, collapsed, openGroup, setGroup, children }: NavGroupProps) {
  const open = openGroup === id;
  return (
    <div className="nav-group position-relative">
      <a
        role="button"
        onClick={() => setGroup(id)}
        title={label}
        className="nav-link d-flex align-items-center justify-content-between"
      >
        <span className="text-truncate">
          <i className={`bi ${icon}`}></i> {!collapsed && <span>{label}</span>}
        </span>
        {!collapsed && <i className={`bi ${open ? "bi-chevron-down" : "bi-chevron-right"}`}></i>}
      </a>
      <div
        className={`nav-children ${collapsed ? "" : "indent"}`}
        style={{ display: collapsed ? undefined : open ? "flex" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}

export default function Nav({
  collapsed,
  openGroup,
  setGroup,
}: {
  collapsed: boolean;
  openGroup: string;
  setGroup: (g: string) => void;
}) {
  const pathname = usePathname();
  const { can, isOwner, user } = useAuth();
  const { t } = useLanguage();
  
  const active = (href: string) => (pathname === href ? "active" : "");

  const Item = ({ href, icon, label }: { href: string; icon: string; label: string }) => (
    <Link href={href} title={label} className={`nav-link ${active(href)}`}>
      <i className={`bi ${icon}`}></i> {!collapsed && <span>{label}</span>}
    </Link>
  );

  const showPurchasing = isOwner || can("manage_purchasing");
  const showReports = (isOwner || can("view_reports")) && user?.shop_reports_enabled !== false;
  const showSalesRead = isOwner || can("view_sales");
  const showService = (isOwner || can("manage_service") || can("view_service")) && user?.shop_service_enabled !== false;
  const showFinance = (isOwner || can("manage_expenses") || can("view_profit") || can("view_reports")) && user?.shop_finance_enabled !== false;
  // POS is sale creation; product browse/lookup is separate (view_products).
  const showPOS = isOwner || can("create_sale");
  const showProductsRead = isOwner || can("view_products");   // list / lookup / barcodes
  const showProductMgmt = isOwner || can("manage_products");  // create / purchase products
  const showInventory = isOwner || can("view_inventory");
  const showProductsGroup = showProductsRead || showInventory || showProductMgmt || showPurchasing;
  const showCustomers = isOwner || can("view_customers") || can("manage_customers");
  const showSalesGroup = showSalesRead || showReports || can("process_return") || !!user?.shop_emi_enabled;

  return (
    <>
      {(isOwner || can("view_reports")) && <Item href="/app" icon="bi-speedometer2" label={t("nav_dashboard")} />}
      {showPOS && <Item href="/app/pos" icon="bi-cart3" label={t("nav_pos")} />}

      {showProductsGroup && (
        <NavGroup id="products" icon="bi-box-seam" label={t("nav_products")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          {showProductsRead && <Item href="/app/products" icon="bi-list-ul" label={t("nav_product_list")} />}
          {showProductMgmt && <Item href="/app/products/purchase" icon="bi-upc-scan" label={t("nav_purchase_product")} />}
          {showProductsRead && <Item href="/app/products/lookup" icon="bi-qr-code-scan" label={t("nav_item_lookup")} />}
          {showProductsRead && <Item href="/app/barcodes" icon="bi-upc" label={t("nav_barcodes")} />}
          {showInventory && <Item href="/app/inventory" icon="bi-boxes" label={t("nav_inventory_stock")} />}
          {showPurchasing && (
            <>
              <Item href="/app/suppliers" icon="bi-truck" label={t("nav_suppliers")} />
              <Item href="/app/purchases" icon="bi-box-arrow-in-down" label={t("nav_purchases")} />
            </>
          )}
        </NavGroup>
      )}

      {showSalesGroup && (
      <NavGroup id="sales" icon="bi-receipt" label={t("nav_sales")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
        {showSalesRead && <Item href="/app/sales" icon="bi-receipt-cutoff" label={t("nav_invoices")} />}
        {(isOwner || can("process_return")) && <Item href="/app/sales/returns" icon="bi-arrow-return-left" label={t("nav_returns")} />}
        {user?.shop_emi_enabled && (
          <Item href="/app/emi" icon="bi-calendar-check" label={t("nav_emi_mgmt")} />
        )}
        {showReports && <Item href="/app/sales/products" icon="bi-list-check" label={t("nav_sold_products")} />}
        {showSalesRead && <Item href="/app/sales/details" icon="bi-card-list" label={t("nav_selling_details")} />}
      </NavGroup>
      )}

      {showCustomers && (
        <NavGroup id="customers" icon="bi-people" label={t("nav_customers")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          <Item href="/app/customers" icon="bi-person-lines-fill" label={t("nav_customer_list")} />
          <Item href="/app/dues" icon="bi-cash-coin" label={t("nav_dues")} />
        </NavGroup>
      )}

      {showService && (
        <NavGroup id="service" icon="bi-tools" label={t("nav_service")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          <Item href="/app/service/tickets" icon="bi-wrench-adjustable" label={t("nav_repair_tickets")} />
          <Item href="/app/service/warranties" icon="bi-shield-check" label={t("nav_warranties")} />
          <Item href="/app/service/warranty-coverage" icon="bi-shield-shaded" label={t("nav_warranty_coverage")} />
        </NavGroup>
      )}

      {showReports && <Item href="/app/reports" icon="bi-graph-up" label={t("nav_reports")} />}

      {showFinance && (
        <NavGroup id="finance" icon="bi-bank" label={t("nav_finance")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          {(isOwner || can("manage_expenses")) && <Item href="/app/expenses" icon="bi-cash-stack" label={t("nav_expenses")} />}
          {(isOwner || can("view_profit")) && (
            <>
              <Item href="/app/accounting" icon="bi-calculator" label={t("nav_accounting")} />
              <Item href="/app/accounting/settlement" icon="bi-journal-check" label={t("nav_daily_settlement")} />
            </>
          )}
        </NavGroup>
      )}

      <NavGroup id="admin" icon="bi-sliders" label={t("nav_admin")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
        <Item href="/app/notifications" icon="bi-bell" label={t("nav_notifications")} />
        <Item href="/app/tutorials" icon="bi-play-btn" label={t("nav_video_tutorials")} />
        {(isOwner || can("manage_users")) && <Item href="/app/users" icon="bi-key" label={t("nav_users_roles")} />}
        <Item href="/app/settings" icon="bi-gear" label={t("nav_settings")} />
      </NavGroup>
    </>
  );
}
