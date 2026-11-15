"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CircleAlert, CircleDollarSign, PackageCheck, ShieldCheck, UsersRound, Activity, BarChart3 } from "lucide-react";
import type { Customer, Order, Product, StoreSettings } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { COD_PAYMENT_CURRENCY } from "@/lib/currency.mjs";
import { itemAmountInCurrency, orderAmountInCurrency, summarizeSalesByCurrency } from "@/lib/order-currency.mjs";

export type PeriodKey = "today" | "7d" | "30d" | "90d" | "year" | "custom";
export type PeriodFilter = { period: PeriodKey; from: string; to: string };
const dayMs = 86_400_000;

export function getRange(filter: PeriodFilter, now = new Date()) {
  let start = new Date(now);
  let end = new Date(now);
  if (filter.period === "today") { start.setHours(0,0,0,0); end.setHours(23,59,59,999); }
  if (filter.period === "7d") { start = new Date(now.getTime() - 6 * dayMs); start.setHours(0,0,0,0); end.setHours(23,59,59,999); }
  if (filter.period === "30d") { start = new Date(now.getTime() - 29 * dayMs); start.setHours(0,0,0,0); end.setHours(23,59,59,999); }
  if (filter.period === "90d") { start = new Date(now.getTime() - 89 * dayMs); start.setHours(0,0,0,0); end.setHours(23,59,59,999); }
  if (filter.period === "year") { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); }
  if (filter.period === "custom") {
    start = filter.from ? new Date(`${filter.from}T00:00:00`) : new Date(now.getTime() - 29 * dayMs);
    end = filter.to ? new Date(`${filter.to}T23:59:59.999`) : new Date(now);
    if (Number.isNaN(start.getTime())) start = new Date(now.getTime() - 29 * dayMs);
    if (Number.isNaN(end.getTime())) end = new Date(now);
  }
  return { start, end };
}

export function filterOrdersByPeriod(orders: Order[], filter: PeriodFilter) {
  const { start, end } = getRange(filter);
  return orders.filter((order) => {
    const time = new Date(order.createdAt).getTime();
    return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
  });
}

const recognizedRevenue = (order: Order) => order.status !== "cancelled" && order.status !== "refunded";
const safeNumber = (n: number) => Number.isFinite(n) ? n : 0;

