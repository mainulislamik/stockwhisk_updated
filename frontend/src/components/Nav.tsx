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
  const { can, isOwner, user, hasModule } = useAuth();
  const { t, lang } = useLanguage();
  
  const active = (href: string) => (pathname === href ? "active" : "");

  const Item = ({ href, icon, label, external }: { href: string; icon: string; label: string; external?: boolean }) => {
    if (external || href.endsWith(".html")) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" title={label} className="nav-link">
          <i className={`bi ${icon}`}></i> {!collapsed && <span>{label}</span>}
        </a>
      );
    }
    return (
      <Link href={href} title={label} className={`nav-link ${active(href)}`}>
        <i className={`bi ${icon}`}></i> {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  const showPOS = (isOwner || can("create_sale")) && hasModule("core_pos");
  const showProductsRead = (isOwner || can("view_products")) && hasModule("inventory_basic");
  const showProductMgmt = (isOwner || can("manage_products")) && hasModule("inventory_basic");
  const showInventory = (isOwner || can("view_inventory")) && hasModule("inventory_basic");
  const showPurchasing = (isOwner || can("manage_purchasing")) && hasModule("purchasing");
  const showProductsGroup = showProductsRead || showInventory || showProductMgmt;

  const showSalesRead = (isOwner || can("view_sales")) && hasModule("sales_crm");
  const showReports = (isOwner || can("view_reports")) && hasModule("reports_export");
  const showEMI = (isOwner || can("view_sales")) && hasModule("emi_installments");
  const showSalesGroup = showSalesRead || showReports || can("process_return") || showEMI;

  const showCustomers = (isOwner || can("view_customers") || can("manage_customers")) && hasModule("sales_crm");
  const showManufacturing = (isOwner || can("manage_inventory") || can("view_inventory")) && hasModule("manufacturing");
  const showService = (isOwner || can("manage_service") || can("view_service")) && (hasModule("service_repair") || hasModule("mobile_repair_pos"));
  
  const showExpenses = (isOwner || can("manage_expenses")) && hasModule("expense_management");
  const showAccounting = (isOwner || can("view_profit")) && hasModule("finance_accounting");
  const showFinance = showExpenses || showAccounting;
  const showIntegrations = (isOwner || can("view_integrations") || can("manage_integrations")) && hasModule("integrations");
  const showBackups = (isOwner || can("manage_settings")) && hasModule("backup_drive");

  return (
    <>
      {(isOwner || can("view_reports")) && <Item href="/app" icon="bi-speedometer2" label={t("nav_dashboard")} />}
      {showPOS && <Item href="/app/pos" icon="bi-cart3" label={t("nav_pos")} />}
      {user?.shop_business_type === "printing" && (
        <Item href="/app/service/jobs" icon="bi-printer-fill" label="🖨️ সেবা ও জব টোকেন" />
      )}

      {showProductsGroup && (
        <NavGroup id="products" icon="bi-box-seam" label={t("nav_products")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          {showProductsRead && <Item href="/app/products" icon="bi-list-ul" label={t("nav_product_list")} />}
          {showProductMgmt && <Item href="/app/products/purchase" icon="bi-upc-scan" label={t("nav_purchase_product")} />}
          {showProductsRead && <Item href="/app/products/lookup" icon="bi-qr-code-scan" label={t("nav_item_lookup")} />}
          {showProductsRead && <Item href="/app/barcodes" icon="bi-upc" label={t("nav_barcodes")} />}
          {showInventory && <Item href="/app/inventory" icon="bi-boxes" label={t("nav_inventory_stock")} />}
        </NavGroup>
      )}

      {showPurchasing && (
        <NavGroup id="purchasing" icon="bi-truck" label={lang === "bn" ? "ক্রয় ও সরবরাহকারী" : (t("nav_purchases") || "Purchasing & Suppliers")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          <Item href="/app/suppliers" icon="bi-people" label={t("nav_suppliers") || (lang === "bn" ? "সাপ্লায়ার তালিকা" : "Suppliers")} />
          <Item href="/app/purchases" icon="bi-box-arrow-in-down" label={t("nav_purchases") || (lang === "bn" ? "ক্রয় ইনভয়েস" : "Purchase Invoices")} />
          {showProductMgmt && <Item href="/app/products/purchase" icon="bi-upc-scan" label={t("nav_purchase_product") || (lang === "bn" ? "বারকোড দিয়ে ক্রয়" : "Quick Scan Purchase")} />}
        </NavGroup>
      )}

      {showSalesGroup && (
      <NavGroup id="sales" icon="bi-receipt" label={t("nav_sales")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
        {showSalesRead && <Item href="/app/sales" icon="bi-receipt-cutoff" label={t("nav_invoices")} />}
        {(isOwner || can("process_return")) && <Item href="/app/sales/returns" icon="bi-arrow-return-left" label={t("nav_returns")} />}
        {showEMI && (
          <Item href="/app/emi" icon="bi-calendar-check" label={lang === "bn" ? "ইএমআই ও কিস্তি" : (t("nav_emi_mgmt") || "EMI & Installments")} />
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

      {showManufacturing && (
        <NavGroup id="manufacturing" icon="bi-gear-wide-connected" label={t("nav_manufacturing")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          <Item href="/app/manufacturing" icon="bi-kanban" label={t("nav_mfg_hub")} />
          <Item href="/app/manufacturing/new" icon="bi-plus-circle" label={t("nav_mfg_new")} />
        </NavGroup>
      )}

      {showService && (
        <NavGroup id="service" icon="bi-tools" label={lang === "bn" ? "সার্ভিস ও মেরামত" : (t("nav_service") || "Service & Repairs")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          {user?.shop_business_type === "printing" && (
            <Item href="/app/service/jobs" icon="bi-printer-fill" label="প্রিন্ট ও সেবা জব শিট" />
          )}
          <Item href="/app/service/tickets" icon="bi-wrench-adjustable" label={t("nav_repair_tickets") || (lang === "bn" ? "মেরামত টিকেট" : "Repair Tickets")} />
          <Item href="/app/service/warranties" icon="bi-shield-check" label={t("nav_warranties") || (lang === "bn" ? "ওয়ারেন্টি তালিকা" : "Warranties")} />
          <Item href="/app/service/warranty-coverage" icon="bi-shield-shaded" label={t("nav_warranty_coverage") || (lang === "bn" ? "ওয়ারেন্টি কভারেজ" : "Coverage Lookup")} />
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

      {showIntegrations && (
        <NavGroup id="integrations" icon="bi-diagram-3" label={lang === "bn" ? "ই-কমার্স ও কুরিয়ার" : (t("nav_integrations") || "Integrations")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          <Item href="/app/integrations" icon="bi-grid-1x2" label={lang === "bn" ? "ইন্টিগ্রেশন ড্যাশবোর্ড" : (t("nav_integrations_dashboard") || "Dashboard")} />
          <Item href="/app/integrations/websites" icon="bi-globe2" label={lang === "bn" ? "ওয়েবসাইট ও শপ" : (t("nav_integrations_websites") || "Websites")} />
          <Item href="/app/integrations/couriers" icon="bi-truck" label={lang === "bn" ? "কুরিয়ার সার্ভিস" : (t("nav_integrations_couriers") || "Couriers")} />
          <Item href="/app/integrations/mappings" icon="bi-arrow-left-right" label={lang === "bn" ? "প্রোডাক্ট ম্যাপিং" : (t("nav_integrations_mappings") || "Product Mapping")} />
          <Item href="/app/integrations/events" icon="bi-activity" label={lang === "bn" ? "সিঙ্ক ও ইভেন্ট লগ" : (t("nav_integrations_events") || "Sync Logs")} />
          <Item href="/api-docs.html" icon="bi-code-slash" label={lang === "bn" ? "ডেভেলপার API ডক" : "Developer API Docs"} external />
        </NavGroup>
      )}

      <NavGroup id="admin" icon="bi-sliders" label={t("nav_admin")} collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
        <Item href="/app/notifications" icon="bi-bell" label={t("nav_notifications")} />
        <Item href="/app/tutorials" icon="bi-play-btn" label={t("nav_video_tutorials")} />
        <Item href="/api-docs.html" icon="bi-file-earmark-code" label={lang === "bn" ? "API ডকুমেন্টেশন" : "API Documentation"} external />
        {showBackups && <Item href="/app/backups" icon="bi-cloud-arrow-up" label={lang === "bn" ? "ক্লাউড ব্যাকআপ" : (t("bku_title") || "Cloud Backups")} />}
        {(isOwner || can("manage_users")) && <Item href="/app/users" icon="bi-key" label={t("nav_users_roles")} />}
        <Item href="/app/settings" icon="bi-gear" label={t("nav_settings")} />
      </NavGroup>
    </>
  );
}
