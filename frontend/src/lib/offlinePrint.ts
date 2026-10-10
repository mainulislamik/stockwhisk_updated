/**
 * StockWhisk Offline Print Helper
 * Generates and triggers instant thermal receipt printing directly from browser memory
 * when internet or cloud connection is broken.
 */

import { OfflineSale } from "./offlineDb";

export function printOfflineReceipt(
  sale: OfflineSale,
  shopName: string = "StockWhisk Store",
  shopSettings: any = {}
) {
  if (typeof window === "undefined") return;

  const invoiceNo = sale.offline_invoice_no;
  const dateStr = new Date(sale.created_at).toLocaleString("bn-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const total = sale.paid; // for cash sale
  const subtotal = sale.items.reduce((s, it) => s + it.quantity * it.unit_price - (it.discount || 0), 0);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Offline Receipt - ${invoiceNo}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 10px;
      color: #000;
      font-size: 12px;
      line-height: 1.4;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-end { text-align: right; }
    .fw-bold { font-weight: bold; }
    .border-top { border-top: 1px dashed #000; margin-top: 6px; padding-top: 6px; }
    .border-bottom { border-bottom: 1px dashed #000; margin-bottom: 6px; padding-bottom: 6px; }
    .shop-title { font-size: 16px; font-weight: 800; margin-bottom: 2px; }
    .offline-badge { 
      display: inline-block; 
      border: 1px solid #000; 
      padding: 1px 6px; 
      font-size: 10px; 
      font-weight: 700; 
      border-radius: 4px;
      margin-top: 4px;
    }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    th { text-align: left; font-size: 11px; border-bottom: 1px solid #000; padding: 3px 0; }
    td { padding: 4px 0; font-size: 11px; vertical-align: top; }
    .barcode-tag { font-size: 10px; color: #333; }
    .footer { text-align: center; margin-top: 10px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="shop-title">${shopName}</div>
    <div class="offline-badge">⚡ অফলাইন বিক্রয় মেমো (OFFLINE POS)</div>
    <div style="font-size: 11px; margin-top: 4px;">চালান: <strong>${invoiceNo}</strong></div>
    <div style="font-size: 10px; color: #555;">তারিখ: ${dateStr}</div>
    ${sale.customer_name ? `<div style="font-size: 11px; margin-top: 2px;">ক্রেতা: ${sale.customer_name} (${sale.customer_phone || ""})</div>` : ""}
  </div>

  <div class="border-top">
    <table>
      <thead>
        <tr>
          <th>আইটেম</th>
          <th style="text-align: center;">পরিমাণ</th>
          <th class="text-end">মূল্য</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map((it) => `
          <tr>
            <td>
              <div class="fw-bold">${it.product_name || `পণ্য #${it.product}`}</div>
              ${it.barcode ? `<div class="barcode-tag">🏷️ ${it.barcode}</div>` : ""}
            </td>
            <td style="text-align: center;">${it.quantity}</td>
            <td class="text-end">৳${(it.quantity * it.unit_price).toFixed(2)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>

  <div class="border-top" style="font-size: 12px;">
    <div style="display: flex; justify-content: space-between;">
      <span>সাবটোটাল:</span>
      <span>৳${subtotal.toFixed(2)}</span>
    </div>
    ${sale.discount > 0 ? `
    <div style="display: flex; justify-content: space-between;">
      <span>ছাড় (Discount):</span>
      <span>-৳${sale.discount.toFixed(2)}</span>
    </div>` : ""}
    <div class="fw-bold" style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 2px;">
      <span>সর্বমোট:</span>
      <span>৳${sale.paid.toFixed(2)}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 2px;">
      <span>পরিশোধ (নগদ):</span>
      <span>৳${sale.paid.toFixed(2)}</span>
    </div>
  </div>

  <div class="border-top footer">
    <div>${shopSettings.footer_note || "ধন্যবাদ, আবার আসবেন!"}</div>
    <div style="font-size: 9px; margin-top: 4px; color: #666;">
      ইন্টারনেট সংযোগ চালু হলে এটি ক্লাউড ডাটাবেজে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>
`;

  const printWindow = window.open("", "_blank", "width=420,height=600");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
