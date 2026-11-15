"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, ClipboardList, Download, ExternalLink, Eye, Search, ShieldCheck, Truck, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/utils";
import { isCurrencyCode } from "@/lib/currency.mjs";
import { orderRecordedSnapshot } from "@/lib/order-currency.mjs";
import type { Customer, Order, OrderStatus } from "@/lib/types";

const statusOptions: OrderStatus[] = ["pending", "processing", "shipped", "completed", "cancelled", "refunded"];
const statusTitle: Record<OrderStatus, string> = { pending: "Pending", processing: "Processing", shipped: "Shipped", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded" };

function formatOrderTotal(order: Order) {
  if (order.paymentTotal !== undefined && isCurrencyCode(order.paymentCurrency)) return formatMoney(order.paymentTotal, order.paymentCurrency);
  if (isCurrencyCode(order.currency)) return formatMoney(order.total, order.currency);
  return `${order.total.toLocaleString()} · currency not recorded`;
}

function formatBaseAmount(amount: number, currency?: string) {
  return isCurrencyCode(currency) ? formatMoney(amount, currency) : `${amount.toLocaleString()} · currency not recorded`;
}

function formatRecordedCustomerSpend(orders: Order[]) {
  const totals = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "cancelled" || order.status === "refunded") continue;
    const currency = order.paymentCurrency;
    if (order.paymentTotal === undefined || typeof currency !== "string" || !isCurrencyCode(currency)) continue;
    totals.set(currency, (totals.get(currency) || 0) + order.paymentTotal);
  }
  return totals.size ? [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => formatMoney(value, currency)).join(" · ") : "Currency not recorded";
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export function OrdersManager() {
  const { orders, updateOrder, notify } = useStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => orders.filter((order) => {
    const text = `${order.orderNo} ${order.customer.name} ${order.customer.email} ${order.address.city}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (status === "all" || order.status === status);
  }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [orders, query, status]);
  const update = async (order: Order, patch: Partial<Order>) => {
    setSaving(true); const ok = await updateOrder(order.id, patch); setSaving(false);
    if (ok) { setSelected({ ...order, ...patch }); notify("Order updated."); }
  };
  return <div className="admin-management-page"><div className="admin-stat-strip"><div><span>ALL ORDERS</span><strong>{orders.length}</strong></div><div><span>NEEDS ACTION</span><strong className="stat-warning">{orders.filter((order) => order.status === "pending").length}</strong></div><div><span>IN TRANSIT</span><strong>{orders.filter((order) => order.status === "shipped").length}</strong></div><div><span>COMPLETED</span><strong>{orders.filter((order) => order.status === "completed").length}</strong></div></div><div className="management-toolbar"><div className="management-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, name, email or city" /></div><div className="management-toolbar-actions"><label className="management-select"><span>STATUS</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statusOptions.map((item) => <option value={item} key={item}>{statusTitle[item]}</option>)}</select></label><button className="admin-button admin-button-outline" onClick={() => downloadCsv("nexvoro-orders.csv", [["Order", "Date", "Name", "Email", "Status", "Payable total", "Payment currency", "Base total", "Base currency", "Payment method"], ...filtered.map((order) => {
      const recorded = orderRecordedSnapshot(order);
      return [order.orderNo, order.createdAt, order.customer.name, order.customer.email, order.status, String(recorded?.amount ?? ""), recorded?.currency || "not recorded", String(order.total), order.currency || "not recorded", order.paymentMethod];
    })])}><Download size={14} />Export CSV</button></div></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>DATE / CUSTOMER</th><th>STATUS</th><th>ITEMS</th><th>TOTAL</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((order) => <tr key={order.id} className="order-table-row" onClick={() => setSelected(order)}><td><strong className="order-id-cell">{order.orderNo}</strong><small className="table-subline">{order.paymentMethod.replaceAll("_", " ")}</small></td><td><strong>{new Date(order.createdAt).toLocaleDateString()}</strong><small className="table-subline">{order.customer.name} · {order.customer.email}</small></td><td><span className={`order-status status-${order.status}`}>{statusTitle[order.status]}</span></td><td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</td><td><strong>{formatOrderTotal(order)}</strong></td><td><button className="admin-icon-button" aria-label={`View order ${order.orderNo}`}><Eye size={15} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="admin-table-empty"><ClipboardList size={19} /><strong>No orders in this view yet.</strong><span>Orders appear here after a customer checks out.</span></div>}</div><div className="admin-table-foot"><span>Showing {filtered.length} of {orders.length} orders</span><span>Order records and line-item snapshots are never deleted from this dashboard.</span></div>
    {selected && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="admin-detail-modal" role="dialog" aria-modal="true" aria-label={`Order ${selected.orderNo}`}><div className="admin-modal-heading"><div><span className="eyebrow">ORDER DETAILS / {selected.orderNo}</span><h2>Make this one count.</h2><p>Placed {new Date(selected.createdAt).toLocaleString()}</p></div><button onClick={() => setSelected(null)} aria-label="Close order details"><X size={19} /></button></div><div className="order-detail-grid"><div className="order-detail-main"><div className="order-detail-contact"><div><span className="eyebrow">CUSTOMER</span><strong>{selected.customer.name}</strong><a href={`mailto:${selected.customer.email}`}>{selected.customer.email}</a><span>{selected.customer.phone}</span></div><div><span className="eyebrow">DELIVERY ADDRESS</span><strong>{selected.address.line1}</strong>{selected.address.line2 && <span>{selected.address.line2}</span>}<span>{selected.address.city}, {selected.address.region} {selected.address.postalCode}</span><span>{selected.address.country}</span></div></div><div className="order-detail-items"><span className="eyebrow">THE ORDER</span>{selected.items.map((item) => <div className="order-detail-item" key={`${item.productId}${item.variant || ""}`}><div><strong>{item.name}</strong><small>{item.sku}{item.variant ? ` · ${item.variant}` : ""} · Qty {item.quantity}</small></div><b>{formatBaseAmount(item.price * item.quantity, selected.currency)}</b></div>)}</div><div className="order-detail-totals"><div><span>Subtotal</span><b>{formatBaseAmount(selected.subtotal, selected.currency)}</b></div><div><span>Delivery</span><b>{selected.shipping ? formatBaseAmount(selected.shipping, selected.currency) : "Complimentary"}</b></div>{selected.discount > 0 && <div><span>Discount {selected.coupon && `· ${selected.coupon}`}</span><b>−{formatBaseAmount(selected.discount, selected.currency)}</b></div>}<div className="order-grand-total"><span>Base total · {selected.currency || "currency not recorded"}</span><b>{formatBaseAmount(selected.total, selected.currency)}</b></div>{selected.paymentTotal !== undefined && isCurrencyCode(selected.paymentCurrency) && <div className="order-payment-total-line"><span>Cash to collect · {selected.paymentCurrency}</span><b>{formatMoney(selected.paymentTotal, selected.paymentCurrency)}</b></div>}{selected.fxRate && selected.currency && selected.paymentCurrency && <small className="order-fx-snapshot">Rate 1 {selected.currency} = {Number(selected.fxRate).toPrecision(7)} {selected.paymentCurrency}{selected.fxRateAt ? ` · captured ${new Date(selected.fxRateAt).toLocaleString()}` : ""}.</small>}</div></div><aside className="order-detail-actions"><span className="eyebrow">FULFILLMENT</span><label>Order status<select value={selected.status} disabled={saving || selected.status === "cancelled" || selected.status === "refunded"} onChange={(event) => update(selected, { status: event.target.value as OrderStatus })}>{statusOptions.map((item) => <option key={item} value={item}>{statusTitle[item]}</option>)}</select></label><label>Tracking reference<input value={selected.trackingNumber || ""} onChange={(event) => setSelected({ ...selected, trackingNumber: event.target.value })} placeholder="Add a shipment reference" /></label><button className="admin-button admin-button-primary" disabled={saving} onClick={() => update(selected, { status: selected.status, trackingNumber: selected.trackingNumber })}>{saving ? "Saving…" : "Save fulfillment"}<ArrowRight size={14} /></button><div className="order-payment-record"><Truck size={15} /><span><strong>Cash on delivery</strong><small>No payment gateway is connected. A refund status is an operational record only.</small></span></div><div className="order-action-warning"><strong>Returns &amp; refunds</strong><p>Marking an order refunded does not issue money. Reconcile any refund with your payment or cash-on-delivery workflow separately.</p></div></aside></div><div className="admin-modal-footer"><span>Historical line items and totals are preserved.</span><button className="admin-button admin-button-quiet" onClick={() => setSelected(null)}>Done</button></div></section></div>}
  </div>;
}

export function CustomersManager({ customers }: { customers: Customer[] }) {
  const { orders, saveCustomer, notify } = useStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => b.orderCount-a.orderCount || new Date(b.joinedAt).getTime()-new Date(a.joinedAt).getTime()), [customers, query]);
  const open = (customer: Customer) => { setSelected(customer); setName(customer.name); setPhone(customer.phone); };
  const customerOrders = selected ? orders.filter((order) => order.customer.email.toLowerCase() === selected.email.toLowerCase()) : [];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return; setBusy(true);
    const ok = await saveCustomer({ ...selected, name: name.trim(), phone: phone.trim() });
    setBusy(false); if (ok) { notify("Customer profile updated."); setSelected(null); }
  };
  return <div className="admin-management-page"><div className="admin-stat-strip"><div><span>CUSTOMER PROFILES</span><strong>{customers.length}</strong></div><div><span>ORDERING CUSTOMERS</span><strong>{new Set(orders.map((order) => order.customer.email.toLowerCase())).size}</strong></div><div><span>REPEAT CUSTOMERS</span><strong>{customers.filter((customer) => customer.orderCount > 1).length}</strong></div><div><span>RECORDED SPEND BY PAYMENT CURRENCY</span><strong>{formatRecordedCustomerSpend(orders)}</strong></div></div><div className="management-toolbar"><div className="management-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find by name, email or phone" /></div><span className="customer-data-note"><ShieldCheck size={14} />Customer records are derived from saved orders.</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CUSTOMER</th><th>PHONE</th><th>ORDERS</th><th>RECORDED PAYMENT TOTALS</th><th>FIRST SEEN</th><th /></tr></thead><tbody>{filtered.map((customer) => <tr key={customer.id} onClick={() => open(customer)}><td><div className="admin-customer-cell"><span>{customer.name.split(" ").map((part) => part.charAt(0)).slice(0,2).join("").toUpperCase() || "N"}</span><div><strong>{customer.name}</strong><small>{customer.email}</small></div></div></td><td>{customer.phone || "—"}</td><td><strong>{customer.orderCount}</strong></td><td><strong>{formatRecordedCustomerSpend(orders.filter((order) => order.customer.email.toLowerCase() === customer.email.toLowerCase()))}</strong></td><td>{new Date(customer.joinedAt).toLocaleDateString()}</td><td><button className="admin-icon-button" aria-label={`View ${customer.name}`}><ExternalLink size={14} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="admin-table-empty"><Search size={19} /><strong>No customer profiles yet.</strong><span>Customer records are created from real order records.</span></div>}</div><div className="admin-table-foot"><span>Showing {filtered.length} of {customers.length} customers</span><span>Only customer data submitted at checkout is included.</span></div>
    {selected && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="admin-detail-modal customer-detail-modal" role="dialog" aria-modal="true" aria-label={`Customer ${selected.name}`}><div className="admin-modal-heading"><div><span className="eyebrow">CUSTOMER PROFILE</span><h2>{selected.name}.</h2><p>{selected.email}</p></div><button onClick={() => setSelected(null)} aria-label="Close customer details"><X size={19} /></button></div><div className="customer-detail-stats"><div><span>ORDERS</span><strong>{selected.orderCount}</strong></div><div><span>RECORDED SPEND BY CURRENCY</span><strong>{formatRecordedCustomerSpend(customerOrders)}</strong></div><div><span>FIRST SEEN</span><strong>{new Date(selected.joinedAt).toLocaleDateString()}</strong></div></div><form className="customer-edit-form" onSubmit={submit}><label>Display name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label><button className="admin-button admin-button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}<ArrowRight size={14} /></button></form><div className="customer-order-history"><span className="eyebrow">ORDER HISTORY</span>{customerOrders.length ? customerOrders.map((order) => <div key={order.id}><span>{order.orderNo} · {new Date(order.createdAt).toLocaleDateString()}</span><b>{formatOrderTotal(order)}</b><i className={`order-status status-${order.status}`}>{statusTitle[order.status]}</i></div>) : <p>Order history will appear here when available.</p>}</div></section></div>}
  </div>;
}
