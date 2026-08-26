"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { api } from "@/lib/api";
import { ErrorState, Spinner, money } from "@/components/ui";
import toast from "react-hot-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type DayTrend = { day: string; revenue: string; discount: string; tax: string };
type PaymentMethod = { method: string; total: string };
type TopCustomer = { customer__id: number; customer__name: string; total_spent: string; order_count: number };
type TopReturn = { sale_item__product__name: string; qty: string; refund_amount: string };
type Metrics = { revenue: string; cogs: string; gross_profit: string; expenses: string; net_profit: string; sales_count: number };
type Acquisition = { labels: string[]; new: number[]; returning: number[] };
type TopProduct = { product_id: number; product__name: string; qty: string; revenue: string; profit: string };
type CategorySale = { product__category__name: string | null; revenue: string };
type RecentTransaction = { id: number; invoice_number: string; created_at: string; total: number; payment_method: string; customer_name: string };
type LowStock = { id: number; name: string; sku: string; current_stock: number; reorder_level: number };
type SalesOverview = {
  total_sales: string; total_orders: number;
  this_month_sales: string; this_month_orders: number;
  today_sales: string; today_orders: number;
  last_month_sales: string; last_month_orders: number;
};
type ProfitPoint = { date: string; revenue: number; cost: number; profit: number; orders: number; margin: number; avg_profit: number };
type ProfitOverview = {
  summary: {
    gross_profit: number;
    total_cost: number;
    profit_margin: number;
    average_profit_per_order: number;
    revenue: number;
    completed_orders: number;
    total_investment?: number;
    purchase_investment?: number;
    capital_investment?: number;
    lifetime_investment?: number;
  };
  comparison: { gross_profit_change: number | null; total_cost_change: number | null; profit_margin_change: number | null; average_profit_per_order_change: number | null; has_previous: boolean };
  trend: ProfitPoint[];
  range: { key: string; start: string; end: string; bucket: string };
};

type PerfProduct = { product_id: number; product_name: string; sku: string; revenue: number; cost: number; profit: number; units_sold: number; margin: number; loss?: number };
type Profitability = {
  range: { key: string; start: string; end: string };
  top_profitable_products: PerfProduct[];
  top_loss_products: PerfProduct[];
  lowest_margin_products: PerfProduct[];
};

type PPMostSold = { product_id: number; product_name: string; sku: string; units_sold: number; revenue: number; orders: number; current_stock: number };
type PPLowStock = { product_id: number; product_name: string; sku: string; current_stock: number; minimum_stock: number; deficit: number; category: string };
type PPOutOfStock = { product_id: number; product_name: string; sku: string; current_stock: number; recent_units_sold: number; recent_revenue: number };
type ProductPerf = {
  range: { key: string; start: string; end: string };
  most_sold_products: PPMostSold[];
  low_stock_products: PPLowStock[];
  out_of_stock_products: PPOutOfStock[];
};

type RatioMetric = { percentage: number; total_count: number; fulfilled_count?: number; pending_count?: number; cancelled_count?: number };
type SalesTrendPoint = { date: string; sales: number; orders: number };
type ProfitabilityAnalytics = {
  range: { key: string; start: string; end: string; bucket: string };
  payment_metrics: {
    fulfill_payment_ratio: RatioMetric;
    pending_payment_ratio: RatioMetric;
    cancellation_ratio: RatioMetric;
  };
  sales_trend: SalesTrendPoint[];
};

type DashboardData = {
  trend: DayTrend[];
  payment_methods: PaymentMethod[];
  top_customers: TopCustomer[];
  top_returns: TopReturn[];
  metrics: Metrics;
  customer_acquisition: Acquisition;
  top_products: TopProduct[];
  sales_by_category: CategorySale[];
  recent_transactions: RecentTransaction[];
  low_stock: LowStock[];
  out_of_stock: LowStock[];
};