function useMetrics(orders: Order[], products: Product[], customers: Customer[], filter: PeriodFilter, salesCurrency: string) {
  return useMemo(() => {
    const selected = filterOrdersByPeriod(orders, filter);
    const eligible = selected.filter((order) => recognizedRevenue(order) && orderAmountInCurrency(order, salesCurrency) !== null);
    const revenue = eligible.reduce((sum, order) => sum + safeNumber(orderAmountInCurrency(order, salesCurrency) || 0), 0);
    const refunded = selected.filter((order) => order.status === "refunded");
    const completed = selected.filter((order) => order.status === "completed");
    const pending = selected.filter((order) => order.status === "pending");
    const cancelled = selected.filter((order) => order.status === "cancelled");
    const uniqueEmails = new Set(selected.map((order) => order.customer.email.toLowerCase()).filter(Boolean));
    const customersInRange = customers.filter((customer) => {
      const time = new Date(customer.joinedAt).getTime();
      const { start, end } = getRange(filter);
      return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
    });
    const stockItems = products.filter((product) => product.stock > 0).length;
    const categoryRevenue = new Map<string, number>();
    const productRevenue = new Map<string, { name: string; quantity: number; revenue: number }>();
    const categoryLabels = new Map<string, string>();
    for (const product of products) categoryLabels.set(product.category, product.category.replaceAll("-", " "));
    for (const order of eligible) for (const item of order.items) {
      const value = itemAmountInCurrency(order, item, salesCurrency);
      if (value === null) continue;
      const product = products.find((candidate) => candidate.id === item.productId);
      if (product) categoryRevenue.set(product.category, (categoryRevenue.get(product.category) || 0) + value);
      const saved = productRevenue.get(item.productId) || { name: item.name, quantity: 0, revenue: 0 };
      saved.quantity += item.quantity;
      saved.revenue += value;
      productRevenue.set(item.productId, saved);
    }
    const topCategories = [...categoryRevenue].map(([slug, value]) => ({ name: categoryLabels.get(slug) || slug, value })).sort((a,b) => b.value-a.value).slice(0,6);
    const topProducts = [...productRevenue.values()].sort((a,b) => b.quantity-a.quantity).slice(0,6);
    const today = new Date();
    const monthOrders = orders.filter((order) => {
      const date = new Date(order.createdAt);
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() &&
        recognizedRevenue(order) && orderAmountInCurrency(order, salesCurrency) !== null;
    });
    const monthRevenue = monthOrders.reduce((sum, order) => sum + safeNumber(orderAmountInCurrency(order, salesCurrency) || 0), 0);
    const totalCustomers = customers.length || uniqueEmails.size;
    const periodDays = Math.max(1, Math.ceil((getRange(filter).end.getTime() - getRange(filter).start.getTime()) / dayMs));
    const { start: rangeStart } = getRange(filter);
    const previousStart = new Date(rangeStart.getTime() - periodDays * dayMs);
    const previousEnd = new Date(rangeStart.getTime() - 1);
    const previousNew = customers.filter((customer) => {
      const date = new Date(customer.joinedAt);
      return date >= previousStart && date <= previousEnd;
    }).length;
    const currentNew = customersInRange.length;
    const growth = previousNew > 0 ? ((currentNew - previousNew) / previousNew) * 100 : null;
    const salesCurrencySummary = summarizeSalesByCurrency(selected);
    return {
      selected, eligible, revenue, aov: eligible.length ? revenue / eligible.length : 0,
      refunded: refunded.length, completed: completed.length, pending: pending.length,
      cancelled: cancelled.length, orderCount: selected.length, totalCustomers,
      customersInRange: customersInRange.length, growth, stockItems,
      inventoryAvailability: products.length ? stockItems / products.length * 100 : null,
      completionRate: selected.length ? completed.length / selected.length * 100 : null,
      refundRate: selected.length ? refunded.length / selected.length * 100 : null,
      categoryShare: revenue > 0 && topCategories.length ? topCategories[0].value / revenue * 100 : null,
      topCategories, topProducts, monthRevenue,
      currencyRows: salesCurrencySummary.rows,
      unrecordedCurrencyOrders: salesCurrencySummary.unrecordedOrders,
    };
  }, [orders, products, customers, filter, salesCurrency]);
}

function makeBuckets(orders: Order[], filter: PeriodFilter, currency: string) {
  const { start, end } = getRange(filter);
  let count = 12;
  let unit: "hour" | "day" | "week" | "month" = "day";
  if (filter.period === "today") { count = 12; unit = "hour"; }
  else if (filter.period === "7d") { count = 7; unit = "day"; }
  else if (filter.period === "30d") { count = 15; unit = "day"; }
  else if (filter.period === "90d") { count = 13; unit = "week"; }
  else if (filter.period === "year") { count = 12; unit = "month"; }
  else {
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs));
    count = days <= 20 ? Math.min(20, days) : days <= 90 ? 13 : 12;
    unit = days <= 20 ? "day" : days <= 90 ? "week" : "month";
  }
  const span = end.getTime() - start.getTime() + 1;
  const step = span / count;
  const labels: string[] = [];
  const values: number[] = Array(count).fill(0);
  const ordersCount: number[] = Array(count).fill(0);
  for (let i = 0; i < count; i++) {
    const date = new Date(start.getTime() + step * i);
    labels.push(unit === "hour" ? `${String(date.getHours()).padStart(2,"0")}:00` : unit === "month" ? date.toLocaleDateString("en", { month: "short" }) : unit === "week" ? `${date.toLocaleDateString("en", { month: "short" })} ${date.getDate()}` : date.toLocaleDateString("en", { month: "short", day: "numeric" }));
  }
  for (const order of orders) {
    if (!recognizedRevenue(order)) continue;
    const time = new Date(order.createdAt).getTime();
    if (time < start.getTime() || time > end.getTime()) continue;
    const amount = orderAmountInCurrency(order, currency);
    const index = Math.min(count - 1, Math.max(0, Math.floor((time - start.getTime()) / step)));
    if (amount !== null) values[index] += amount;
    ordersCount[index] += 1;
  }
  return { labels, values, ordersCount };
}

