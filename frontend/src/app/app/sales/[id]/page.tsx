"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money, fmtDate } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import InvoiceLockModal from "@/components/InvoiceLockModal";
import ConvertQuotationModal from "@/components/ConvertQuotationModal";
import toast from "react-hot-toast";

type SaleItem = { id: number; product?: any; product_id?: number; product_name: string; quantity: string; unit_price: string; discount: string; subtotal: string; unit_barcodes?: string[]; product_barcode?: string; product_warranty_months?: number; product_replacement_guarantee_days?: number; unit_warranties?: number[]; unit_replacement_guarantees?: number[] };
type Payment = { id: number; amount: string; method: string; paid_at: string; note: string };
type Sale = {
  id: number;
  invoice_no: string;
  customer_name: string | null;
  bill_name?: string | null;
  bill_phone?: string | null;
  public_invoice_url?: string;
  sale_date: string;
  due_date?: string;
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
  const { t, lang } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [showConvertModal, setShowConvertModal] = useState(false);

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

  async function handleDeleteQuotation() {
    if (!confirm(lang === "bn" ? "আপনি কি নিশ্চিত যে এই কোটেশনটি মুছে ফেলবেন?" : "Delete this quotation?")) return;
    try {
      await api(`/sales/sales/${id}/`, { method: "DELETE" });
      toast.success(lang === "bn" ? "কোটেশন মুছে ফেলা হয়েছে。" : "Quotation deleted.");
      router.push("/app/sales");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete quotation");
    }
  }

  if (loading) return <Spinner label={t("inv_loading")} />;
  if (error) return <ErrorState error={error} />;
  if (!sale) return null;

  const isQuotation =
    sale.status?.toLowerCase() === "quotation" ||
    (sale.note && sale.note.toLowerCase().includes("quotation")) ||
    (sale.note && sale.note.includes("কোটেশন"));

  return (
    <div className="vstack gap-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h1 className="h4 fw-bold text-brand mb-0">{t("inv_title")} {sale.invoice_no || `#${sale.id}`}</h1>
            {isQuotation && (
              <span className="badge bg-info text-dark">
                <i className="bi bi-file-earmark-text me-1"></i> {lang === "bn" ? "প্রাক-বিক্রয় কোটেশন" : "Quotation"}
              </span>
            )}
          </div>
          <div className="text-secondary small">
            {sale.customer_name || t("inv_walk_in")} · {fmtDate(sale.sale_date)}
            {sale.is_corrected && <span className="badge bg-warning text-dark ms-2">{t("inv_corrected")}</span>}
          </div>
          {sale.is_corrected && sale.correction_reason && (
             <div className="text-muted small mt-1 fst-italic">{t("inv_reason")} {sale.correction_reason}</div>
          )}
        </div>
        <div className="d-flex gap-2 align-items-center">
          {isQuotation ? (
            <>
              <button
                type="button"
                className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={() => setShowConvertModal(true)}
              >
                <i className="bi bi-cart-check-fill"></i>
                <span>{lang === "bn" ? "বিক্রয়ে রূপান্তর করুন" : "Convert to Sale"}</span>
              </button>

              <Link href={`/app/sales/${sale.id}/edit`} className="btn btn-primary btn-sm d-flex align-items-center gap-1">
                <i className="bi bi-pencil-square"></i>
                <span>{lang === "bn" ? "কোটেশন সম্পাদন" : "Edit Quotation"}</span>
              </Link>

              <button
                type="button"
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                onClick={handleDeleteQuotation}
              >
                <i className="bi bi-trash"></i>
                <span>{lang === "bn" ? "মুছুন" : "Delete"}</span>
              </button>
            </>
          ) : (() => {
            if (user?.role !== "owner") return null;
            
            const saleDate = new Date(sale.sale_date).toLocaleDateString();
            const today = new Date().toLocaleDateString();
            const isSameDay = saleDate === today;
            const hasReturns = sale.returns && sale.returns.length > 0;
            
            if (hasReturns) {
                return (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    onClick={() => {
                      setLockReason("ইনভয়েসে ইতোমধ্যে রিটার্ন/ফেরত সম্পন্ন হওয়ায় এটি আর সরাসরি পরিবর্তনযোগ্য নয়।");
                      setShowLockModal(true);
                    }}
                  >
                    <i className="bi bi-shield-lock-fill text-warning"></i>
                    <span>{t("inv_locked_returns")}</span>
                  </button>
                );
            }
            
            if (isSameDay) {
                return (
                    <Link href={`/app/sales/${sale.id}/edit`} className="btn btn-warning btn-sm">
                        {t("inv_btn_correct")}
                    </Link>
                );
            } else {
                return (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                      onClick={() => {
                        setLockReason(`ইনভয়েসটি তৈরি হয়েছিল ${fmtDate(sale.sale_date)} তারিখে। দৈনিক হিসাব ও ক্যাশ বুক সুরক্ষিত রাখতে এটি লক করা হয়েছে।`);
                        setShowLockModal(true);
                      }}
                    >
                      <i className="bi bi-shield-lock-fill text-warning"></i>
                      <span>{t("inv_locked")}</span>
                    </button>
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
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/app/sales");
              }
            }}
          >
            {t("inv_btn_back") || "Back"}
          </button>
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
                    _barcode: isQuotation ? "" : ((it.unit_barcodes && it.unit_barcodes[i]) || it.product_barcode || ""),
                    _warranty: isQuotation ? 0 : ((it.unit_warranties && it.unit_warranties[i]) ?? it.product_warranty_months ?? 0),
                    _guarantee: isQuotation ? 0 : ((it.unit_replacement_guarantees && it.unit_replacement_guarantees[i]) ?? it.product_replacement_guarantee_days ?? 0),
                  }));
                }
                return [{
                  ...it,
                  _extId: String(it.id),
                  _qty: qty,
                  _subtotal: Number(it.subtotal),
                  _discount: Number(it.discount),
                  _barcode: isQuotation ? "" : ((it.unit_barcodes && it.unit_barcodes[0]) || it.product_barcode || ""),
                  _warranty: isQuotation ? 0 : ((it.unit_warranties && it.unit_warranties[0]) ?? it.product_warranty_months ?? 0),
                  _guarantee: isQuotation ? 0 : ((it.unit_replacement_guarantees && it.unit_replacement_guarantees[0]) ?? it.product_replacement_guarantee_days ?? 0),
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
                  {Number(sale.due) > 0 && sale.due_date && (
                    <tr>
                      <td className="text-danger fw-medium">
                        <i className="bi bi-calendar-event me-1"></i> {lang === "bn" ? "পরিশোধের প্রতিশ্রুত তারিখ" : "Promised Date"}
                      </td>
                      <td className="text-end text-danger fw-semibold">{fmtDate(sale.due_date)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Lock Info Modal */}
      <InvoiceLockModal
        isOpen={showLockModal}
        onClose={() => setShowLockModal(false)}
        invoiceType="sale"
        invoiceNo={sale.invoice_no || `#${sale.id}`}
        reason={lockReason}
      />

      {/* Convert Quotation to Sale Modal */}
      <ConvertQuotationModal
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        sale={sale}
        onSuccess={(updatedSale) => {
          setSale(updatedSale);
        }}
      />
    </div>
  );
}