export default function ReportsPage() {
  const { t } = useLanguage();
  
  const PROFIT_RANGES: { key: string; label: string }[] = [
    { key: "today", label: t("rep_filter_today") },
    { key: "yesterday", label: t("rep_filter_yesterday") },
    { key: "7d", label: t("rep_filter_7d") },
    { key: "30d", label: t("rep_filter_30d") },
    { key: "this_month", label: t("rep_filter_this_month") },
    { key: "last_month", label: t("rep_filter_last_month") },
    { key: "this_quarter", label: t("rep_filter_this_quarter") },
    { key: "this_year", label: t("rep_filter_this_year") },
    { key: "all_time", label: "All Time / সব সময়" },
  ];

  const [data, setData] = useState<DashboardData | null>(null);
  const [overview, setOverview] = useState<SalesOverview | null>(null);
  const [reports, setReports] = useState<string[]>([]);

  // Profit Overview (independent date range)
  const [profitRange, setProfitRange] = useState("30d");
  const [profit, setProfit] = useState<ProfitOverview | null>(null);
  const [profitLoading, setProfitLoading] = useState(true);
  const [profitError, setProfitError] = useState("");
  const [profitReload, setProfitReload] = useState(0);
  const pTrendRef = useRef<HTMLCanvasElement>(null); const pTrendInst = useRef<any>(null);
  const pBarRef = useRef<HTMLCanvasElement>(null); const pBarInst = useRef<any>(null);
  const pMarginRef = useRef<HTMLCanvasElement>(null); const pMarginInst = useRef<any>(null);
  const pAvgRef = useRef<HTMLCanvasElement>(null); const pAvgInst = useRef<any>(null);

  // Profitability Performance (own date range)
  const [perfRange, setPerfRange] = useState("30d");
  const [perf, setPerf] = useState<Profitability | null>(null);
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfError, setPerfError] = useState("");
  const [perfReload, setPerfReload] = useState(0);
  const profRef = useRef<HTMLCanvasElement>(null); const profInst = useRef<any>(null);
  const lossRef = useRef<HTMLCanvasElement>(null); const lossInst = useRef<any>(null);
  const marginRef = useRef<HTMLCanvasElement>(null); const marginInst = useRef<any>(null);

  // Product Performance (own date range)
  const [ppRange, setPpRange] = useState("30d");
  const [pp, setPp] = useState<ProductPerf | null>(null);
  const [ppLoading, setPpLoading] = useState(true);
  const [ppError, setPpError] = useState("");
  const [ppReload, setPpReload] = useState(0);
  const mostSoldRef = useRef<HTMLCanvasElement>(null); const mostSoldInst = useRef<any>(null);

  // Profitability Analytics (own date range)
  const [paRange, setPaRange] = useState("30d");
  const [pa, setPa] = useState<ProfitabilityAnalytics | null>(null);
  const [paLoading, setPaLoading] = useState(true);
  const [paError, setPaError] = useState("");
  const [paReload, setPaReload] = useState(0);
  const fulfillRef = useRef<HTMLCanvasElement>(null); const fulfillInst = useRef<any>(null);
  const pendingRef = useRef<HTMLCanvasElement>(null); const pendingInst = useRef<any>(null);
  const cancelRef = useRef<HTMLCanvasElement>(null); const cancelInst = useRef<any>(null);
  const saleTrendRef = useRef<HTMLCanvasElement>(null); const saleTrendInst = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invPage, setInvPage] = useState(1);
  
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartInst = useRef<any>(null);
  
  const paymentChartRef = useRef<HTMLCanvasElement>(null);
  const paymentChartInst = useRef<any>(null);

  const acqChartRef = useRef<HTMLCanvasElement>(null);
  const acqChartInst = useRef<any>(null);

  const catChartRef = useRef<HTMLCanvasElement>(null);
  const catChartInst = useRef<any>(null);

  const topProdChartRef = useRef<HTMLCanvasElement>(null);
  const topProdChartInst = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dash, rep, ov] = await Promise.all([
          api<DashboardData>("/analytics/dashboard-comprehensive/", { params: { days: 30 } }),
          api<{ reports: string[] }>("/reports/").catch(() => ({ reports: [] })),
          api<SalesOverview>("/analytics/sales-overview/").catch(() => null),
        ]);
        if ((dash as any).error) {
          throw new Error((dash as any).error);
        }
        setData(dash);
        setOverview(ov);
        setReports((rep as any).reports || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Profit Overview: refetch whenever the selected range changes.
  useEffect(() => {
    let active = true;
    setProfitLoading(true); setProfitError("");
    api<ProfitOverview>("/analytics/profit-overview/", { params: { range: profitRange } })
      .then((d) => { if (active) setProfit(d); })
      .catch(() => { if (active) setProfitError("Unable to load profit analytics. Please try again."); })
      .finally(() => { if (active) setProfitLoading(false); });
    return () => { active = false; };
  }, [profitRange, profitReload]);

  // Build the 4 Profit Overview charts whenever the profit data changes.
  useEffect(() => {
    let animId: number;
    if (loading || !profit || !profit.trend || profit.trend.length === 0) return;

    animId = requestAnimationFrame(() => {
      const monthly = profit.range.bucket === "month";
      const hourly = profit.range.bucket === "hour";
      const labels = profit.trend.map((p) => {
        const d = new Date(p.date);
        if (hourly) return d.toLocaleTimeString(undefined, { hour: "numeric" });
        if (monthly) return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      });
      const REV = "#2f4b7c", COST = "#f95d6a", PROFIT = "#008c54", MARGIN = "#a05195";
      const tk = (v: number) => "৳" + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
      const moneyTip = { callbacks: { label: (c: any) => `${c.dataset.label}: ${tk(c.parsed?.y ?? c.raw ?? 0)}` } };

      // 1. Profit Trend (area line): Revenue / Cost / Gross Profit
      if (pTrendRef.current) {
        pTrendInst.current?.destroy();
        pTrendInst.current = new Chart(pTrendRef.current, {
          type: "line",
          data: { labels, datasets: [
            { label: "Revenue", data: profit.trend.map((p) => p.revenue), borderColor: REV, backgroundColor: "rgba(47,75,124,.10)", fill: true, tension: 0.3 },
            { label: "Total Cost", data: profit.trend.map((p) => p.cost), borderColor: COST, backgroundColor: "rgba(249,93,106,.08)", fill: true, tension: 0.3 },
            { label: "Gross Profit", data: profit.trend.map((p) => p.profit), borderColor: PROFIT, backgroundColor: "rgba(0,140,84,.12)", fill: true, tension: 0.3 },
          ] },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: moneyTip } },
        });
      }
      // 2. Revenue vs Cost vs Profit (grouped bar)
      if (pBarRef.current) {
        pBarInst.current?.destroy();
        pBarInst.current = new Chart(pBarRef.current, {
          type: "bar",
          data: { labels, datasets: [
            { label: "Revenue", data: profit.trend.map((p) => p.revenue), backgroundColor: REV },
            { label: "Cost", data: profit.trend.map((p) => p.cost), backgroundColor: COST },
            { label: "Profit", data: profit.trend.map((p) => p.profit), backgroundColor: PROFIT },
          ] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: moneyTip } },
        });
      }
      // 3. Profit Margin Trend (line, %)
      if (pMarginRef.current) {
        pMarginInst.current?.destroy();
        pMarginInst.current = new Chart(pMarginRef.current, {
          type: "line",
          data: { labels, datasets: [
            { label: "Profit Margin", data: profit.trend.map((p) => p.margin), borderColor: MARGIN, backgroundColor: "rgba(160,81,149,.10)", fill: true, tension: 0.3 },
          ] },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: (v: any) => v + "%" } } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => `Profit Margin: ${Number(c.parsed?.y ?? c.raw ?? 0).toFixed(2)}%` } } } },
        });
      }
      // 4. Average Profit Per Order (bar)
      if (pAvgRef.current) {
        pAvgInst.current?.destroy();
        pAvgInst.current = new Chart(pAvgRef.current, {
          type: "bar",
          data: { labels, datasets: [
            { label: "Avg. Profit / Order", data: profit.trend.map((p) => p.avg_profit), backgroundColor: PROFIT },
          ] },
          options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: {
              label: (c: any) => `Avg. Profit / Order: ${tk(c.parsed?.y ?? c.raw ?? 0)}`,
              afterLabel: (c: any) => `Orders: ${profit.trend[c.dataIndex]?.orders ?? 0}`,
            } } } },
        });
      }
    });

    return () => {
      cancelAnimationFrame(animId);
      pTrendInst.current?.destroy(); pBarInst.current?.destroy();
      pMarginInst.current?.destroy(); pAvgInst.current?.destroy();
    };
  }, [profit, loading]);

  // Profitability Performance: refetch on range change.
  useEffect(() => {
    let active = true;
    setPerfLoading(true); setPerfError("");
    api<Profitability>("/analytics/profitability-performance/", { params: { range: perfRange } })
      .then((d) => { if (active) setPerf(d); })
      .catch(() => { if (active) setPerfError("Unable to load profitability data. Please try again."); })
      .finally(() => { if (active) setPerfLoading(false); });
    return () => { active = false; };
  }, [perfRange, perfReload]);

  // Build the 3 horizontal-bar profitability charts.
  useEffect(() => {
    let animId: number;
    if (loading || !perf) return;

    animId = requestAnimationFrame(() => {
      const tk = (v: number) => "৳" + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
      const trunc = (s: string) => (s && s.length > 22 ? s.slice(0, 21) + "…" : s || "—");
      const hbar = (ref: any, inst: any, rows: PerfProduct[], color: string | string[], valueKey: (p: PerfProduct) => number, tip: (p: PerfProduct) => string[], isPct = false) => {
        if (!ref.current) return;
        inst.current?.destroy();
        if (rows.length === 0) { inst.current = null; return; }
        inst.current = new Chart(ref.current, {
          type: "bar",
          data: {
            labels: rows.map((p, i) => `#${i + 1} ${trunc(p.product_name)}`),
            datasets: [{ data: rows.map(valueKey), backgroundColor: color, borderRadius: 4 }],
          },
          options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            scales: { x: { ticks: { callback: (v: any) => (isPct ? v + "%" : tk(v)) } } },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: {
                title: (items: any) => items[0] ? (rows[items[0].dataIndex]?.product_name || "") : "",
                label: () => "",
                afterBody: (items: any) => items[0] ? tip(rows[items[0].dataIndex]) : [],
              } },
            },
          },
        });
      };

      hbar(profRef, profInst, perf.top_profitable_products, "#008c54", (p) => p.profit, (p) => [
        `Profit: ${tk(p.profit)}`, `Revenue: ${tk(p.revenue)}`, `Cost: ${tk(p.cost)}`,
        `Units Sold: ${p.units_sold}`, `Margin: ${p.margin.toFixed(2)}%`, ...(p.sku ? [`SKU: ${p.sku}`] : []),
      ]);
      hbar(lossRef, lossInst, perf.top_loss_products, "#d64550", (p) => p.loss ?? -p.profit, (p) => [
        `Loss: ${tk(p.loss ?? -p.profit)}`, `Revenue: ${tk(p.revenue)}`, `Cost: ${tk(p.cost)}`,
        `Units Sold: ${p.units_sold}`, `Margin: ${p.margin.toFixed(2)}%`, ...(p.sku ? [`SKU: ${p.sku}`] : []),
      ]);
      hbar(marginRef, marginInst, perf.lowest_margin_products, perf.lowest_margin_products.map((p) => (p.margin < 0 ? "#d64550" : "#ffa600")), (p) => p.margin, (p) => [
        `Profit Margin: ${p.margin.toFixed(2)}%`, `Profit: ${tk(p.profit)}`, `Revenue: ${tk(p.revenue)}`,
        `Cost: ${tk(p.cost)}`, `Units Sold: ${p.units_sold}`, ...(p.sku ? [`SKU: ${p.sku}`] : []),
      ], true);
    });

    return () => {
      cancelAnimationFrame(animId);
      profInst.current?.destroy(); lossInst.current?.destroy(); marginInst.current?.destroy();
    };
  }, [perf, loading]);

  // Product Performance: refetch on range change.
  useEffect(() => {
    let active = true;
    setPpLoading(true); setPpError("");
    api<ProductPerf>("/analytics/product-performance-overview/", { params: { range: ppRange } })
      .then((d) => { if (active) setPp(d); })
      .catch(() => { if (active) setPpError("Unable to load product performance data. Please try again."); })
      .finally(() => { if (active) setPpLoading(false); });
    return () => { active = false; };
  }, [ppRange, ppReload]);

  // Most Sold horizontal-bar chart.
  useEffect(() => {
    let animId: number;
    if (loading || !pp) return;

    animId = requestAnimationFrame(() => {
      const rows = pp.most_sold_products;
      const tk = (v: number) => "৳" + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
      const trunc = (s: string) => (s && s.length > 22 ? s.slice(0, 21) + "…" : s || "—");
      if (mostSoldRef.current) {
        mostSoldInst.current?.destroy();
        if (rows.length > 0) {
          mostSoldInst.current = new Chart(mostSoldRef.current, {
            type: "bar",
            data: { labels: rows.map((p, i) => `#${i + 1} ${trunc(p.product_name)}`), datasets: [{ data: rows.map((p) => p.units_sold), backgroundColor: "#2f4b7c", borderRadius: 4 }] },
            options: {
              indexAxis: "y", responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { callbacks: {
                title: (items: any) => items[0] ? (rows[items[0].dataIndex]?.product_name || "") : "",
                label: () => "",
                afterBody: (items: any) => items[0] ? [
                  `Units Sold: ${rows[items[0].dataIndex].units_sold}`, `Revenue: ${tk(rows[items[0].dataIndex].revenue)}`, `Orders: ${rows[items[0].dataIndex].orders}`,
                  `Current Stock: ${rows[items[0].dataIndex].current_stock}`, ...(rows[items[0].dataIndex].sku ? [`SKU: ${rows[items[0].dataIndex].sku}`] : []),
                ] : [],
              } } },
            },
          });
        } else { mostSoldInst.current = null; }
      }
    });

    return () => { cancelAnimationFrame(animId); mostSoldInst.current?.destroy(); };
  }, [pp, loading]);

  // Profitability Analytics: refetch on range change.
  useEffect(() => {
    let active = true;
    setPaLoading(true); setPaError("");
    api<ProfitabilityAnalytics>("/analytics/profitability-analytics/", { params: { range: paRange } })
      .then((d) => { if (active) setPa(d); })
      .catch(() => { if (active) setPaError("Unable to load profitability analytics."); })
      .finally(() => { if (active) setPaLoading(false); });
    return () => { active = false; };
  }, [paRange, paReload]);

  // Build the 3 donut charts + Sales Trend line.
  useEffect(() => {
    let animId: number;
    if (loading || !pa) return;

    animId = requestAnimationFrame(() => {
      const donut = (ref: any, inst: any, value: number, color: string) => {
        if (!ref.current) return;
        inst.current?.destroy();
        inst.current = new Chart(ref.current, {
          type: "doughnut",
          data: { labels: ["", ""], datasets: [{ data: [value, Math.max(0, 100 - value)], backgroundColor: [color, "rgba(148,163,184,.18)"], borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: "72%", plugins: { legend: { display: false }, tooltip: { enabled: false } } },
        });
      };
      const pm = pa.payment_metrics;
      if (pm.fulfill_payment_ratio.total_count > 0) donut(fulfillRef, fulfillInst, pm.fulfill_payment_ratio.percentage, "#008c54");
      else fulfillInst.current?.destroy();
      if (pm.pending_payment_ratio.total_count > 0) donut(pendingRef, pendingInst, pm.pending_payment_ratio.percentage, "#ffa600");
      else pendingInst.current?.destroy();
      if (pm.cancellation_ratio.total_count > 0) donut(cancelRef, cancelInst, pm.cancellation_ratio.percentage, "#d64550");
      else cancelInst.current?.destroy();

      // Sales Trend (area line)
      if (saleTrendRef.current && pa.sales_trend.length > 0) {
        saleTrendInst.current?.destroy();
        const monthly = pa.range.bucket === "month", hourly = pa.range.bucket === "hour";
        const tk = (v: number) => "৳" + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
        const labels = pa.sales_trend.map((p) => {
          const d = new Date(p.date);
          if (hourly) return d.toLocaleTimeString(undefined, { hour: "numeric" });
          if (monthly) return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
          return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        });
        saleTrendInst.current = new Chart(saleTrendRef.current, {
          type: "line",
          data: { labels, datasets: [{ label: "Sales", data: pa.sales_trend.map((p) => p.sales), borderColor: "#2f4b7c", backgroundColor: "rgba(47,75,124,.12)", fill: true, tension: 0.3, pointRadius: pa.sales_trend.length > 40 ? 0 : 2 }] },
          options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
            scales: { y: { ticks: { callback: (v: any) => tk(v) } } },
            plugins: { legend: { display: false }, tooltip: { callbacks: {
              label: (c: any) => `Sales: ${tk(c.parsed?.y ?? c.raw ?? 0)}`,
              afterLabel: (c: any) => `Orders: ${pa.sales_trend[c.dataIndex]?.orders ?? 0}`,
            } } },
          },
        });
      } else { saleTrendInst.current?.destroy(); }
    });

    return () => {
      cancelAnimationFrame(animId);
      fulfillInst.current?.destroy(); pendingInst.current?.destroy(); cancelInst.current?.destroy(); saleTrendInst.current?.destroy();
    };
  }, [pa, loading]);

  useEffect(() => {
    let animId: number;
    if (!data) return;

    animId = requestAnimationFrame(() => {
      // 1. Revenue & Discount Trend Line Chart
      if (trendChartRef.current) {
        if (trendChartInst.current) trendChartInst.current.destroy();
        trendChartInst.current = new Chart(trendChartRef.current, {
          type: "line",
          data: {
            labels: data.trend.map(t => new Date(t.day).toLocaleDateString()),
            datasets: [
              {
                label: "Revenue",
                data: data.trend.map(t => Number(t.revenue)),
                borderColor: "#008c54",
                backgroundColor: "rgba(0, 140, 84, 0.1)",
                fill: true,
                tension: 0.3
              },
              {
                label: "Discounts Given",
                data: data.trend.map(t => Number(t.discount)),
                borderColor: "#ffa600",
                backgroundColor: "rgba(255, 166, 0, 0.1)",
                fill: true,
                tension: 0.3
              }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      // 2. Payment Methods Doughnut Chart
      if (paymentChartRef.current) {
        if (paymentChartInst.current) paymentChartInst.current.destroy();
        paymentChartInst.current = new Chart(paymentChartRef.current, {
          type: "doughnut",
          data: {
            labels: data.payment_methods.map(p => p.method.toUpperCase()),
            datasets: [
              {
                data: data.payment_methods.map(p => Number(p.total)),
                backgroundColor: ["#003f5c", "#2f4b7c", "#665191", "#a05195", "#d45087", "#f95d6a", "#ff7c43", "#ffa600"]
              }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      // 3. New vs Returning Customers Stacked Bar Chart
      if (acqChartRef.current && data.customer_acquisition) {
        if (acqChartInst.current) acqChartInst.current.destroy();
        acqChartInst.current = new Chart(acqChartRef.current, {
          type: "bar",
          data: {
            labels: data.customer_acquisition.labels,
            datasets: [
              {
                label: "New Customers",
                data: data.customer_acquisition.new,
                backgroundColor: "#008c54",
              },
              {
                label: "Returning Customers",
                data: data.customer_acquisition.returning,
                backgroundColor: "#2f4b7c",
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: true },
              y: { stacked: true }
            }
          }
        });
      }

      // 4. Sales by Category Doughnut Chart
      if (catChartRef.current && data.sales_by_category) {
        if (catChartInst.current) catChartInst.current.destroy();
        catChartInst.current = new Chart(catChartRef.current, {
          type: "doughnut",
          data: {
            labels: data.sales_by_category.map(c => c.product__category__name || "Uncategorized"),
            datasets: [
              {
                data: data.sales_by_category.map(c => Number(c.revenue)),
                backgroundColor: ["#003f5c", "#2f4b7c", "#665191", "#a05195", "#d45087", "#f95d6a", "#ff7c43", "#ffa600"]
              }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      // 5. Top Products Horizontal Bar Chart
      if (topProdChartRef.current && data.top_products) {
        if (topProdChartInst.current) topProdChartInst.current.destroy();
        topProdChartInst.current = new Chart(topProdChartRef.current, {
          type: "bar",
          data: {
            labels: data.top_products.map(p => p.product__name.substring(0, 20) + (p.product__name.length > 20 ? "..." : "")),
            datasets: [
              {
                label: "Revenue",
                data: data.top_products.map(p => Number(p.revenue)),
                backgroundColor: "#008c54",
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y", // horizontal bar
          }
        });
      }
    });

    return () => {
      cancelAnimationFrame(animId);
      trendChartInst.current?.destroy();
      paymentChartInst.current?.destroy();
      acqChartInst.current?.destroy();
      catChartInst.current?.destroy();
      topProdChartInst.current?.destroy();
    };
  }, [data]);

  async function download(type: string, fmt: string) {
    try {
      const res: Response = await api(`/reports/export/`, { params: { type, export_format: fmt }, raw: true });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}.${fmt === "excel" ? "xlsx" : fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Could not export");
    }
  }

  if (loading) return <Spinner label="Loading reports…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const pct = (v: number) => `${Number(v || 0).toFixed(2)}%`;
  const changeBadge = (value: number | null | undefined, opts?: { pts?: boolean; goodWhenUp?: boolean }) => {
    const pts = opts?.pts ?? false;
    const goodWhenUp = opts?.goodWhenUp ?? true;
    if (value === null || value === undefined) return <span className="small text-secondary">{t("rep_no_prev_data")}</span>;
    const up = value > 0, down = value < 0;
    const good = (up && goodWhenUp) || (down && !goodWhenUp);
    const cls = value === 0 ? "text-secondary" : good ? "text-success" : "text-danger";
    const arrow = up ? "↑" : down ? "↓" : "→";
    const val = pts ? `${Math.abs(value).toFixed(2)} pts` : `${Math.abs(value).toFixed(1)}%`;
    return <span className={`small fw-medium ${cls}`}>{arrow} {val} <span className="text-secondary fw-normal">{t("rep_vs_prev")}</span></span>;
  };

  const overviewCards = overview ? [
    { icon: "bi-cash-stack", label: "Total Sales", value: money(overview.total_sales), accent: "primary" },
    { icon: "bi-receipt", label: "Total Orders", value: Number(overview.total_orders).toLocaleString(), accent: "info" },
    { icon: "bi-calendar3", label: "This Month Sales", value: money(overview.this_month_sales), accent: "primary" },
    { icon: "bi-calendar-check", label: "This Month Orders", value: Number(overview.this_month_orders).toLocaleString(), accent: "info" },
    { icon: "bi-cash-coin", label: "Today's Sales", value: money(overview.today_sales), accent: "success" },
    { icon: "bi-bag-check", label: "Today's Orders", value: Number(overview.today_orders).toLocaleString(), accent: "success" },
    { icon: "bi-clock-history", label: "Last Month's Sales", value: money(overview.last_month_sales), accent: "secondary" },
    { icon: "bi-archive", label: "Last Month's Orders", value: Number(overview.last_month_orders).toLocaleString(), accent: "secondary" },
  ] : [];

  return (
    <div className="vstack gap-4">
      {/* Sales Overview — headline KPI cards */}
      <section aria-labelledby="sales-overview-heading">
        <h2 id="sales-overview-heading" className="h5 fw-bold mb-3">{t("rep_sales_over")}</h2>
        {!overview ? (
          <div className="text-secondary small">{t("rep_sales_over_err")}</div>
        ) : (
          <div className="row g-3">
            {overviewCards.map((c) => (
              <div key={c.label} className="col-12 col-sm-6 col-xl-3">
                <div className="card shadow-sm h-100 border-0">
                  <div className="card-body d-flex align-items-center gap-3">
                    <span className={`d-inline-flex align-items-center justify-content-center rounded-3 bg-${c.accent} bg-opacity-10 text-${c.accent}`}
                          style={{ width: 46, height: 46, flex: "0 0 auto" }} aria-hidden="true">
                      <i className={`bi ${c.icon} fs-5`}></i>
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="small text-secondary text-truncate">{c.label}</div>
                      <div className="fs-4 fw-bold text-body lh-1 mt-1">{c.value}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Profit Overview — analytics + charts */}
      <section aria-labelledby="profit-overview-heading">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 id="profit-overview-heading" className="h5 fw-bold mb-0">{t("rep_profit_over")}</h2>
            <div className="small text-secondary">{t("rep_profit_over_desc")}</div>
          </div>
          <select className="form-select form-select-sm" style={{ width: "auto" }} value={profitRange}
            onChange={(e) => setProfitRange(e.target.value)} aria-label="Profit date range">
            {PROFIT_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        {profitError ? (
          <div className="alert alert-warning d-flex justify-content-between align-items-center py-2">
            <span>{profitError}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setProfitReload((x) => x + 1)}>{t("rep_retry")}</button>
          </div>
        ) : !profit ? (
          <div className="text-center py-5"><span className="spinner-border" /></div>
        ) : (
          <div className={`vstack gap-3 ${profitLoading ? "opacity-50" : ""}`} aria-busy={profitLoading}>
            {/* KPI cards */}
            <div className="row g-3">
              {[
                { icon: "bi-graph-up-arrow", label: t("acc_gross_profit") || "Gross Profit", value: money(String(profit.summary.gross_profit)), accent: "success", badge: changeBadge(profit.comparison.gross_profit_change) },
                { icon: "bi-cart-dash", label: t("acc_cogs") || "Total Cost (COGS)", value: money(String(profit.summary.total_cost)), accent: "danger", badge: changeBadge(profit.comparison.total_cost_change, { goodWhenUp: false }) },
                { icon: "bi-percent", label: "Profit Margin", value: pct(profit.summary.profit_margin), accent: "primary", badge: changeBadge(profit.comparison.profit_margin_change, { pts: true }) },
                { icon: "bi-wallet2", label: t("rep_investment") || "Total Investment", value: money(String(profit.summary.total_investment ?? 0)), accent: "info", badge: <span className="small text-muted">{lang === "bn" ? "ক্রয়:" : "Purchases:"} {money(String(profit.summary.purchase_investment ?? 0))}</span> },
                { icon: "bi-receipt-cutoff", label: "Avg. Profit / Order", value: money(String(profit.summary.average_profit_per_order)), accent: "secondary", badge: changeBadge(profit.comparison.average_profit_per_order_change) },
              ].map((c) => (
                <div key={c.label} className="col-12 col-sm-6 col-lg">
                  <div className="card shadow-sm h-100 border-0">
                    <div className="card-body">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <span className={`d-inline-flex align-items-center justify-content-center rounded-3 bg-${c.accent} bg-opacity-10 text-${c.accent}`}
                              style={{ width: 38, height: 38 }} aria-hidden="true"><i className={`bi ${c.icon}`}></i></span>
                        <span className="small text-secondary">{c.label}</span>
                      </div>
                      <div className="fs-4 fw-bold text-body lh-1">{c.value}</div>
                      <div className="mt-2">{c.badge}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {profit.trend.length === 0 ? (
              <div className="card border-0 shadow-sm"><div className="card-body text-center text-secondary py-5">{t("rep_no_profit")}</div></div>
            ) : (
              <>
                {/* Profit Trend */}
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <div className="fw-semibold">{t("rep_profit_trend")}</div>
                    <div className="small text-secondary mb-3">{t("rep_profit_trend_desc")}</div>
                    <div style={{ position: "relative", height: 300, width: "100%" }}><canvas ref={pTrendRef} /></div>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-lg-7">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <div className="fw-semibold mb-3">{t("rep_rev_cost_profit")}</div>
                        <div style={{ position: "relative", height: 280, width: "100%" }}><canvas ref={pBarRef} /></div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-lg-5">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <div className="fw-semibold">{t("rep_margin_trend")}</div>
                        <div className="small text-secondary mb-3">{t("rep_margin_trend_desc")}</div>
                        <div style={{ position: "relative", height: 280, width: "100%" }}><canvas ref={pMarginRef} /></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <div className="fw-semibold">{t("rep_avg_profit")}</div>
                    <div className="small text-secondary mb-3">{t("rep_avg_profit_desc")}</div>
                    <div style={{ position: "relative", height: 260, width: "100%" }}><canvas ref={pAvgRef} /></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Profitability Performance — per-product profit / loss / margin */}
      <section aria-labelledby="profitability-heading">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 id="profitability-heading" className="h5 fw-bold mb-0">{t("rep_profit_perf")}</h2>
            <div className="small text-secondary">{t("rep_profit_perf_desc")}</div>
          </div>
          <select className="form-select form-select-sm" style={{ width: "auto" }} value={perfRange}
            onChange={(e) => setPerfRange(e.target.value)} aria-label="Profitability date range">
            {PROFIT_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        {perfError ? (
          <div className="alert alert-warning d-flex justify-content-between align-items-center py-2">
            <span>{perfError}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setPerfReload((x) => x + 1)}>{t("rep_retry")}</button>
          </div>
        ) : !perf ? (
          <div className="text-center py-5"><span className="spinner-border" /></div>
        ) : (
          <div className={`vstack gap-3 ${perfLoading ? "opacity-50" : ""}`} aria-busy={perfLoading}>
            <div className="row g-3">
              {/* Top Profitable */}
              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="fw-semibold">{t("rep_top_prof")}</div>
                    <div className="small text-secondary mb-3">{t("rep_top_prof_desc")}</div>
                    {perf.top_profitable_products.length === 0 ? (
                      <div className="text-secondary small py-4 text-center">{t("rep_no_profit_data")}</div>
                    ) : (
                      <>
                        <div style={{ position: "relative", height: 240, width: "100%" }}><canvas ref={profRef} /></div>
                        <div className="small text-secondary mt-2">
                          <b>{perf.top_profitable_products[0].product_name}</b> {t("rep_generated_profit", { profit: money(String(perf.top_profitable_products[0].profit)) })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Top Loss */}
              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="fw-semibold">{t("rep_top_loss")}</div>
                    <div className="small text-secondary mb-3">{t("rep_top_loss_desc")}</div>
                    {perf.top_loss_products.length === 0 ? (
                      <div className="text-secondary small py-4 text-center">{t("rep_no_loss_data")}</div>
                    ) : (
                      <>
                        <div style={{ position: "relative", height: 240, width: "100%" }}><canvas ref={lossRef} /></div>
                        <div className="small text-danger mt-2">
                          <b>{perf.top_loss_products[0].product_name}</b> {t("rep_highest_loss", { loss: money(String(perf.top_loss_products[0].loss ?? -perf.top_loss_products[0].profit)) })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Lowest Margin */}
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="fw-semibold">{t("rep_low_margin")}</div>
                <div className="small text-secondary mb-3">{t("rep_low_margin_desc")}</div>
                {perf.lowest_margin_products.length === 0 ? (
                  <div className="text-secondary small py-4 text-center">{t("rep_no_profit_data")}</div>
                ) : (
                  <>
                    <div style={{ position: "relative", height: 260, width: "100%" }}><canvas ref={marginRef} /></div>
                    <div className="small text-secondary mt-2">
                      <b>{perf.lowest_margin_products[0].product_name}</b> {t("rep_lowest_margin", { margin: perf.lowest_margin_products[0].margin.toFixed(2) })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Product Performance — most sold / low stock / out of stock */}
      <section aria-labelledby="product-performance-heading">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 id="product-performance-heading" className="h5 fw-bold mb-0">{t("rep_prod_perf")}</h2>
            <div className="small text-secondary">{t("rep_prod_perf_desc")}</div>
          </div>
          <select className="form-select form-select-sm" style={{ width: "auto" }} value={ppRange}
            onChange={(e) => setPpRange(e.target.value)} aria-label="Product performance date range">
            {PROFIT_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        {ppError ? (
          <div className="alert alert-warning d-flex justify-content-between align-items-center py-2">
            <span>{ppError}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setPpReload((x) => x + 1)}>{t("rep_retry")}</button>
          </div>
        ) : !pp ? (
          <div className="text-center py-5"><span className="spinner-border" /></div>
        ) : (
          <div className={`vstack gap-3 ${ppLoading ? "opacity-50" : ""}`} aria-busy={ppLoading}>
            <div className="row g-3">
              {/* Most Sold */}
              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="fw-semibold">{t("rep_most_sold")}</div>
                    <div className="small text-secondary mb-3">{t("rep_most_sold_desc")}</div>
                    {pp.most_sold_products.length === 0 ? (
                      <div className="text-secondary small py-4 text-center">{t("rep_no_sales_data")}</div>
                    ) : (
                      <div style={{ position: "relative", height: 240, width: "100%" }}><canvas ref={mostSoldRef} /></div>
                    )}
                  </div>
                </div>
              </div>
              {/* Low Stock */}
              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="fw-semibold">{t("rep_low_stock")}</div>
                    <div className="small text-secondary mb-3">{t("rep_low_stock_desc")}</div>
                    {pp.low_stock_products.length === 0 ? (
                      <div className="text-secondary small py-4 text-center">{t("rep_no_low_stock")}</div>
                    ) : (
                      <div className="vstack gap-2">
                        {pp.low_stock_products.map((p) => {
                          const min = p.minimum_stock || 1;
                          const ratio = Math.min(1, p.current_stock / min);
                          const critical = ratio <= 0.34;
                          return (
                            <div key={p.product_id}>
                              <div className="d-flex justify-content-between small">
                                <span className="text-truncate fw-medium" title={p.product_name}>{p.product_name}</span>
                                <span className="text-secondary flex-shrink-0 ms-2">{p.current_stock} / {p.minimum_stock}</span>
                              </div>
                              <div className="progress mt-1" style={{ height: 8 }} role="progressbar" aria-valuenow={p.current_stock} aria-valuemin={0} aria-valuemax={p.minimum_stock}>
                                <div className={`progress-bar ${critical ? "bg-danger" : "bg-warning"}`} style={{ width: `${Math.max(6, ratio * 100)}%` }} />
                              </div>
                              <div className={`small ${critical ? "text-danger" : "text-warning"}`}>{critical ? "Critical" : "Needs reorder"}{p.sku ? ` · ${p.sku}` : ""}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Out of Stock */}
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="fw-semibold">{t("rep_out_stock_prod")}</div>
                <div className="small text-secondary mb-3">{t("rep_out_stock_prod_desc")}</div>
                {pp.out_of_stock_products.length === 0 ? (
                  <div className="text-secondary small py-4 text-center">{t("rep_all_in_stock")}</div>
                ) : (
                  <div className="row g-2">
                    {pp.out_of_stock_products.map((p) => (
                      <div key={p.product_id} className="col-12 col-md-6 col-xl-4">
                        <div className="border rounded-3 p-2 h-100 d-flex justify-content-between align-items-start gap-2">
                          <div style={{ minWidth: 0 }}>
                            <div className="fw-medium text-truncate" title={p.product_name}>{p.product_name}</div>
                            {p.sku && <div className="small text-secondary">SKU: {p.sku}</div>}
                            <div className="small text-secondary">{t("rep_recent_sales", { units: p.recent_units_sold, revenue: money(String(p.recent_revenue)) })}</div>
                          </div>
                          <span className="badge text-bg-danger flex-shrink-0">{t("rep_out")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Profitability Analytics — payment ratios + sales trend */}
      <section aria-labelledby="profitability-analytics-heading">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 id="profitability-analytics-heading" className="h5 fw-bold mb-0">{t("rep_prof_analytics")}</h2>
            <div className="small text-secondary">{t("rep_prof_analytics_desc")}</div>
          </div>
          <select className="form-select form-select-sm" style={{ width: "auto" }} value={paRange}
            onChange={(e) => setPaRange(e.target.value)} aria-label="Profitability analytics date range">
            {PROFIT_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        {paError ? (
          <div className="alert alert-warning d-flex justify-content-between align-items-center py-2">
            <span>{paError}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setPaReload((x) => x + 1)}>{t("rep_retry")}</button>
          </div>
        ) : !pa ? (
          <div className="text-center py-5"><span className="spinner-border" /></div>
        ) : (
          <div className={`vstack gap-3 ${paLoading ? "opacity-50" : ""}`} aria-busy={paLoading}>
            <div className="row g-3">
              {[
                { key: "fulfill", title: "Fulfill Payment Ratio", label: "Fully Paid", color: "success", m: pa.payment_metrics.fulfill_payment_ratio, count: pa.payment_metrics.fulfill_payment_ratio.fulfilled_count ?? 0, ref: fulfillRef, empty: "No payment data available for this period." },
                { key: "pending", title: "Pending Payment Ratio", label: "Pending", color: "warning", m: pa.payment_metrics.pending_payment_ratio, count: pa.payment_metrics.pending_payment_ratio.pending_count ?? 0, ref: pendingRef, empty: "No pending payment data available." },
                { key: "cancel", title: "Cancellation Ratio", label: "Cancelled", color: "danger", m: pa.payment_metrics.cancellation_ratio, count: pa.payment_metrics.cancellation_ratio.cancelled_count ?? 0, ref: cancelRef, empty: "No cancelled transactions found." },
              ].map((c) => (
                <div key={c.key} className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body text-center">
                      <div className="fw-semibold">{c.title}</div>
                      {c.m.total_count === 0 ? (
                        <div className="text-secondary small py-5">{c.empty}</div>
                      ) : (
                        <>
                          <div className="position-relative mx-auto my-2" style={{ height: 160, maxWidth: 200 }}>
                            <canvas ref={c.ref} aria-label={`${c.title}: ${c.m.percentage}%, ${c.count} of ${c.m.total_count} orders`} />
                            <div className="position-absolute top-50 start-50 translate-middle text-center">
                              <div className="fs-3 fw-bold lh-1">{c.m.percentage}%</div>
                              <div className={`small text-${c.color}`}>{c.label}</div>
                            </div>
                          </div>
                          <div className="small text-secondary">{t("rep_orders_count", { count: c.count, total: c.m.total_count })}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sales Trend */}
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="fw-semibold mb-1">{t("rep_sales_trend")}</div>
                {pa.sales_trend.length === 0 || pa.sales_trend.every((p) => p.sales === 0) ? (
                  <div className="text-secondary small py-5 text-center">{t("rep_no_sales_data")}</div>
                ) : (
                  <>
                    {(() => {
                      const pts = pa.sales_trend;
                      const total = pts.reduce((a, p) => a + p.sales, 0);
                      const avg = total / (pts.length || 1);
                      const best = pts.reduce((a, p) => (p.sales > a.sales ? p : a), pts[0]);
                      const fmtLbl = (d: string) => new Date(d).toLocaleDateString(undefined, pa.range.bucket === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" });
                      return (
                        <div className="row g-2 mb-3 small">
                          <div className="col-4"><div className="text-secondary">{t("rep_total_sales")}</div><div className="fw-bold">{money(String(total))}</div></div>
                          <div className="col-4"><div className="text-secondary">{t("rep_average")}</div><div className="fw-bold">{money(String(avg))}</div></div>
                          <div className="col-4"><div className="text-secondary">{t("rep_best_day", { bucket: pa.range.bucket === "hour" ? "hour" : "day" })}</div><div className="fw-bold">{best && best.sales > 0 ? `${fmtLbl(best.date)}` : "—"}</div></div>
                        </div>
                      );
                    })()}
                    <div style={{ position: "relative", height: 300, width: "100%" }}><canvas ref={saleTrendRef} /></div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Financial Metrics Summary */}
      <div className="row g-3">
        <div className="col-12 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">{t("rep_gross_rev")}</div>
              <div className="fs-4 fw-bold text-dark">{money(data.metrics.revenue)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">{t("rep_net_profit")}</div>
              <div className="fs-4 fw-bold text-success">{money(data.metrics.net_profit)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">{t("rep_total_orders")}</div>
              <div className="fs-4 fw-bold text-primary">{data.metrics.sales_count}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">{t("rep_discounts_given")}</div>
              <div className="fs-4 fw-bold text-warning">
                {money(data.trend.reduce((acc, t) => acc + Number(t.discount), 0).toString())}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Trends & Payments */}
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("rep_rev_discount_trend")}</div>
              <div style={{ height: 300 }}>
                <canvas ref={trendChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("rep_rev_method")}</div>
              <div style={{ height: 300 }}>
                <canvas ref={paymentChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Customer Acquisition & Top Products */}
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("rep_cust_acq")}</div>
              <div style={{ height: 300 }}>
                <canvas ref={acqChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("rep_top_selling")}</div>
              <div style={{ height: 300 }}>
                <canvas ref={topProdChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Sales by Category & Recent Transactions */}
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("rep_sales_cat")}</div>
              <div style={{ height: 300 }}>
                <canvas ref={catChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("rep_recent_tx")}</div>
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3">
                    <tr>
                      <th>{t("rep_date")}</th>
                      <th>{t("rep_invoice")}</th>
                      <th>{t("rep_customer")}</th>
                      <th>{t("rep_method")}</th>
                      <th className="text-end">{t("rep_amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_transactions.length === 0 ? (
                      <tr><td colSpan={5} className="text-secondary">{t("rep_no_tx")}</td></tr>
                    ) : (
                      data.recent_transactions.map((t) => (
                        <tr key={t.id}>
                          <td>{new Date(t.created_at).toLocaleString()}</td>
                          <td>
                            <Link href={`/app/sales/${t.id}`} className="text-decoration-none text-brand fw-medium">
                              {t.invoice_number}
                            </Link>
                          </td>
                          <td>{t.customer_name}</td>
                          <td className="text-capitalize">{t.payment_method}</td>
                          <td className="text-end fw-medium">{money(t.total.toString())}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Top Customers & High Return Products */}
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("rep_top_cust")}</div>
              <div className="table-responsive" style={{ maxHeight: 300 }}>
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3 sticky-top">
                    <tr>
                      <th>{t("rep_customer")}</th>
                      <th className="text-end">{t("rep_orders")}</th>
                      <th className="text-end">{t("rep_total_spent")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_customers.length === 0 ? (
                      <tr><td colSpan={3} className="text-secondary">{t("rep_no_cust")}</td></tr>
                    ) : (
                      data.top_customers.map((c) => (
                        <tr key={c.customer__id}>
                          <td>
                            <Link href={`/app/customers/${c.customer__id}`} className="text-decoration-none text-brand fw-medium">
                              {c.customer__name}
                            </Link>
                          </td>
                          <td className="text-end">{c.order_count}</td>
                          <td className="text-end">{money(c.total_spent)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="fw-semibold mb-3">{t("rep_high_return")}</div>
              <div className="table-responsive" style={{ maxHeight: 300 }}>
                <table className="table table-striped table-sm mb-0">
                  <thead className="thead-3 sticky-top">
                    <tr>
                      <th>{t("rep_product")}</th>
                      <th className="text-end">{t("rep_qty_return")}</th>
                      <th className="text-end">{t("rep_refund_amt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_returns.length === 0 ? (
                      <tr><td colSpan={3} className="text-secondary">{t("rep_no_return")}</td></tr>
                    ) : (
                      data.top_returns.map((r, i) => (
                        <tr key={i}>
                          <td>{r.sale_item__product__name}</td>
                          <td className="text-end text-danger">{Number(r.qty)}</td>
                          <td className="text-end text-danger">{money(r.refund_amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: Low Stock Alerts */}
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3 text-danger"><i className="bi bi-exclamation-triangle-fill me-2"></i>{t("rep_inv_status")}</div>
          <div className="table-responsive">
            <table className="table table-striped table-sm mb-0">
              <thead className="thead-3">
                <tr>
                  <th>{t("rep_product")}</th>
                  <th>{t("rep_sku")}</th>
                  <th className="text-end">{t("rep_curr_stock")}</th>
                  <th className="text-end">{t("rep_reorder_lvl")}</th>
                  <th className="text-end">{t("rep_status")}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const combined = [
                    ...data.out_of_stock.map(i => ({ ...i, _out: true })),
                    ...data.low_stock.map(i => ({ ...i, _out: false })),
                  ];
                  if (combined.length === 0) {
                    return <tr><td colSpan={5} className="text-secondary text-center">{t("rep_inv_healthy")}</td></tr>;
                  }
                  const PER = 20;
                  const pages = Math.ceil(combined.length / PER);
                  const page = Math.min(invPage, pages);
                  const slice = combined.slice((page - 1) * PER, page * PER);
                  return slice.map(item => (
                    <tr key={item.id}>
                      <td>
                        <Link href={`/app/products/${item.id}`} className="text-decoration-none text-brand fw-medium">
                          {item.name}
                        </Link>
                      </td>
                      <td>{item.sku}</td>
                      <td className={`text-end fw-bold ${item._out ? "text-danger" : "text-warning"}`}>{item.current_stock}</td>
                      <td className="text-end">{item.reorder_level}</td>
                      <td className="text-end">
                        {item._out
                          ? <span className="badge bg-danger">{t("rep_out_of_stock")}</span>
                          : <span className="badge bg-warning text-dark">{t("rep_low_stock_badge")}</span>}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {(() => {
            const total = data.out_of_stock.length + data.low_stock.length;
            const PER = 20;
            const pages = Math.ceil(total / PER);
            if (pages <= 1) return null;
            const page = Math.min(invPage, pages);
            return (
              <div className="d-flex align-items-center justify-content-between mt-3 flex-wrap gap-2">
                <span className="text-secondary small">
                  {t("rep_showing", { start: (page - 1) * PER + 1, end: Math.min(page * PER, total), total: total })}
                </span>
                <div className="btn-group btn-group-sm">
                  <button className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setInvPage(page - 1)}>{t("rep_prev")}</button>
                  <button className="btn btn-outline-secondary disabled">{t("rep_page", { page: page, pages: pages })}</button>
                  <button className="btn btn-outline-secondary" disabled={page >= pages} onClick={() => setInvPage(page + 1)}>{t("rep_next")}</button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Legacy Reports Export */}
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-3">{t("rep_export")}</div>
          {reports.length === 0 ? (
            <div className="text-secondary small">{t("rep_no_reports")}</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="thead-6">
                  <tr>
                    <th>{t("rep_report")}</th>
                    <th className="text-end">{t("rep_download")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r}>
                      <td className="text-capitalize">{r.replace(/_/g, " ")}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-brand" onClick={() => download(r, "csv")}>
                            CSV
                          </button>
                          <button className="btn btn-outline-brand" onClick={() => download(r, "excel")}>
                            Excel
                          </button>
                          <button className="btn btn-outline-brand" onClick={() => download(r, "pdf")}>
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
