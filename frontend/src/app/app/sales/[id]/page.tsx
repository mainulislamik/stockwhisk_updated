"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";

type SaleItem = { id: number; product_name: string; quantity: string; unit_price: string; discount: string; subtotal: string; unit_barcodes?: string[]; product_barcode?: string; product_warranty_months?: number; product_replacement_guarantee_days?: number; unit_warranties?: number[]; unit_replacement_guarantees?: number[] };
type Payment = { id: number; amount: string; method: string; paid_at: string; note: string };
type Sale = {
  id: number;
  invoice_no: string;
  customer_name: string | null;
  bill_name?: string | null;
  bill_phone?: string | null;
  public_invoice_url?: string;
  sale_date: string;
  subtotal: string;
  discount: string;
  delivery_charge: string;
  tax: string;
  total: string;
  paid: string;
  due: string;
  status: string;
  note: string;
  items: SaleItem[];
  payments: Payment[];
  is_corrected?: boolean;
  correction_reason?: string;
  original_total?: string;
  returns?: any[];
};

export default function SaleDetailPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setSale(await api<Sale>(`/sales/sales/${id}/`));
      } catch (e: any) {
        setError(e?.message || t("inv_err_load"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Spinner label={t("inv_loading")} />;
  if (error) return <ErrorState error={error} />;
  if (!sale) return null;

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h1 className="h4 fw-bold text-brand mb-0">{t("inv_title")} {sale.invoice_no || `#${sale.id}`}</h1>
          <div className="text-secondary small">
            {sale.customer_name || t("inv_walk_in")} · {fmtDate(sale.sale_date)}
            {sale.is_corrected && <span className="badge bg-warning text-dark ms-2">{t("inv_corrected")}</span>}
          </div>
          {sale.is_corrected && sale.correction_reason && (
             <div className="text-muted small mt-1 fst-italic">{t("inv_reason")} {sale.correction_reason}</div>
          )}
        </div>
        <div className="d-flex gap-2 align-items-center">
          {(() => {
            if (user?.role !== "owner") return null;
            
            const saleDate = new Date(sale.sale_date).toLocaleDateString();
            const today = new Date().toLocaleDateString();
            const isSameDay = saleDate === today;
            const hasReturns = sale.returns && sale.returns.length > 0;
            
            if (hasReturns) {
                return <span className="badge bg-secondary">{t("inv_locked_returns")}</span>;
            }
            
            if (isSameDay) {
                return (
                    <Link href={`/app/sales/${sale.id}/edit`} className="btn btn-warning btn-sm">
                        {t("inv_btn_correct")}
                    </Link>
                );
            } else {
                return (
                    <span className="badge bg-secondary" title={t("inv_correction_tooltip")}>
                        {t("inv_locked")}
                    </span>
                );
            }
          })()}
          {user?.shop_whatsapp_enabled !== false && (() => {
            const digits = (sale.bill_phone || "").replace(/\D/g, "");
            const intl = digits.startsWith("880") ? digits
              : digits.startsWith("0") ? "880" + digits.slice(1)
              : digits.length === 10 ? "880" + digits : digits;
            const hasPhone = digits.length >= 10;
            const pdf = sale.public_invoice_url
              ? (sale.public_invoice_url.startsWith("http") ? sale.public_invoice_url : window.location.origin + sale.public_invoice_url)
              : "";
            const msg = t("inv_wa_msg_1", { name: sale.bill_name || sale.customer_name || "", shop: user?.shop_name || "our shop" })
              + t("inv_wa_msg_2", { invoice: sale.invoice_no })
              + t("inv_wa_msg_3", { total: Number(sale.total).toFixed(2) })
              + (pdf ? t("inv_wa_msg_4", { pdf }) : "")
              + t("inv_wa_msg_5");
            const waUrl = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
            if (!hasPhone) return null;
            return (
              <a
                className="btn btn-sm text-white"
                style={{ background: "#25D366" }}
                href={waUrl}
                target="_blank" rel="noreferrer"
                title={t("inv_wa_tooltip")}
              >
                <i className="bi bi-whatsapp me-1"></i> {t("inv_btn_wa")}
              </a>
            );
          })()}
          <button className="btn btn-outline-brand btn-sm" onClick={() => window.open(`/invoice/${sale.id}`, "_blank")}>
            {t("inv_btn_print")}
          </button>
          <Link href="/app/sales" className="btn btn-outline-secondary btn-sm">
            Back
          </Link>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-sm mb-0">
            <thead className="thead-1">
              <tr>
                <th>{t("inv_col_product")}</th>
                <th className="text-end">{t("inv_col_qty")}</th>
                <th className="text-end">{t("inv_col_price")}</th>
                <th className="text-end">{t("inv_col_discount")}</th>
                <th className="text-end">{t("inv_col_subtotal")}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.flatMap(it => {
                const qty = Number(it.quantity);
                if (Number.isInteger(qty) && qty > 1) {
                  return Array.from({ length: qty }).map((_, i) => ({
                    ...it,
                    _extId: `${it.id}-${i}`,
                    _qty: 1,
                    _subtotal: Number(it.subtotal) / qty,
                    _discount: Number(it.discount) / qty,
                    _barcode: (it.unit_barcodes && it.unit_barcodes[i]) || it.product_barcode || "",
                    _warranty: (it.unit_warranties && it.unit_warranties[i]) ?? it.product_warranty_months ?? 0,
                    _guarantee: (it.unit_replacement_guarantees && it.unit_replacement_guarantees[i]) ?? it.product_replacement_guarantee_days ?? 0,
                  }));
                }
                return [{
                  ...it,
                  _extId: String(it.id),
                  _qty: qty,
                  _subtotal: Number(it.subtotal),
                  _discount: Number(it.discount),
                  _barcode: (it.unit_barcodes && it.unit_barcodes[0]) || it.product_barcode || "",
                  _warranty: (it.unit_warranties && it.unit_warranties[0]) ?? it.product_warranty_months ?? 0,
                  _guarantee: (it.unit_replacement_guarantees && it.unit_replacement_guarantees[0]) ?? it.product_replacement_guarantee_days ?? 0,
                }];
              }).map((it) => (
                <tr key={it._extId}>
                  <td>
                    <div className="fw-medium">{it.product_name}</div>
                    {it._barcode && <div className="text-secondary" style={{fontSize: "0.75rem"}}>{t("inv_lbl_barcode")} {it._barcode}</div>}
                    {it._warranty > 0 && <div className="text-success" style={{fontSize: "0.75rem"}}>{t("inv_lbl_warranty")} {it._warranty} {t("inv_lbl_months")}</div>}
                    {it._guarantee > 0 && <div className="text-info" style={{fontSize: "0.75rem"}}>{t("inv_lbl_guarantee")} {it._guarantee} {t("inv_lbl_days")}</div>}
                  </td>
                  <td className="text-end">{it._qty}</td>
                  <td className="text-end">{money(it.unit_price)}</td>
                  <td className="text-end">{money(it._discount)}</td>
                  <td className="text-end">{money(it._subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="fw-semibold mb-2">{t("inv_title_payments")}</div>
              {sale.payments.length === 0 ? (
                <div className="text-secondary small">{t("inv_no_payments")}</div>
              ) : (
                <table className="table table-sm mb-0">
                  <tbody>
                    {sale.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{fmtDate(p.paid_at)}</td>
                        <td>{p.method}</td>
                        <td className="text-end">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <td className="text-secondary">{t("inv_col_subtotal")}</td>
                    <td className="text-end">{money(sale.subtotal)}</td>
                  </tr>
                  {Number(sale.discount) > 0 && (
                    <tr>
                      <td className="text-secondary">{t("inv_col_discount")}</td>
                      <td className="text-end">- {money(sale.discount)}</td>
                    </tr>
                  )}
                  {Number(sale.delivery_charge) > 0 && (
                    <tr>
                      <td className="text-secondary">{t("inv_lbl_delivery")}</td>
                      <td className="text-end">+ {money(sale.delivery_charge)}</td>
                    </tr>
                  )}
                  {Number(sale.tax) > 0 && (
                    <tr>
                      <td className="text-secondary">{t("inv_lbl_tax")}</td>
                      <td className="text-end">+ {money(sale.tax)}</td>
                    </tr>
                  )}
                  <tr className="fw-bold">
                    <td>{t("inv_lbl_total")}</td>
                    <td className="text-end">{money(sale.total)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">{t("inv_lbl_paid")}</td>
                    <td className="text-end">{money(sale.paid)}</td>
                  </tr>
                  <tr>
                    <td className="text-secondary">{t("inv_lbl_due")}</td>
                    <td className={`text-end ${Number(sale.due) > 0 ? "text-danger fw-semibold" : ""}`}>{money(sale.due)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