function Kpi({ label, value, note, icon: Icon, accent = "gold", trend }: { label: string; value: string; note: string; icon: React.ComponentType<{ size?: number }>; accent?: string; trend?: number | null }) {
  return <article className={`admin-kpi admin-kpi-${accent}`}><div className="admin-kpi-top"><span>{label}</span><i><Icon size={16} /></i></div><strong>{value}</strong><div className="admin-kpi-bottom"><span>{note}</span>{trend !== undefined && trend !== null && <b className={trend >= 0 ? "trend-positive" : "trend-negative"}>{trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(trend).toFixed(0)}%</b>}</div></article>;
}

function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) {
  return <article className={`analytics-chart-card ${className}`}><div className="analytics-chart-heading"><div><strong>{title}</strong><span>{subtitle}</span></div><button aria-label={`More about ${title}`} title="Based on recorded orders"><CircleAlert size={14} /></button></div>{children}</article>;
}

function EmptyChart({ message = "No order records in this period yet." }: { message?: string }) {
  return <div className="chart-empty"><span className="chart-empty-icon"><Activity size={19} /></span><span>{message}</span></div>;
}

function CurrencySalesBreakdown({ rows, unrecorded, selectedCurrency, onSelect }: {
  rows: { currency: string; amount: number; orders: number }[];
  unrecorded: number;
  selectedCurrency: string;
  onSelect: (currency: string) => void;
}) {
  return <div className="analytics-currency-breakdown">
    {rows.length ? rows.map((row) => <button type="button" className={`analytics-currency-row ${selectedCurrency === row.currency ? "analytics-currency-row-active" : ""}`} key={row.currency} onClick={() => onSelect(row.currency)}>
      <span><strong>{row.currency}</strong><small>{row.orders} recorded {row.orders === 1 ? "order" : "orders"}</small></span>
      <b>{formatMoney(row.amount, row.currency)}</b>
    </button>) : <EmptyChart message="No currency-snapshotted sales in this period." />}
    {rows.length > 0 && <p className="analytics-currency-view-note">An order may appear once in its base currency and once in its payment currency. Rows are alternative snapshots, not additive.</p>}
    {unrecorded > 0 && <p className="analytics-currency-unrecorded"><CircleAlert size={13} />{unrecorded} legacy {unrecorded === 1 ? "order has" : "orders have"} no currency snapshot; amount excluded rather than guessed.</p>}
  </div>;
}

