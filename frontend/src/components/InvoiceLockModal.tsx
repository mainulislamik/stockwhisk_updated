"use client";

import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  invoiceType?: "sale" | "service";
  invoiceNo?: string;
  reason?: string;
};

export default function InvoiceLockModal({
  isOpen,
  onClose,
  invoiceType = "sale",
  invoiceNo,
  reason,
}: Props) {
  const [langTab, setLangTab] = useState<"bn" | "en">("bn");

  if (!isOpen) return null;

  const isSale = invoiceType === "sale";

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", zIndex: 1060 }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
          {/* Top Header Banner */}
          <div
            className="p-4 text-white d-flex align-items-center justify-content-between"
            style={{
              background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle bg-warning bg-opacity-20 text-warning"
                style={{ width: "48px", height: "48px", fontSize: "1.5rem" }}
              >
                <i className="bi bi-shield-lock-fill"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0 text-white">
                  {langTab === "bn" ? "ইনভয়েস লক সংক্রান্ত তথ্য" : "Invoice Lock Information"}
                </h5>
                <div className="text-white-50 small">
                  {invoiceNo ? (
                    <span>
                      {isSale ? (langTab === "bn" ? "সেলস ইনভয়েস" : "Sales Invoice") : (langTab === "bn" ? "সার্ভিস ইনভয়েস" : "Service Invoice")}{" "}
                      <strong className="text-warning font-monospace">#{invoiceNo}</strong>
                    </span>
                  ) : (
                    langTab === "bn" ? "অ্যাকাউন্টিং নিরাপত্তা প্রোটোকল" : "Accounting Security Protocol"
                  )}
                </div>
              </div>
            </div>

            {/* Language Switcher Pills */}
            <div className="d-flex align-items-center gap-2">
              <div className="btn-group btn-group-sm bg-dark p-1 rounded-pill border border-secondary">
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                    langTab === "bn" ? "btn-warning text-dark" : "btn-link text-white-50 text-decoration-none"
                  }`}
                  onClick={() => setLangTab("bn")}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                    langTab === "en" ? "btn-warning text-dark" : "btn-link text-white-50 text-decoration-none"
                  }`}
                  onClick={() => setLangTab("en")}
                >
                  English
                </button>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white ms-2"
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>
          </div>

          {/* Modal Body Content */}
          <div className="modal-body p-4 bg-light">
            {langTab === "bn" ? (
              /* Bangla Content */
              <div className="vstack gap-3">
                {reason && (
                  <div className="alert alert-warning border-0 shadow-sm d-flex align-items-center gap-2 mb-1 py-2">
                    <i className="bi bi-exclamation-triangle-fill fs-5 text-warning"></i>
                    <div>
                      <strong>লক হওয়ার কারণ:</strong> {reason}
                    </div>
                  </div>
                )}

                <div className="card border-0 shadow-sm rounded-3">
                  <div className="card-body p-3">
                    <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-question-circle-fill text-primary"></i>
                      কেন এই ইনভয়েসটি লক করা রয়েছে?
                    </h6>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="p-3 bg-white rounded-3 border h-100">
                          <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                            <i className="bi bi-calendar-check text-success"></i>
                            ১. দৈনিক হিসাব (Daily Settlement) ক্লোজড
                          </div>
                          <p className="small text-secondary mb-0">
                            এই ইনভয়েসটি তৈরি হওয়ার দিন শেষ হয়ে গেছে এবং ওই দিনের ক্যাশ বুক ও হিসাব চূড়ান্তভাবে ক্লোজ করা হয়েছে। আগের দিনের ইনভয়েস সরাসরি পরিবর্তন করলে বিগত দিনের দৈনিক জমা-খরচ এবং লাভ-ক্ষতির রিপোর্টে অসামঞ্জস্য তৈরি হবে।
                          </p>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="p-3 bg-white rounded-3 border h-100">
                          <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                            <i className="bi bi-shield-check text-info"></i>
                            ২. জালিয়াতি ও গরমিল প্রতিরোধ
                          </div>
                          <p className="small text-secondary mb-0">
                            অ্যাকাউন্টিং স্ট্যান্ডার্ড অনুযায়ী, পুরোনো ইনভয়েসের আইটেম বা দাম পরিবর্তন করার অপব্যবহার রোধ করতে এবং হিসাবের স্বচ্ছতা শতভাগ নিরাপদ রাখতে সিস্টেম স্বয়ংক্রিয়ভাবে এটি লক রাখে।
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Solution / Action Guide */}
                <div className="card border-0 shadow-sm rounded-3 border-start border-success border-4">
                  <div className="card-body p-3">
                    <h6 className="fw-bold text-success mb-2 d-flex align-items-center gap-2">
                      <i className="bi bi-lightbulb-fill"></i>
                      আপনার করণীয় ও সমাধান (Recommended Steps):
                    </h6>
                    <ul className="small text-secondary mb-0 ps-3 vstack gap-2">
                      {isSale ? (
                        <>
                          <li>
                            <strong>প্রোডাক্ট ফেরত বা পরিবর্তন করতে:</strong> বাম পাশের মেনু থেকে{" "}
                            <span className="badge bg-primary bg-opacity-10 text-primary">বিক্রয় &gt; ফেরত (Returns)</span> অপশন ব্যবহার করুন। এর মাধ্যমে প্রোডাক্টটি স্বয়ংক্রিয়ভাবে স্টকে যুক্ত হবে এবং সঠিক ক্যাশ সমন্বয় হবে।
                          </li>
                          <li>
                            <strong>বকেয়া টাকা কালেকশন করতে:</strong> কাস্টমার প্রোফাইল বা ডিউস পেজে গিয়ে{" "}
                            <span className="badge bg-success bg-opacity-10 text-success">টাকা গ্রহণ (Receive Payment)</span> বাটনে চাপ দিন।
                          </li>
                        </>
                      ) : (
                        <>
                          <li>
                            <strong>সার্ভিস ডেলিভারির পর বিল সংশোধন:</strong> সার্ভিসটি ইতোমধ্যে সম্পন্ন ও ডেলিভারি হয়ে থাকলে অ্যাকাউন্টিং সঠিক রাখতে নতুন কোনো বিল বা ওয়ারেন্টি থাকলে নতুন টিকিট ইস্যু করুন।
                          </li>
                          <li>
                            <strong>বাকি টাকা আদায় করতে:</strong> টিকিটের নিচে থাকা{" "}
                            <span className="badge bg-success bg-opacity-10 text-success">+ পেমেন্ট যোগ করুন</span> ব্যবহার করুন।
                          </li>
                        </>
                      )}
                      <li>
                        <strong>সেম-ডে কারেকশন:</strong> শুধুমাত্র যেদিন ইনভয়েস তৈরি বা ইন-প্রোগ্রেস থাকে, সেদিন যেকোনো সময় সম্পূর্ণ এডিট বা সংশোধন করা যায়।
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              /* English Content */
              <div className="vstack gap-3">
                {reason && (
                  <div className="alert alert-warning border-0 shadow-sm d-flex align-items-center gap-2 mb-1 py-2">
                    <i className="bi bi-exclamation-triangle-fill fs-5 text-warning"></i>
                    <div>
                      <strong>Lock Reason:</strong> {reason}
                    </div>
                  </div>
                )}

                <div className="card border-0 shadow-sm rounded-3">
                  <div className="card-body p-3">
                    <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-question-circle-fill text-primary"></i>
                      Why is this invoice locked against editing?
                    </h6>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="p-3 bg-white rounded-3 border h-100">
                          <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                            <i className="bi bi-calendar-check text-success"></i>
                            1. Historical Settlement Protection
                          </div>
                          <p className="small text-secondary mb-0">
                            This invoice was finalized on a past calendar date. Modifying past invoices directly would corrupt historical daily cash closing records, settlement registers, and profit analytics.
                          </p>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="p-3 bg-white rounded-3 border h-100">
                          <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                            <i className="bi bi-shield-check text-info"></i>
                            2. Audit &amp; Fraud Prevention
                          </div>
                          <p className="small text-secondary mb-0">
                            In accordance with standard bookkeeping principles, retroactively editing historical invoices is restricted to prevent unauthorized cash manipulation and preserve an immutable audit trail.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* English Solution */}
                <div className="card border-0 shadow-sm rounded-3 border-start border-success border-4">
                  <div className="card-body p-3">
                    <h6 className="fw-bold text-success mb-2 d-flex align-items-center gap-2">
                      <i className="bi bi-lightbulb-fill"></i>
                      Recommended Actions:
                    </h6>
                    <ul className="small text-secondary mb-0 ps-3 vstack gap-2">
                      {isSale ? (
                        <>
                          <li>
                            <strong>Product Returns / Exchanges:</strong> Please navigate to{" "}
                            <span className="badge bg-primary bg-opacity-10 text-primary">Sales &gt; Returns</span> to safely restock items and process customer refunds or replacements.
                          </li>
                          <li>
                            <strong>Receiving Due Payments:</strong> To collect outstanding balance, use the{" "}
                            <span className="badge bg-success bg-opacity-10 text-success">Receive Payment</span> action in the Customer Profile or Dues section.
                          </li>
                        </>
                      ) : (
                        <>
                          <li>
                            <strong>Delivered Service Adjustments:</strong> If this service was already completed and settled on a previous date, create a new service ticket for any additional claims or adjustments.
                          </li>
                          <li>
                            <strong>Collecting Due Payments:</strong> Use the{" "}
                            <span className="badge bg-success bg-opacity-10 text-success">+ Add Payment</span> button to settle any outstanding ticket balance.
                          </li>
                        </>
                      )}
                      <li>
                        <strong>Same-Day Edits:</strong> Complete invoice correction is always permitted on the active day of creation or while in-progress.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-footer bg-white border-top py-3 d-flex justify-content-between">
            <span className="small text-secondary">
              <i className="bi bi-lock-fill me-1 text-warning"></i>
              {langTab === "bn" ? "স্টকহুইস্ক অ্যাকাউন্টিং সিকিউরিটি" : "StockWhisk Enterprise Security"}
            </span>
            <button type="button" className="btn btn-dark btn-sm px-4 rounded-pill" onClick={onClose}>
              {langTab === "bn" ? "বুঝেছি / ঠিক আছে" : "Got it / Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
