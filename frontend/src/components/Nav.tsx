"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

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
  const { can, isOwner } = useAuth();
  
  const active = (href: string) => (pathname === href ? "active" : "");

  const Item = ({ href, icon, label }: { href: string; icon: string; label: string }) => (
    <Link href={href} title={label} className={`nav-link ${active(href)}`}>
      <i className={`bi ${icon}`}></i> {!collapsed && <span>{label}</span>}
    </Link>
  );

  const showPurchasing = isOwner || can("manage_purchasing");
  const showReports = isOwner || can("view_reports");
  const showSalesRead = isOwner || can("view_sales");
  const showService = isOwner || can("manage_service") || can("view_service");
  const showFinance = isOwner || can("manage_expenses") || can("view_profit") || can("view_reports");

  return (
    <>
      {(isOwner || can("view_reports")) && <Item href="/app" icon="bi-speedometer2" label="Dashboard" />}
      <Item href="/app/pos" icon="bi-cart3" label="POS" />

      <NavGroup id="products" icon="bi-box-seam" label="Products" collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
        <Item href="/app/products" icon="bi-list-ul" label="Product list" />
        <Item href="/app/products/purchase" icon="bi-upc-scan" label="Purchase product" />
        <Item href="/app/products/lookup" icon="bi-qr-code-scan" label="Item lookup" />
        <Item href="/app/barcodes" icon="bi-upc" label="Barcodes" />
        <Item href="/app/inventory" icon="bi-boxes" label="Inventory & stock" />
        {showPurchasing && (
          <>
            <Item href="/app/suppliers" icon="bi-truck" label="Suppliers" />
            <Item href="/app/purchases" icon="bi-box-arrow-in-down" label="Purchases" />
          </>
        )}
      </NavGroup>

      <NavGroup id="sales" icon="bi-receipt" label="Sales" collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
        {/* Invoices + Selling details read /sales/sales/ → gate by view_sales. */}
        {showSalesRead && <Item href="/app/sales" icon="bi-receipt-cutoff" label="Invoices" />}
        <Item href="/app/sales/returns" icon="bi-arrow-return-left" label="Returns" />
        {useAuth().user?.shop_emi_enabled && (
          <Item href="/app/emi" icon="bi-calendar-check" label="EMI Management" />
        )}
        {/* Sold products is an analytics report → view_reports. */}
        {showReports && <Item href="/app/sales/products" icon="bi-list-check" label="Sold products" />}
        {showSalesRead && <Item href="/app/sales/details" icon="bi-card-list" label="Selling details" />}
      </NavGroup>

      <NavGroup id="customers" icon="bi-people" label="Customers" collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
        <Item href="/app/customers" icon="bi-person-lines-fill" label="Customer list" />
        <Item href="/app/dues" icon="bi-cash-coin" label="Dues" />
      </NavGroup>

      {showService && (
        <NavGroup id="service" icon="bi-tools" label="Service" collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          <Item href="/app/service/tickets" icon="bi-wrench-adjustable" label="Repair tickets" />
          <Item href="/app/service/warranties" icon="bi-shield-check" label="Warranties" />
          <Item href="/app/service/warranty-coverage" icon="bi-shield-shaded" label="Warranty coverage" />
        </NavGroup>
      )}

      {showFinance && (
        <NavGroup id="finance" icon="bi-bank" label="Finance" collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
          {(isOwner || can("manage_expenses")) && <Item href="/app/expenses" icon="bi-cash-stack" label="Expenses" />}
          {(isOwner || can("view_profit")) && (
            <>
              <Item href="/app/accounting" icon="bi-calculator" label="Accounting" />
              <Item href="/app/accounting/settlement" icon="bi-journal-check" label="Daily Settlement" />
            </>
          )}
          {(isOwner || can("view_reports")) && <Item href="/app/reports" icon="bi-graph-up" label="Reports" />}
        </NavGroup>
      )}

      <NavGroup id="admin" icon="bi-sliders" label="Admin" collapsed={collapsed} openGroup={openGroup} setGroup={setGroup}>
        <Item href="/app/notifications" icon="bi-bell" label="Notifications" />
        <Item href="/app/tutorials" icon="bi-play-btn" label="Video tutorials" />
        {(isOwner || can("manage_users")) && <Item href="/app/users" icon="bi-key" label="Users & Roles" />}
        <Item href="/app/settings" icon="bi-gear" label="Settings" />
      </NavGroup>
    </>
  );
}