function LineChart({ series, currency }: { series: ReturnType<typeof makeBuckets>; currency: string }) {
  const values = series.values;
  const width = 700, height = 218, left = 48, right = 8, top = 14, bottom = 38;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => ({
    x: left + (index / Math.max(1, values.length - 1)) * (width - left - right),
    y: top + (1 - value / max) * (height - top - bottom),
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${path} L ${points.at(-1)?.x || left},${height-bottom} L ${points[0]?.x || left},${height-bottom} Z`;
  const yLabels = [max, max * 0.5, 0];
  return <div className="chart-svg-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue line chart"><defs><linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--admin-chart)" stopOpacity=".25" /><stop offset="100%" stopColor="var(--admin-chart)" stopOpacity="0" /></linearGradient></defs>{yLabels.map((label, index) => { const y = top + index * (height-top-bottom)/2; return <g key={index}><line x1={left} y1={y} x2={width-right} y2={y} className="chart-grid-line" /><text x={left-8} y={y+3} textAnchor="end" className="chart-axis-label">{formatShort(label, currency)}</text></g>; })}<path d={area} fill="url(#revenueArea)" /><path d={path} fill="none" className="chart-line-path" />{points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={values[index] > 0 ? 3.5 : 2} className="chart-point"><title>{series.labels[index]} · {formatMoney(values[index], currency)}</title></circle>)}{series.labels.map((label, index) => index % Math.max(1, Math.ceil(series.labels.length / 7)) === 0 || index === series.labels.length - 1 ? <text key={index} x={points[index].x} y={height-9} textAnchor="middle" className="chart-axis-label">{label}</text> : null)}</svg>{values.every((value) => value === 0) && <EmptyChart />}</div>;
}

function BarChart({ series, currency, mode = "revenue" }: { series: ReturnType<typeof makeBuckets>; currency: string; mode?: "revenue" | "orders" }) {
  const values = mode === "orders" ? series.ordersCount : series.values;
  const max = Math.max(...values, 1);
  const shown = values.length > 16 ? values.slice(-16) : values;
  const labels = series.labels.length > 16 ? series.labels.slice(-16) : series.labels;
  return <div className="chart-bars" role="img" aria-label={mode === "orders" ? "Orders by interval" : "Sales by interval"}>{shown.map((value, index) => <div className="chart-bar-column" key={`${labels[index]}-${index}`}><div className="chart-bar-area"><i style={{ height: `${Math.max(value > 0 ? 3 : 1, value / max * 100)}%` }} title={`${labels[index]} · ${mode === "orders" ? value : formatMoney(value, currency)}`} /></div><span>{labels[index]}</span></div>)}{values.every((value) => value === 0) && <EmptyChart />}</div>;
}

function formatShort(value: number, currency: string) {
  if (!value) return "0";
  const number = value / 1000;
  return `${currency === "PKR" ? "Rs " : ""}${number >= 1000 ? `${(number / 1000).toFixed(1)}m` : `${Math.round(number)}k`}`;
}

function Ring({ label, value, display, note, color = "gold", unavailable = false }: { label: string; value: number | null; display?: string; note: string; color?: string; unavailable?: boolean }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return <article className={`metric-ring-card ring-${color} ${unavailable || value === null ? "ring-unavailable" : ""}`}><div className="ring-visual" style={{ "--ring-value": `${safeValue}%` } as React.CSSProperties}><div className="ring-center"><strong>{unavailable || value === null ? "—" : display || `${Math.round(value)}%`}</strong><span>{unavailable || value === null ? "N/A" : "OF RANGE"}</span></div></div><div className="ring-copy"><strong>{label}</strong><small>{note}</small></div></article>;
}

function HorizontalRank({ rows, currency, emptyLabel }: { rows: { name: string; value: number; quantity?: number }[]; currency: string; emptyLabel: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="rank-list">{rows.length ? rows.map((row, index) => <div className="rank-row" key={`${row.name}-${index}`}><span className="rank-index">{String(index+1).padStart(2,"0")}</span><div className="rank-main"><span>{row.name}</span><i><b style={{ width: `${Math.max(3, row.value / max * 100)}%` }} /></i></div><strong>{row.quantity !== undefined ? `${row.quantity} sold` : formatMoney(row.value, currency)}</strong></div>) : <EmptyChart message={emptyLabel} />}</div>;
}

export default function AnalyticsDashboard({ orders, products, customers, settings, period, setPeriod }: {
  orders: Order[]; products: Product[]; customers: Customer[]; settings: StoreSettings;
  period: PeriodFilter; setPeriod: (value: PeriodFilter) => void;
}) {
  const [salesCurrency, setSalesCurrency] = useState(COD_PAYMENT_CURRENCY);
  const metrics = useMetrics(orders, products, customers, period, salesCurrency);
  const series = useMemo(() => makeBuckets(metrics.selected, period, salesCurrency), [metrics.selected, period, salesCurrency]);
  const customChange = (field: "from" | "to", value: string) => setPeriod({ ...period, period: "custom", [field]: value });
  const previous = period.period === "custom" ? "Selected dates" : period.period === "year" ? "This year" : period.period === "today" ? "Today" : period.period === "7d" ? "Last 7 days" : period.period === "30d" ? "Last 30 days" : "Last 90 days";
  const currencyOptions = Array.from(new Set([COD_PAYMENT_CURRENCY, settings.currency, ...metrics.currencyRows.map((row) => row.currency)])).sort();
  const targetComparable = settings.currency === salesCurrency;
  return <div className="analytics-page-content">
    <div className="admin-page-title"><div><span className="eyebrow">REAL STORE RECORDS · {previous.toUpperCase()}</span><h1>Numbers, with context.</h1><p>Everything below is calculated from recorded catalog, order and customer data. Empty periods stay empty.</p></div><div className="analytics-range"><label><span>SALES CURRENCY</span><select value={salesCurrency} onChange={(event) => setSalesCurrency(event.target.value)}>{currencyOptions.map((currency) => <option value={currency} key={currency}>{currency}{currency === COD_PAYMENT_CURRENCY ? " · COD" : ""}</option>)}</select></label><label><span>PERIOD</span><select value={period.period} onChange={(event) => setPeriod({ ...period, period: event.target.value as PeriodKey })}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="year">This year</option><option value="custom">Custom dates</option></select></label>{period.period === "custom" && <><label><span>FROM</span><input type="date" value={period.from} onChange={(event) => customChange("from", event.target.value)} /></label><label><span>TO</span><input type="date" value={period.to} onChange={(event) => customChange("to", event.target.value)} /></label></>}</div></div>
    <div className="admin-kpi-grid"><Kpi label={`Recorded sales · ${salesCurrency}`} value={formatMoney(metrics.revenue, salesCurrency)} note={metrics.eligible.length ? `${metrics.eligible.length} non-cancelled, non-refunded orders in ${salesCurrency}` : `No currency-snapshotted ${salesCurrency} sales in range`} icon={CircleDollarSign} /><Kpi label="Orders" value={metrics.orderCount.toLocaleString()} note={`${metrics.pending} awaiting action · across currencies`} icon={PackageCheck} accent="blue" /><Kpi label={`Average order · ${salesCurrency}`} value={metrics.eligible.length ? formatMoney(metrics.aov, salesCurrency) : "—"} note={metrics.eligible.length ? "Sales / eligible orders in this currency" : "Available after a currency-snapshotted order"} icon={BarChart3} accent="purple" /><Kpi label="Customers" value={metrics.totalCustomers.toLocaleString()} note={customers.length ? `${metrics.customersInRange} joined in range` : "Derived from recorded orders"} icon={UsersRound} accent="mint" /></div>
    <div className="analytics-chart-grid"><ChartCard title="Sales by currency" subtitle="Saved base and payment snapshots are grouped separately; currency rows are alternative views, never added together." className="chart-card-wide"><CurrencySalesBreakdown rows={metrics.currencyRows} unrecorded={metrics.unrecordedCurrencyOrders} selectedCurrency={salesCurrency} onSelect={setSalesCurrency} /></ChartCard><ChartCard title="Revenue over time" subtitle={`Recorded order value · ${salesCurrency} · ${previous.toLowerCase()}`} className="chart-card-wide"><LineChart series={series} currency={salesCurrency} /></ChartCard><ChartCard title="Daily orders" subtitle="Recorded orders across currencies"><BarChart series={series} currency={salesCurrency} mode="orders" /></ChartCard><ChartCard title="Sales by interval" subtitle={`Saved payment amount · ${salesCurrency}`}><BarChart series={series} currency={salesCurrency} /></ChartCard><ChartCard title="Monthly sales graph" subtitle={`Monthly buckets · ${salesCurrency}`}><LineChart series={series} currency={salesCurrency} /></ChartCard><ChartCard title="Revenue by year" subtitle={`Recorded payment totals · ${salesCurrency}`}><YearChart orders={metrics.selected} currency={salesCurrency} /></ChartCard><ChartCard title="Order status mix" subtitle="Current selected period · all currencies"><StatusChart orders={metrics.selected} /></ChartCard><ChartCard title="Category sales" subtitle={`Order line items converted by saved order rate · ${salesCurrency}`}><HorizontalRank rows={metrics.topCategories} currency={salesCurrency} emptyLabel="Category sales appear after a currency-snapshotted checkout." /></ChartCard><ChartCard title="Top-selling products" subtitle="Units ordered in the selected currency"><HorizontalRank rows={metrics.topProducts.map((row) => ({ name: row.name, value: row.quantity, quantity: row.quantity }))} currency={salesCurrency} emptyLabel="Top sellers appear after products are ordered." /></ChartCard></div>
    <div className="ring-section-heading"><div><span className="eyebrow">THE SIGNALS BEHIND THE NUMBERS</span><h2>Progress, honestly measured.</h2></div><span><ShieldCheck size={14} />No traffic or conversion estimate is fabricated.</span></div>
    <div className="metric-rings-grid"><Ring label="Sales target achievement" value={settings.salesTarget > 0 && targetComparable ? metrics.revenue / settings.salesTarget * 100 : null} note={settings.salesTarget <= 0 ? "Set a target in Store Settings to measure progress" : targetComparable ? `Selected-period ${salesCurrency} sales vs ${formatMoney(settings.salesTarget, settings.currency)} target` : `Target is stored in ${settings.currency}; select that currency before comparing.`} unavailable={settings.salesTarget <= 0 || !targetComparable} /><Ring label="Monthly revenue progress" value={settings.salesTarget > 0 && targetComparable ? metrics.monthRevenue / settings.salesTarget * 100 : null} note={settings.salesTarget <= 0 ? "No monthly target configured" : targetComparable ? `${formatMoney(metrics.monthRevenue, salesCurrency)} month-to-date vs configured target` : `Target and recorded sales use different currencies (${settings.currency} vs ${salesCurrency}).`} unavailable={settings.salesTarget <= 0 || !targetComparable} color="blue" /><Ring label="Order completion" value={metrics.completionRate} note={`${metrics.completed} completed of ${metrics.orderCount} recorded orders`} color="mint" /><Ring label="Customer growth" value={metrics.growth === null ? null : Math.max(0, metrics.growth)} display={metrics.growth === null ? undefined : `${metrics.growth > 0 ? "+" : ""}${Math.round(metrics.growth)}%`} note={metrics.growth === null ? "Not enough prior customer history for a comparison" : `${metrics.customersInRange} new vs previous equal period`} color="purple" /><Ring label="Inventory availability" value={metrics.inventoryAvailability} note={`${metrics.stockItems} of ${products.length} active products have stock`} color="mint" /><Ring label="Conversion rate" value={null} note="Not available — traffic tracking is not configured" unavailable color="blue" /><Ring label="Top category contribution" value={metrics.categoryShare} note={metrics.topCategories[0] ? `${metrics.topCategories[0].name} · ${formatMoney(metrics.topCategories[0].value, salesCurrency)} in the selected period` : "Needs order data before it can be measured"} color="gold" /><Ring label="Return / refund rate" value={metrics.refundRate} note={`${metrics.refunded} refunded of ${metrics.orderCount} recorded orders`} color="purple" /></div>
    <div className="analytics-footnote"><CircleAlert size={15} /><span>Sales exclude cancelled and refunded orders. Totals, averages, charts and category sales use saved base or payment snapshots in the selected currency; unlike currencies are never added together. Legacy orders without a currency snapshot are counted separately and excluded from amount totals. Customer growth uses first-seen customer records; local preview orders remain in this browser.</span></div>
  </div>;
}

function YearChart({ orders, currency }: { orders: Order[]; currency: string }) {
  const now = new Date().getFullYear();
  const years = Array.from({ length: 5 }).map((_, index) => now - 4 + index);
  const sums = years.map((year) => orders.filter((order) => new Date(order.createdAt).getFullYear() === year && recognizedRevenue(order)).reduce((total, order) => total + safeNumber(orderAmountInCurrency(order, currency) || 0), 0));
  const max = Math.max(...sums, 1);
  return <div className="year-chart">{years.map((year, index) => <div className="year-chart-row" key={year}><span>{year}</span><div><i style={{ width: `${Math.max(sums[index] ? 3 : 0, sums[index] / max * 100)}%` }} /></div><strong>{formatShort(sums[index], currency)}</strong></div>)}{sums.every((value) => value === 0) && <EmptyChart message="No yearly sales records yet." />}</div>;
}

function StatusChart({ orders }: { orders: Order[] }) {
  const statuses = ["completed", "processing", "pending", "shipped", "cancelled", "refunded"];
  const count = (status: string) => orders.filter((order) => order.status === status).length;
  const total = Math.max(1, orders.length);
  return <div className="status-chart">{orders.length ? statuses.map((status) => <div className="status-chart-row" key={status}><span className={`status-dot status-dot-${status}`} /><span>{status}</span><i><b style={{ width: `${count(status) / total * 100}%` }} /></i><strong>{count(status)}</strong></div>) : <EmptyChart message="Order statuses appear after a customer checks out." />}</div>;
}
