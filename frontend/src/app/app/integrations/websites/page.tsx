"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, api } from "@/lib/api";
import { ErrorState, Spinner, fmtDate } from "@/components/ui";
import { useLanguage } from "@/contexts/LanguageContext";
import toast from "react-hot-toast";

type IntegrationChannel = {
  id: number;
  name: string;
  provider: string;
  provider_display: string;
  category: string;
  status: string;
  status_display: string;
  base_url: string;
  is_active: boolean;
  is_paused: boolean;
  is_connected: boolean;
  has_error: boolean;
  last_sync_at: string | null;
  error_message: string | null;
  config: Record<string, any>;
  credential: { overview: Record<string, any>; created_at: string; updated_at: string } | null;
  webhook_endpoint?: {
    id: string;
    name: string;
    url: string;
    secret_token: string;
    is_active: boolean;
  } | null;
  created_at: string;
};

type ChannelFailure = {
  id: number;
  event_type: string;
  status: string;
  error_category: string | null;
  error_message: string | null;
  attempt_count: number;
  max_retries: number;
  next_retry_at: string | null;
  created_at: string;
};

function DeveloperDocsModal({
  channel,
  onClose,
  lang,
}: {
  channel: IntegrationChannel;
  onClose: () => void;
  lang: string;
}) {
  const [activeDocTab, setActiveDocTab] = useState<"overview" | "stock" | "orders" | "tester">("overview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testSku, setTestSku] = useState("GDO-273540");
  const [testResult, setTestResult] = useState<any>(null);
  const [testingEndpoint, setTestingEndpoint] = useState(false);

  const endpoint = channel.webhook_endpoint;
  if (!endpoint) return null;

  const endpointUrl = endpoint.url;
  const secretToken = endpoint.secret_token;

  function copyToClipboard(text: string, label: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(label);
      toast.success(lang === "bn" ? `${label} ক্লিপবোর্ডে কপি হয়েছে!` : `${label} copied to clipboard!`);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  }

  const getFullEndpointUrl = (relativeUrl: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${relativeUrl}`;
  };

  const fullUrl = getFullEndpointUrl(endpointUrl);

  async function runStockCheckTest() {
    setTestingEndpoint(true);
    setTestResult(null);
    try {
      const url = `${fullUrl}?sku=${encodeURIComponent(testSku.trim())}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-Webhook-Secret": secretToken,
        },
      });
      const data = await res.json();
      setTestResult({
        action: "GET Stock Check",
        status: res.status,
        ok: res.ok,
        data,
      });
      if (res.ok) {
        toast.success(lang === "bn" ? "স্টক তথ্য সফলভাবে লোড হয়েছে!" : "Stock check successful!");
      } else {
        toast.error(data?.error || "Stock check failed");
      }
    } catch (err: any) {
      setTestResult({
        action: "GET Stock Check",
        status: 500,
        ok: false,
        error: err?.message,
      });
      toast.error(err?.message || "Stock check error");
    } finally {
      setTestingEndpoint(false);
    }
  }

  async function runSampleOrderTest() {
    setTestingEndpoint(true);
    setTestResult(null);
    try {
      const url = `${fullUrl}?sync=true`;
      const testOrderId = `WEB-TST-${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        event: "order.created",
        id: testOrderId,
        order_number: testOrderId.replace("WEB-TST-", "T-"),
        total: 1450.0,
        customer: {
          name: "Test Customer (Website)",
          phone: "01700000000",
          address: "Test Delivery Address, Dhaka",
        },
        items: [
          {
            sku: testSku.trim() || "GDO-273540",
            quantity: 1,
            unit_price: 1450.0,
          },
        ],
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-Webhook-Secret": secretToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTestResult({
        action: "POST Order Webhook",
        status: res.status,
        ok: res.ok,
        data,
      });
      if (res.ok) {
        toast.success(
          lang === "bn"
            ? `টেস্ট অর্ডার সফল! ইনভয়েস: ${data.invoice_no || "প্রস্তুত"}`
            : `Order processed! Invoice: ${data.invoice_no || "created"}`
        );
      } else {
        toast.error(data?.error || "Order ingestion failed");
      }
    } catch (err: any) {
      setTestResult({
        action: "POST Order Webhook",
        status: 500,
        ok: false,
        error: err?.message,
      });
      toast.error(err?.message || "Order ingestion error");
    } finally {
      setTestingEndpoint(false);
    }
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header bg-dark text-white py-3">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-terminal-split fs-4 text-warning"></i>
              <div>
                <h5 className="modal-title fw-bold mb-0 text-white">
                  {channel.name} — {lang === "bn" ? "ডেভেলপার গাইড ও API স্পেসিফিকেশন" : "Developer Integration Guide"}
                </h5>
                <div className="text-secondary small">
                  {lang === "bn"
                    ? "কাস্টম ওয়েবসাইট (React, Next.js, Laravel, PHP, Node.js) কানেক্ট করার নিয়মাবলী"
                    : "Complete API specification & code samples for custom web applications"}
                </div>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-light border-bottom px-3 pt-2">
            <ul className="nav nav-tabs border-0 gap-2 small fw-semibold">
              <li className="nav-item">
                <button
                  className={`nav-link border-0 ${activeDocTab === "overview" ? "active bg-white text-primary border-bottom border-primary border-2" : "text-muted"}`}
                  onClick={() => setActiveDocTab("overview")}
                >
                  <i className="bi bi-shield-check me-1"></i>
                  {lang === "bn" ? "১. ওভারভিউ ও অথেনটিকেশন" : "1. Overview & Auth"}
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link border-0 ${activeDocTab === "stock" ? "active bg-white text-primary border-bottom border-primary border-2" : "text-muted"}`}
                  onClick={() => setActiveDocTab("stock")}
                >
                  <i className="bi bi-box-seam me-1"></i>
                  {lang === "bn" ? "২. রিয়েল-টাইম স্টক চেক (GET)" : "2. Live Stock Check (GET)"}
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link border-0 ${activeDocTab === "orders" ? "active bg-white text-primary border-bottom border-primary border-2" : "text-muted"}`}
                  onClick={() => setActiveDocTab("orders")}
                >
                  <i className="bi bi-bag-check me-1"></i>
                  {lang === "bn" ? "৩. অর্ডার ইন্টিগ্রেশন (POST)" : "3. Order Ingestion (POST)"}
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link border-0 ${activeDocTab === "tester" ? "active bg-white text-success border-bottom border-success border-2" : "text-muted"}`}
                  onClick={() => setActiveDocTab("tester")}
                >
                  <i className="bi bi-play-circle-fill me-1 text-success"></i>
                  {lang === "bn" ? "৪. লাইভ টেস্ট কনসোল (Live Tester)" : "4. Live Test Console"}
                </button>
              </li>
            </ul>
          </div>

          <div className="modal-body p-4 bg-white">
            {/* TAB 1: OVERVIEW & AUTH */}
            {activeDocTab === "overview" ? (
              <div className="vstack gap-4">
                <div className="alert alert-light border rounded-3 p-3">
                  <h6 className="fw-bold text-dark mb-2">
                    <i className="bi bi-stars text-primary me-2"></i>
                    {lang === "bn" ? "কীভাবে কাজ করে?" : "How does this work?"}
                  </h6>
                  <p className="text-muted small mb-2">
                    {lang === "bn"
                      ? "StockWhisk আপনার অনলাইন স্টোরের কেন্দ্রীয় ইনভেন্টরি ও সেলস লেজার হিসেবে কাজ করে। আপনার ওয়েবসাইটের ডেভেলপার গ্রাহকের চেকআউটের সময় StockWhisk থেকে লাইভ স্টক চেক করতে পারেন এবং অর্ডার প্লেস হওয়ার সাথে সাথে Webhook এর মাধ্যমে StockWhisk এ পাঠিয়ে দিতে পারেন।"
                      : "StockWhisk acts as your single source of truth for stock and sales ledgers. Your website developer can query live available stock during checkout and push confirmed orders to StockWhisk seamlessly."}
                  </p>
                  <div className="small text-dark fw-semibold">
                    {lang === "bn" ? "প্রয়োজনীয় ক্রেডেনশিয়াল:" : "Your Channel Credentials:"}
                  </div>
                  <div className="row g-2 mt-1">
                    <div className="col-md-7">
                      <div className="bg-white border rounded p-2 small font-monospace">
                        <span className="text-muted d-block small">Webhook Endpoint:</span>
                        {fullUrl}
                      </div>
                    </div>
                    <div className="col-md-5">
                      <div className="bg-white border rounded p-2 small font-monospace">
                        <span className="text-muted d-block small">Secret Key:</span>
                        {secretToken}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h6 className="fw-bold text-dark mb-2">
                    <i className="bi bi-lock-fill text-success me-2"></i>
                    {lang === "bn" ? "অনুরোধ অথেনটিকেশন (Authentication)" : "Request Authentication"}
                  </h6>
                  <p className="text-muted small">
                    {lang === "bn"
                      ? "প্রতিটি API ও Webhook অনুরোধে নিম্নোক্ত যেকোনো একটি HTTP Header পাঠাতে হবে:"
                      : "Include your secret token in any of the following HTTP request headers:"}
                  </p>
                  <div className="bg-dark text-white p-3 rounded-3 font-monospace small">
                    <div className="text-success mb-1"># Option 1: Direct Webhook Secret Header (Recommended)</div>
                    <div className="text-light mb-2">X-Webhook-Secret: {secretToken}</div>
                    <div className="text-success mb-1"># Option 2: Bearer Authorization Header</div>
                    <div className="text-light">Authorization: Bearer {secretToken}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* TAB 2: LIVE STOCK CHECK */}
            {activeDocTab === "stock" ? (
              <div className="vstack gap-4">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="badge bg-success">GET</span>
                    <code className="text-dark fw-bold font-monospace">
                      {endpointUrl}?sku=&#123;SKU_OR_BARCODE&#125;
                    </code>
                  </div>
                  <p className="text-muted small">
                    {lang === "bn"
                      ? "চেকআউট পেজে অথবা প্রোডাক্ট পেজে লাইভ Available-to-Sell (ATS) স্টক যাচাই করার জন্য এই এন্ডপয়েন্টে GET অনুরোধ পাঠান।"
                      : "Send a GET request to verify live Available-to-Sell (ATS) inventory before allowing user checkout."}
                  </p>
                </div>

                {/* Code Snippets */}
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-bold text-dark">cURL Example:</span>
                    <button
                      className="btn btn-sm btn-outline-secondary py-0"
                      onClick={() =>
                        copyToClipboard(
                          `curl -X GET "${fullUrl}?sku=GDO-273540" \\\n  -H "X-Webhook-Secret: ${secretToken}"`,
                          "cURL snippet"
                        )
                      }
                    >
                      <i className="bi bi-clipboard me-1"></i> Copy
                    </button>
                  </div>
                  <pre className="bg-dark text-light p-3 rounded-3 font-monospace small mb-0">
{`curl -X GET "${fullUrl}?sku=GDO-273540" \\
  -H "X-Webhook-Secret: ${secretToken}"`}
                  </pre>
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-bold text-dark">JavaScript (Next.js / Node.js) Example:</span>
                    <button
                      className="btn btn-sm btn-outline-secondary py-0"
                      onClick={() =>
                        copyToClipboard(
                          `async function checkStock(sku) {\n  const res = await fetch(\`${fullUrl}?sku=\${sku}\`, {\n    headers: {\n      "X-Webhook-Secret": "${secretToken}"\n    }\n  });\n  return await res.json();\n}`,
                          "JS snippet"
                        )
                      }
                    >
                      <i className="bi bi-clipboard me-1"></i> Copy
                    </button>
                  </div>
                  <pre className="bg-dark text-light p-3 rounded-3 font-monospace small mb-0">
{`async function checkStock(sku) {
  const res = await fetch(\`${fullUrl}?sku=\${sku}\`, {
    headers: {
      "X-Webhook-Secret": "${secretToken}"
    }
  });
  const data = await res.json();
  console.log("Available Stock:", data.available, "In Stock:", data.in_stock);
  return data;
}`}
                  </pre>
                </div>

                <div>
                  <div className="small fw-bold text-dark mb-2">Sample JSON Response:</div>
                  <pre className="bg-light text-dark border p-3 rounded-3 font-monospace small mb-0">
{`{
  "id": 81,
  "name": "Anker 20W Fast Charger",
  "sku": "GDO-273540",
  "barcode": "",
  "selling_price": 1450.00,
  "on_hand": 15.0,
  "reserved": 3.0,
  "available": 12.0,
  "in_stock": true
}`}
                  </pre>
                </div>
              </div>
            ) : null}

            {/* TAB 3: ORDER INGESTION */}
            {activeDocTab === "orders" ? (
              <div className="vstack gap-4">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="badge bg-primary">POST</span>
                    <code className="text-dark fw-bold font-monospace">
                      {endpointUrl}?sync=true
                    </code>
                  </div>
                  <p className="text-muted small">
                    {lang === "bn"
                      ? "গ্রাহক আপনার ওয়েবসাইটে অর্ডার নিশ্চিত করার পর এই এন্ডপয়েন্টে অর্ডারের বিস্তারিত তথ্য পাঠান। StockWhisk স্বয়ংক্রিয়ভাবে স্টক রিজার্ভ করবে এবং অফিসিয়াল ইনভয়েস তৈরি করবে।"
                      : "Push confirmed website orders to this endpoint. StockWhisk will automatically reserve inventory and generate the sale invoice."}
                  </p>
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-bold text-dark">Sample Order JSON Payload:</span>
                    <button
                      className="btn btn-sm btn-outline-secondary py-0"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(
                            {
                              event: "order.created",
                              id: "WEB-ORD-1001",
                              order_number: "1001",
                              total: 1450.0,
                              customer: {
                                name: "Tanvir Ahmed",
                                phone: "01711223344",
                                address: "House 24, Road 7, Dhanmondi, Dhaka",
                              },
                              items: [
                                {
                                  sku: "GDO-273540",
                                  quantity: 1,
                                  unit_price: 1450.0,
                                },
                              ],
                            },
                            null,
                            2
                          ),
                          "Order Payload"
                        )
                      }
                    >
                      <i className="bi bi-clipboard me-1"></i> Copy Payload
                    </button>
                  </div>
                  <pre className="bg-light text-dark border p-3 rounded-3 font-monospace small mb-0">
{`{
  "event": "order.created",
  "id": "WEB-ORD-1001",
  "order_number": "1001",
  "total": 1450.00,
  "customer": {
    "name": "Tanvir Ahmed",
    "phone": "01711223344",
    "address": "House 24, Road 7, Dhanmondi, Dhaka"
  },
  "items": [
    {
      "sku": "GDO-273540",
      "quantity": 1,
      "unit_price": 1450.00
    }
  ]
}`}
                  </pre>
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-bold text-dark">PHP / Laravel Example:</span>
                    <button
                      className="btn btn-sm btn-outline-secondary py-0"
                      onClick={() =>
                        copyToClipboard(
                          `$response = Http::withHeaders([\n    'X-Webhook-Secret' => '${secretToken}',\n])->post('${fullUrl}?sync=true', $orderData);`,
                          "Laravel snippet"
                        )
                      }
                    >
                      <i className="bi bi-clipboard me-1"></i> Copy
                    </button>
                  </div>
                  <pre className="bg-dark text-light p-3 rounded-3 font-monospace small mb-0">
{`// Laravel HTTP Client Example
use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'X-Webhook-Secret' => '${secretToken}',
    'Content-Type' => 'application/json',
])->post('${fullUrl}?sync=true', [
    'event' => 'order.created',
    'id' => (string) $order->id,
    'order_number' => $order->order_number,
    'total' => $order->grand_total,
    'customer' => [
        'name' => $order->customer_name,
        'phone' => $order->customer_phone,
        'address' => $order->shipping_address,
    ],
    'items' => [
        [
            'sku' => 'GDO-273540',
            'quantity' => 1,
            'unit_price' => 1450.00,
        ]
    ]
]);

$result = $response->json();
$stockwhiskInvoice = $result['invoice_no']; // e.g. "INV-000004"`}
                  </pre>
                </div>
              </div>
            ) : null}

            {/* TAB 4: LIVE TEST CONSOLE */}
            {activeDocTab === "tester" ? (
              <div className="vstack gap-3">
                <div className="alert alert-info border-0 rounded-3 mb-0 small">
                  <i className="bi bi-info-circle-fill me-2 text-primary"></i>
                  {lang === "bn"
                    ? "এই টেস্ট কনসোল দিয়ে আপনি এখনই আপনার ব্রাউজার থেকে সরাসরি এন্ডপয়েন্টটি যাচাই করে দেখতে পারেন।"
                    : "Use this console to execute live API calls against your provisioned endpoint right from the browser."}
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">
                      {lang === "bn" ? "টেস্ট প্রোডাক্ট SKU:" : "Test Product SKU:"}
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm font-monospace"
                      value={testSku}
                      onChange={(e) => setTestSku(e.target.value)}
                      placeholder="e.g. GDO-273540"
                    />
                  </div>
                  <div className="col-md-6 d-flex align-items-end gap-2">
                    <button
                      type="button"
                      disabled={testingEndpoint}
                      onClick={runStockCheckTest}
                      className="btn btn-outline-primary btn-sm flex-fill"
                    >
                      <i className="bi bi-box-seam me-1"></i>
                      {testingEndpoint ? "টেস্ট হচ্ছে…" : lang === "bn" ? "১. স্টক চেক টেস্ট (GET)" : "Test Stock Check"}
                    </button>
                    <button
                      type="button"
                      disabled={testingEndpoint}
                      onClick={runSampleOrderTest}
                      className="btn btn-success btn-sm flex-fill"
                    >
                      <i className="bi bi-bag-plus-fill me-1"></i>
                      {testingEndpoint ? "অর্ডার পাঠানো হচ্ছে…" : lang === "bn" ? "২. টেস্ট অর্ডার পাঠান (POST)" : "Send Test Order"}
                    </button>
                  </div>
                </div>

                {/* Test Result Display */}
                {testResult ? (
                  <div className="mt-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="small fw-bold text-dark">
                        {lang === "bn" ? "লাইভ রেসপন্স:" : "Live Response:"}{" "}
                        <span className={`badge ${testResult.ok ? "bg-success" : "bg-danger"}`}>
                          HTTP {testResult.status}
                        </span>
                      </span>
                      <span className="text-muted small">{testResult.action}</span>
                    </div>
                    <pre className="bg-dark text-light p-3 rounded-3 font-monospace small mb-0 overflow-auto" style={{ maxHeight: 260 }}>
                      {JSON.stringify(testResult.data || testResult.error, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="modal-footer bg-light d-flex justify-content-between">
            <a
              href="/api-docs.html"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
            >
              <i className="bi bi-box-arrow-up-right"></i>
              <span>{lang === "bn" ? "সম্পূর্ণ পাবলিক ডক ও ডেমো পেজ খুলুন" : "Open Public HTML Docs & Demo"}</span>
            </a>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              {lang === "bn" ? "বন্ধ করুন" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebsitesIntegrationPage() {
  const { lang } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [validatingId, setValidatingId] = useState<number | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [viewingFailuresChannel, setViewingFailuresChannel] = useState<IntegrationChannel | null>(null);
  const [channelFailures, setChannelFailures] = useState<ChannelFailure[]>([]);
  const [loadingFailures, setLoadingFailures] = useState(false);

  // Developer Documentation State
  const [selectedDocsChannel, setSelectedDocsChannel] = useState<IntegrationChannel | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form State
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    provider: "custom_webhook",
    base_url: "",
    api_key: "",
    api_secret: "",
    webhook_secret: "",
    sync_inventory: true,
    sync_orders: true,
  });

  const { data: rawChannels, error, loading: isLoading, mutate } = useApi<any>(
    "/integrations/channels/?category=ecommerce"
  );
  const channels: IntegrationChannel[] = Array.isArray(rawChannels)
    ? rawChannels
    : (rawChannels?.results || []);

  function copyToClipboard(text: string, label: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(label);
      toast.success(lang === "bn" ? `${label} ক্লিপবোর্ডে কপি হয়েছে!` : `${label} copied to clipboard!`);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  }

  function toggleSecretReveal(channelId: number) {
    setRevealedSecrets((prev) => ({ ...prev, [channelId]: !prev[channelId] }));
  }

  async function handleAddWebsite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const isCustom = form.provider === "custom_webhook" || form.provider === "custom";
      await api("/integrations/channels/", {
        method: "POST",
        body: {
          name: form.name,
          category: "ecommerce",
          provider: isCustom ? "custom_webhook" : form.provider,
          base_url: form.base_url || (isCustom ? "https://custom-site.local" : ""),
          config: {
            sync_inventory: form.sync_inventory,
            sync_orders: form.sync_orders,
          },
          api_key: isCustom ? "" : form.api_key,
          api_secret: isCustom ? "" : form.api_secret,
          webhook_secret: form.webhook_secret,
        },
      });

      toast.success(
        lang === "bn"
          ? "ওয়েবসাইট চ্যানেল সফলভাবে যুক্ত হয়েছে এবং Webhook/API এন্ডপয়েন্ট প্রস্তুত!"
          : "Website channel connected successfully with API & Webhook endpoint provisioned!"
      );
      setShowAddModal(false);
      setForm({
        name: "",
        provider: "custom_webhook",
        base_url: "",
        api_key: "",
        api_secret: "",
        webhook_secret: "",
        sync_inventory: true,
        sync_orders: true,
      });
      mutate();
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "ওয়েবসাইট যুক্ত করা সম্ভব হয়নি" : "Failed to connect website"));
    } finally {
      setSaving(false);
    }
  }

  async function handleValidateConnection(channel: IntegrationChannel) {
    setValidatingId(channel.id);
    try {
      const res = await api<{ success: boolean; message: string }>(
        `/integrations/channels/${channel.id}/validate-connection/`,
        { method: "POST" }
      );
      if (res?.success) {
        toast.success(
          lang === "bn"
            ? `সংযোগ সফল! ${channel.name} এর সাথে যোগাযোগ ভেরিফাইড হয়েছে`
            : `Connection successful! ${channel.name} validated`
        );
      } else {
        toast.error(res?.message || (lang === "bn" ? "ভ্যালিডেশন ব্যর্থ হয়েছে" : "Validation failed"));
      }
      mutate();
    } catch (err: any) {
      toast.error(
        err?.message || (lang === "bn" ? "কানেকশন ভ্যালিডেশন ব্যর্থ হয়েছে" : "Connection validation error")
      );
    } finally {
      setValidatingId(null);
    }
  }

  async function handleDisconnect(channel: IntegrationChannel) {
    if (!confirm(lang === "bn" ? `আপনি কি নিশ্চিত যে ${channel.name} এর সংযোগ বিচ্ছিন্ন করতে চান?` : `Are you sure you want to disconnect ${channel.name}?`)) {
      return;
    }
    setDisconnectingId(channel.id);
    try {
      await api(`/integrations/channels/${channel.id}/disconnect/`, { method: "POST" });
      toast.success(
        lang === "bn" ? `${channel.name} বিচ্ছিন্ন করা হয়েছে` : `${channel.name} disconnected`
      );
      mutate();
    } catch (err: any) {
      toast.error(err?.message || (lang === "bn" ? "বিচ্ছিন্ন করা সম্ভব হয়নি" : "Failed to disconnect"));
    } finally {
      setDisconnectingId(null);
    }
  }

  async function loadFailures(channel: IntegrationChannel) {
    setViewingFailuresChannel(channel);
    setLoadingFailures(true);
    try {
      const res = await api<{ results: ChannelFailure[] }>(
        `/integrations/events/?integration_id=${channel.id}&status=FAILED`
      );
      setChannelFailures(res?.results || []);
    } catch (err: any) {
      toast.error(lang === "bn" ? "ব্যর্থতা লগ লোড করা সম্ভব হয়নি" : "Failed to load failure events");
      setChannelFailures([]);
    } finally {
      setLoadingFailures(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <Spinner label={lang === "bn" ? "ওয়েবসাইট চ্যানেল লোড হচ্ছে…" : "Loading website channels…"} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorState error={error} />
      </div>
    );
  }

  const getFullEndpointUrl = (relativeUrl?: string) => {
    if (!relativeUrl) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${relativeUrl}`;
  };

  return (
    <div className="p-4 vstack gap-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="mb-1">
            <Link href="/app/integrations" className="text-muted text-decoration-none small">
              <i className="bi bi-arrow-left me-1"></i>
              {lang === "bn" ? "ইন্টিগ্রেশন ড্যাশবোর্ড" : "Integrations Dashboard"}
            </Link>
          </div>
          <h1 className="h4 fw-bold mb-1 text-dark">
            <i className="bi bi-globe2 me-2 text-primary"></i>
            {lang === "bn" ? "ওয়েবসাইট ও ই-কমার্স চ্যানেল" : "Website & E-Commerce Integrations"}
          </h1>
          <p className="text-muted small mb-0">
            {lang === "bn"
              ? "WooCommerce, Shopify এবং কাস্টম অনলাইন শপের জন্য রিয়েলটাইম স্টক চেক, রেজার্ভেশন ও অর্ডার ইন্টিগ্রেশন"
              : "Manage real-time order and stock sync with WooCommerce, Shopify, and custom websites"}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <a
            href="/api-docs.html"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          >
            <i className="bi bi-file-earmark-code"></i>
            <span>{lang === "bn" ? "পাবলিক API ডক ও ডেমো" : "Public API Docs & Demo"}</span>
          </a>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
            <i className="bi bi-plus-lg me-1"></i>
            {lang === "bn" ? "নতুন ওয়েবসাইট যুক্ত করুন" : "Connect Website"}
          </button>
        </div>
      </div>

      {/* Website Channels List */}
      <div className="row g-3">
        {channels && channels.length > 0 ? (
          channels.map((ch) => {
            const isCustom = ch.provider === "custom_webhook";
            const endpoint = ch.webhook_endpoint;
            const fullWebhookUrl = endpoint ? getFullEndpointUrl(endpoint.url) : "";
            const isSecretRevealed = revealedSecrets[ch.id] || false;

            return (
              <div key={ch.id} className="col-12">
                <div className="card shadow-sm border bg-white">
                  <div className="card-body">
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                      <div className="d-flex gap-3 align-items-center">
                        <div className="rounded-3 p-3 bg-light border text-primary fs-3">
                          <i
                            className={
                              ch.provider === "shopify"
                                ? "bi bi-bag-check-fill"
                                : ch.provider === "custom_webhook"
                                ? "bi bi-code-slash text-dark"
                                : "bi bi-cart3"
                            }
                          ></i>
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <h2 className="h5 fw-bold mb-0 text-dark">{ch.name}</h2>
                            <span
                              className={`badge ${
                                ch.status === "CONNECTED"
                                  ? "bg-success-subtle text-success"
                                  : ch.status === "ERROR"
                                  ? "bg-danger-subtle text-danger"
                                  : "bg-secondary-subtle text-secondary"
                              }`}
                            >
                              {ch.status_display}
                            </span>
                          </div>
                          <div className="text-muted small mt-1">
                            <span className="badge bg-light text-secondary border me-2">
                              {isCustom ? (lang === "bn" ? "কাস্টম ওয়েবসাইট (API Provider)" : "Custom Website (API Provider)") : ch.provider_display}
                            </span>
                            <span className="fw-mono me-3">{ch.base_url || "—"}</span>
                            <span>
                              <i className="bi bi-clock-history me-1"></i>
                              {lang === "bn" ? "সর্বশেষ সিঙ্ক:" : "Last Sync:"}{" "}
                              {ch.last_sync_at ? fmtDate(ch.last_sync_at) : lang === "bn" ? "এখনো হয়নি" : "Never"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="hstack gap-2 flex-wrap">
                        {isCustom && endpoint ? (
                          <button
                            onClick={() => setSelectedDocsChannel(ch)}
                            className="btn btn-outline-dark btn-sm fw-semibold"
                          >
                            <i className="bi bi-journal-code me-1 text-primary"></i>
                            {lang === "bn" ? "ডেভেলপার গাইড ও API ডক" : "Developer Docs & API"}
                          </button>
                        ) : null}

                        <button
                          onClick={() => handleValidateConnection(ch)}
                          disabled={validatingId === ch.id}
                          className="btn btn-outline-primary btn-sm"
                          title={lang === "bn" ? "কানেকশন টেস্ট করুন" : "Validate connection"}
                        >
                          <i className={`bi bi-plug-fill me-1 ${validatingId === ch.id ? "spin" : ""}`}></i>
                          {validatingId === ch.id
                            ? lang === "bn"
                              ? "যাচাই হচ্ছে…"
                              : "Testing…"
                            : lang === "bn"
                            ? "কানেকশন টেস্ট"
                            : "Validate"}
                        </button>

                        <Link
                          href={`/app/integrations/mappings?integration_id=${ch.id}`}
                          className="btn btn-outline-secondary btn-sm"
                        >
                          <i className="bi bi-arrow-left-right me-1"></i>
                          {lang === "bn" ? "ম্যাপিং দেখুন" : "Mappings"}
                        </Link>

                        <button onClick={() => loadFailures(ch)} className="btn btn-outline-warning btn-sm">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          {lang === "bn" ? "ব্যর্থতা দেখুন" : "Failures"}
                        </button>

                        {ch.status === "CONNECTED" ? (
                          <button
                            onClick={() => handleDisconnect(ch)}
                            disabled={disconnectingId === ch.id}
                            className="btn btn-outline-danger btn-sm"
                          >
                            <i className="bi bi-power me-1"></i>
                            {disconnectingId === ch.id
                              ? lang === "bn"
                                ? "বিচ্ছিন্ন হচ্ছে…"
                                : "Disconnecting…"
                              : lang === "bn"
                              ? "ডিসকানেক্ট"
                              : "Disconnect"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Developer Credentials Box for Custom Webhook / API Channels */}
                    {isCustom && endpoint ? (
                      <div className="mt-3 p-3 bg-light rounded-3 border">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="fw-semibold small text-dark d-flex align-items-center gap-2">
                            <i className="bi bi-key-fill text-primary"></i>
                            {lang === "bn" ? "কাস্টম ওয়েবসাইট ইন্টিগ্রেশন ক্রেডেনশিয়াল" : "Custom Website Integration Credentials"}
                          </span>
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            <i className="bi bi-check2-circle me-1"></i>
                            {lang === "bn" ? "সক্রিয় এন্ডপয়েন্ট" : "Active Endpoint"}
                          </span>
                        </div>

                        <div className="row g-2 align-items-center">
                          {/* Webhook URL */}
                          <div className="col-md-7">
                            <div className="input-group input-group-sm">
                              <span className="input-group-text bg-white text-muted small fw-semibold">
                                Webhook / API URL
                              </span>
                              <input
                                type="text"
                                readOnly
                                className="form-control bg-white font-monospace text-dark small"
                                value={fullWebhookUrl}
                              />
                              <button
                                className="btn btn-outline-secondary"
                                type="button"
                                onClick={() => copyToClipboard(fullWebhookUrl, "Webhook URL")}
                              >
                                <i className={copiedKey === "Webhook URL" ? "bi bi-check2 text-success" : "bi bi-clipboard"}></i>
                              </button>
                            </div>
                          </div>

                          {/* Secret Key */}
                          <div className="col-md-5">
                            <div className="input-group input-group-sm">
                              <span className="input-group-text bg-white text-muted small fw-semibold">
                                API / Secret Key
                              </span>
                              <input
                                type={isSecretRevealed ? "text" : "password"}
                                readOnly
                                className="form-control bg-white font-monospace text-dark small"
                                value={endpoint.secret_token}
                              />
                              <button
                                className="btn btn-outline-secondary"
                                type="button"
                                onClick={() => toggleSecretReveal(ch.id)}
                                title={isSecretRevealed ? "লুকান" : "দেখুন"}
                              >
                                <i className={isSecretRevealed ? "bi bi-eye-slash" : "bi bi-eye"}></i>
                              </button>
                              <button
                                className="btn btn-outline-secondary"
                                type="button"
                                onClick={() => copyToClipboard(endpoint.secret_token, "Secret Key")}
                              >
                                <i className={copiedKey === "Secret Key" ? "bi bi-check2 text-success" : "bi bi-clipboard"}></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Security Notice for Masked Secrets */}
                    <div className="mt-3 pt-3 border-top d-flex flex-wrap justify-content-between align-items-center small text-muted">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-shield-check text-success"></i>
                        <span>
                          {lang === "bn"
                            ? "API ক্রেডেনশিয়াল ও সিক্রেট টোকেন সম্পূর্ণ সুরক্ষিতভাবে ডেটাবেজে সংরক্ষিত।"
                            : "API credentials and secret tokens are securely protected and encrypted."}
                        </span>
                      </div>
                      {ch.credential?.overview ? (
                        <div className="hstack gap-2">
                          {ch.credential.overview.has_api_key ? (
                            <span className="badge bg-light text-dark border">
                              <i className="bi bi-key-fill me-1 text-secondary"></i>
                              API Key: {ch.credential.overview.api_key_masked || "••••"}
                            </span>
                          ) : null}
                          {ch.credential.overview.has_api_secret ? (
                            <span className="badge bg-light text-dark border">
                              <i className="bi bi-lock-fill me-1 text-secondary"></i>
                              Secret: [PROTECTED]
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-12">
            <div className="card shadow-sm border text-center py-5 bg-white">
              <i className="bi bi-globe2 fs-1 text-muted mb-3"></i>
              <h2 className="h5 fw-bold text-dark">
                {lang === "bn" ? "কোনো ওয়েবসাইট যুক্ত করা হয়নি" : "No Website Channels Connected"}
              </h2>
              <p className="text-muted small mx-auto" style={{ maxWidth: 450 }}>
                {lang === "bn"
                  ? "আপনার WooCommerce, Shopify বা কাস্টম কোডেড ওয়েবসাইট কানেক্ট করে সরাসরি স্টক এবং কাস্টমার অর্ডার স্টকহুইস্কে সিঙ্ক করুন।"
                  : "Connect your WooCommerce, Shopify, or custom website to synchronize real-time orders and inventory balance."}
              </p>
              <div>
                <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                  <i className="bi bi-plus-lg me-1"></i>
                  {lang === "bn" ? "ওয়েবসাইট কানেক্ট করুন" : "Connect Website"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connect Website Modal */}
      {showAddModal ? (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-globe2 me-2 text-primary"></i>
                  {lang === "bn" ? "নতুন ওয়েবসাইট ও চ্যানেল যুক্ত করুন" : "Connect New Website Channel"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <form onSubmit={handleAddWebsite}>
                <div className="modal-body vstack gap-3">
                  <div className="row g-3">
                    <div className="col-md-7">
                      <label className="form-label small fw-semibold">
                        {lang === "bn" ? "স্টোর / চ্যানেলের নাম *" : "Store / Channel Name *"}
                      </label>
                      <input
                        required
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="যেমন: My Custom Gadget Store"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label small fw-semibold">
                        {lang === "bn" ? "প্ল্যাটফর্ম / প্রোভাইডার *" : "Platform Provider *"}
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={form.provider}
                        onChange={(e) => setForm({ ...form, provider: e.target.value })}
                      >
                        <option value="custom_webhook">Custom Website (API & Webhook Provider)</option>
                        <option value="woocommerce">WooCommerce</option>
                        <option value="shopify">Shopify</option>
                      </select>
                    </div>
                  </div>

                  {form.provider === "custom_webhook" ? (
                    <div className="alert alert-info border-0 rounded-3 mb-0 small">
                      <div className="d-flex gap-2">
                        <i className="bi bi-info-circle-fill fs-5 text-primary"></i>
                        <div>
                          <div className="fw-bold mb-1">
                            {lang === "bn"
                              ? "StockWhisk কাস্টম ওয়েবসাইটকে সরাসরি API ও Webhook প্রদান করবে"
                              : "StockWhisk acts as the API & Webhook Provider for your custom site"}
                          </div>
                          <div className="text-muted">
                            {lang === "bn"
                              ? "আপনাকে কোনো API Key ইনপুট দিতে হবে না। চ্যানেল তৈরি হওয়ার সাথে সাথে StockWhisk একটি ডেডিকেটেড Webhook URL এবং সিক্রেট কী জেনারেট করবে, যা দিয়ে যেকোনো ডেভেলপার বা ফ্রেমওয়ার্ক (Next.js, Laravel, Django, Node.js) ১০ মিনিটে ইন্টিগ্রেশন সম্পন্ন করতে পারবে।"
                              : "No external API key input required. StockWhisk automatically generates a dedicated Webhook URL and Secret Token with ready-to-use code snippets for your web developer."}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className="form-label small fw-semibold">
                      {form.provider === "custom_webhook"
                        ? lang === "bn"
                          ? "ওয়েবসাইট ডোমেইন / URL (ঐচ্ছিক)"
                          : "Website Domain / URL (Optional)"
                        : lang === "bn"
                        ? "ওয়েবসাইট URL *"
                        : "Website Base URL *"}
                    </label>
                    <input
                      required={form.provider !== "custom_webhook"}
                      type="url"
                      className="form-control form-control-sm"
                      placeholder="https://example.com"
                      value={form.base_url}
                      onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    />
                  </div>

                  {form.provider !== "custom_webhook" ? (
                    <>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">
                            {lang === "bn" ? "কনজিউমার কি / API Key *" : "Consumer Key / API Key *"}
                          </label>
                          <input
                            required
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="ck_..."
                            value={form.api_key}
                            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">
                            {lang === "bn" ? "কনজিউমার সিক্রেট / API Secret *" : "Consumer Secret / API Secret *"}
                          </label>
                          <input
                            required
                            type="password"
                            className="form-control form-control-sm"
                            placeholder="cs_... (সুরক্ষিত ইনপুট)"
                            value={form.api_secret}
                            onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label small fw-semibold">
                          {lang === "bn" ? "ওয়েবহুক সিক্রেট (ঐচ্ছিক)" : "Webhook Secret (Optional)"}
                        </label>
                        <input
                          type="password"
                          className="form-control form-control-sm"
                          placeholder="ওয়েবহুক ভ্যালিডেশনের গোপন চাবি"
                          value={form.webhook_secret}
                          onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="card bg-light border-0 p-3 rounded-2">
                    <div className="form-check form-switch mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="syncInventory"
                        checked={form.sync_inventory}
                        onChange={(e) => setForm({ ...form, sync_inventory: e.target.checked })}
                      />
                      <label className="form-check-label small fw-semibold" htmlFor="syncInventory">
                        {lang === "bn" ? "স্বয়ংক্রিয় ইনভেন্টরি স্টক সিঙ্ক চালু রাখুন" : "Enable Automated Inventory Stock Sync"}
                      </label>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="syncOrders"
                        checked={form.sync_orders}
                        onChange={(e) => setForm({ ...form, sync_orders: e.target.checked })}
                      />
                      <label className="form-check-label small fw-semibold" htmlFor="syncOrders">
                        {lang === "bn" ? "স্বয়ংক্রিয় ইনবাউন্ড অর্ডার গ্রহণ চালু রাখুন" : "Enable Automated Inbound Order Processing"}
                      </label>
                    </div>
                  </div>

                  <div className="small text-muted d-flex align-items-center gap-2">
                    <i className="bi bi-shield-lock-fill text-success"></i>
                    <span>
                      {lang === "bn"
                        ? "নিরাপত্তা গ্যারান্টি: সমস্ত API কী ও সিক্রেট ডেটাবেজে সম্পূর্ণ সুরক্ষিতভাবে সংরক্ষিত থাকে।"
                        : "Security Guarantee: All API credentials are encrypted and stored safely."}
                    </span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowAddModal(false)}>
                    {lang === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                    {saving
                      ? lang === "bn"
                        ? "সংরক্ষণ হচ্ছে…"
                        : "Connecting…"
                      : form.provider === "custom_webhook"
                      ? lang === "bn"
                        ? "চ্যানেল তৈরি ও API জেনারেট করুন"
                        : "Create & Provision API"
                      : lang === "bn"
                      ? "কানেক্ট করুন"
                      : "Connect Website"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {/* Developer Docs & Live Tester Modal */}
      {selectedDocsChannel && selectedDocsChannel.webhook_endpoint ? (
        <DeveloperDocsModal
          channel={selectedDocsChannel}
          onClose={() => setSelectedDocsChannel(null)}
          lang={lang}
        />
      ) : null}

      {/* Failures Inspection Modal */}
      {viewingFailuresChannel ? (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow">
              <div className="modal-header bg-warning-subtle">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-warning"></i>
                  {viewingFailuresChannel.name} — {lang === "bn" ? "ব্যর্থতা ও ত্রুটি লগ" : "Failures & Errors"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setViewingFailuresChannel(null)}></button>
              </div>
              <div className="modal-body p-0">
                {loadingFailures ? (
                  <div className="py-5 text-center">
                    <Spinner label={lang === "bn" ? "ব্যর্থতা লোড হচ্ছে…" : "Loading failures…"} />
                  </div>
                ) : channelFailures.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                      <thead className="table-light">
                        <tr>
                          <th>{lang === "bn" ? "ইভেন্ট আইডি" : "Event ID"}</th>
                          <th>{lang === "bn" ? "ধরণ" : "Type"}</th>
                          <th>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</th>
                          <th>{lang === "bn" ? "চেষ্টা" : "Attempts"}</th>
                          <th>{lang === "bn" ? "বার্তা" : "Error Message"}</th>
                          <th>{lang === "bn" ? "সময়" : "Time"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelFailures.map((f) => (
                          <tr key={f.id}>
                            <td className="fw-mono">#{f.id}</td>
                            <td>
                              <span className="badge bg-light text-dark border">{f.event_type}</span>
                            </td>
                            <td>{f.error_category || "General"}</td>
                            <td>
                              {f.attempt_count} / {f.max_retries}
                            </td>
                            <td className="text-danger">{f.error_message || "—"}</td>
                            <td className="text-muted">{fmtDate(f.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-5 text-center text-muted">
                    <i className="bi bi-check-circle fs-2 text-success d-block mb-2"></i>
                    {lang === "bn" ? "কোনো ব্যর্থ ইভেন্ট পাওয়া যায়নি" : "No failed events found"}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setViewingFailuresChannel(null)}
                >
                  {lang === "bn" ? "বন্ধ করুন" : "Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
