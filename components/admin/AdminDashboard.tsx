"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  PackageSearch,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { Customer, Order, StoreSnapshot } from "@/lib/types";
import { isCurrencyCode } from "@/lib/currency.mjs";
import AnalyticsDashboard, { type PeriodFilter, type PeriodKey } from "./Analytics";
import { CategoriesManager, CustomersManager, MarketingManager, OrdersManager, ProductsManager, ReviewsManager, SettingsManager } from "./Management";
import AdminPasswordChange from "./AdminPasswordChange";

const navItems = [
  { id: "overview", label: "Overview", href: "/admin", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { id: "products", label: "Products", href: "/admin/products", icon: PackageSearch },
  { id: "orders", label: "Orders", href: "/admin/orders", icon: ClipboardList },
  { id: "customers", label: "Customers", href: "/admin/customers", icon: Users },
  { id: "categories", label: "Categories", href: "/admin/categories", icon: Boxes },
  { id: "marketing", label: "Marketing", href: "/admin/marketing", icon: Megaphone },
  { id: "reviews", label: "Reviews", href: "/admin/reviews", icon: HeartHandshake },
  { id: "themes", label: "Themes & design", href: "/admin/themes", icon: Palette },
  { id: "settings", label: "Store settings", href: "/admin/settings", icon: Settings2 },
];

const titles: Record<string, { title: string; subtitle: string }> = {
  overview: { title: "Store overview", subtitle: "A clear view of what’s happening, without the guesswork." },
  analytics: { title: "Store analytics", subtitle: "Real order and catalog data, with honest gaps where tracking is not configured." },
  products: { title: "Products", subtitle: "Every product, price, image, variant and stock count in one place." },
  orders: { title: "Orders", subtitle: "Review details, prepare parcels and keep order history intact." },
  customers: { title: "Customers", subtitle: "Profiles and purchase history derived from recorded store activity." },
  categories: { title: "Categories", subtitle: "Shape how customers explore the NEXVORO collection." },
  marketing: { title: "Marketing", subtitle: "Promotions, discount codes, banners and newsletter signups." },
  reviews: { title: "Reviews", subtitle: "Moderate real customer submissions before they appear on the storefront." },
  themes: { title: "Themes & design", subtitle: "Set the default visual identity and control customer theme switching." },
  settings: { title: "Store settings", subtitle: "The operational details that power the customer experience." },
};

function recordedOrderSpend(order: Order) {
  if (order.paymentCurrency !== undefined) {
    return typeof order.paymentCurrency === "string" && isCurrencyCode(order.paymentCurrency) &&
      Number.isFinite(order.paymentTotal) && order.paymentTotal! >= 0
      ? { currency: order.paymentCurrency, amount: order.paymentTotal! }
      : null;
  }
  return typeof order.currency === "string" && isCurrencyCode(order.currency) &&
    Number.isFinite(order.total) && order.total >= 0
    ? { currency: order.currency, amount: order.total }
    : null;
}

function deriveCustomers(orders: Order[]): Customer[] {
  const byEmail = new Map<string, Customer>();
  for (const order of orders) {
    const email = order.customer.email.trim().toLowerCase();
    if (!email) continue;
    const previous = byEmail.get(email);
    const spend = order.status === "cancelled" || order.status === "refunded" ? null : recordedOrderSpend(order);
    if (previous) {
      previous.orderCount += 1;
      if (spend) previous.spendByCurrency![spend.currency] = (previous.spendByCurrency![spend.currency] || 0) + spend.amount;
      if (new Date(order.createdAt) < new Date(previous.joinedAt)) previous.joinedAt = order.createdAt;
    } else {
      byEmail.set(email, {
        id: email,
        email,
        name: order.customer.name,
        phone: order.customer.phone,
        orderCount: 1,
        spendByCurrency: spend ? { [spend.currency]: spend.amount } : {},
        joinedAt: order.createdAt,
      });
    }
  }
  return [...byEmail.values()].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
}

export default function AdminDashboard({ section }: { section: string }) {
  const key = titles[section] ? section : "overview";
  const { products, orders, customers, settings, databaseStatus, adminConfigured, adminAuthenticated, adminRole, adminDisplayName, adminMustChangePassword, loginAdmin, logoutAdmin, applyDatabaseSnapshot, setCustomers, notify } = useStore();
  const [period, setPeriod] = useState<PeriodFilter>({ period: "30d", from: "", to: "" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [newsletter, setNewsletter] = useState<Record<string, unknown>[]>([]);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const customerList = useMemo(() => customers.length ? customers : deriveCustomers(orders), [customers, orders]);
  const pageTitle = titles[key];

  useEffect(() => {
    if (databaseStatus !== "connected" || !adminAuthenticated || adminRole !== "SUPER_ADMIN" || adminMustChangePassword) return;
    let cancelled = false;
    setRemoteError("");
    setRemoteLoaded(false);
    fetch("/api/admin/data", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Admin data could not be loaded.");
      if (cancelled) return;
      applyDatabaseSnapshot(data as Partial<StoreSnapshot>);
      if (Array.isArray(data.customers)) setCustomers(data.customers as Customer[]);
      if (Array.isArray(data.newsletter)) setNewsletter(data.newsletter as Record<string, unknown>[]);
      if (Array.isArray(data.messages)) setMessages(data.messages as Record<string, unknown>[]);
      setRemoteLoaded(true);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setRemoteError(error instanceof Error ? error.message : "Admin data could not be loaded.");
      setRemoteLoaded(true);
    });
    return () => { cancelled = true; };
  }, [databaseStatus, adminAuthenticated, adminRole, adminMustChangePassword, applyDatabaseSnapshot, setCustomers]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginBusy(true);
    const submittedPassword = password;
    setPassword("");
    try {
      await loginAdmin(username, submittedPassword);
    } finally {
      setLoginBusy(false);
    }
  };

  if (databaseStatus === "checking") return <div className="admin-loading"><span className="loading-orbit" /><p>Opening the NEXVORO workspace…</p></div>;
  if (databaseStatus !== "connected" || !adminConfigured) return <div className="admin-auth-page"><Link href="/" className="admin-auth-brand"><span className="admin-brand-symbol">N</span><span>NEXVORO <small>STORE ADMIN</small></span></Link><div className="admin-auth-card"><span className="eyebrow">ADMIN WORKSPACE LOCKED</span><h1>{databaseStatus !== "connected" ? "Connect the live store." : "Finish Super Admin setup."}</h1><p>{databaseStatus !== "connected" ? "No production database is configured and reachable for this deployment. Admin sign-in and dashboard data are unavailable." : "The store database is reachable, but admin sign-in is not ready. The admin accounts migration and server-side session secret are required."}</p><div className="admin-auth-note"><ShieldCheck size={16} /><span>Apply migrations <code>202611140001</code>, <code>202611140002</code>, and <code>202611140003_admin_accounts.sql</code> to the dedicated NEXVORO-1 Supabase project. Configure <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, and a 32+ character <code>SESSION_SECRET</code> on the server; never expose the service-role key in the browser.</span></div><Link href="/" className="admin-auth-back"><ArrowLeft size={13} />Return to storefront</Link></div></div>;
  if (!adminAuthenticated || adminRole !== "SUPER_ADMIN") return <div className="admin-auth-page"><Link href="/" className="admin-auth-brand"><span className="admin-brand-symbol">N</span><span>NEXVORO <small>STORE ADMIN</small></span></Link><div className="admin-auth-card"><span className="eyebrow">PROTECTED SUPER ADMIN</span><h1>Welcome back.</h1><p>Sign in with the production Super Admin username and password.</p><form onSubmit={signIn}><label htmlFor="admin-username">Username</label><input id="admin-username" name="username" type="text" autoComplete="username" required maxLength={64} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your admin username" /><label htmlFor="admin-password">Password</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /><button className="admin-button admin-button-primary" disabled={loginBusy}>{loginBusy ? "Checking…" : "Sign in securely"}<ArrowRight size={15} /></button></form><div className="admin-auth-note"><ShieldCheck size={16} /><span>Credentials are verified against the production database using bcrypt. First sign-in requires a password change before any dashboard data is available.</span></div><Link href="/" className="admin-auth-back"><ArrowLeft size={13} />Return to storefront</Link></div></div>;
  if (adminMustChangePassword) return <div className="admin-auth-page"><Link href="/" className="admin-auth-brand"><span className="admin-brand-symbol">N</span><span>NEXVORO <small>STORE ADMIN</small></span></Link><div className="admin-auth-card"><span className="eyebrow">FIRST SIGN-IN SECURITY</span><h1>Change your password.</h1><p>{adminDisplayName || "Super Admin"}, set a new password before opening the admin dashboard. No dashboard records or admin APIs are available until this is complete.</p><AdminPasswordChange /><button type="button" className="admin-auth-back admin-auth-logout" onClick={async () => { await logoutAdmin(); notify("Admin session ended.", "info"); }}><ArrowLeft size={13} />Sign out</button></div></div>;
  if (adminAuthenticated && adminRole === "SUPER_ADMIN" && !remoteLoaded) return <div className="admin-loading"><span className="loading-orbit" /><p>Loading production admin records…</p></div>;
  if (adminAuthenticated && adminRole === "SUPER_ADMIN" && remoteError) return <div className="admin-auth-page"><div className="admin-auth-card"><span className="eyebrow">LIVE DATA UNAVAILABLE</span><h1>Dashboard locked.</h1><p>The production admin records could not be loaded, so no local or sample statistics are shown.</p><div className="admin-auth-note"><ShieldCheck size={16} /><span>{remoteError}</span></div><button className="admin-button admin-button-primary" onClick={() => window.location.reload()}>Retry production connection <ArrowRight size={14} /></button><button type="button" className="admin-auth-back admin-auth-logout" onClick={async () => { await logoutAdmin(); notify("Admin session ended.", "info"); }}><ArrowLeft size={13} />Sign out</button></div></div>;

  return <div className={`admin-shell ${mobileNavOpen ? "admin-mobile-nav-open" : ""}`}>
    <aside className="admin-sidebar"><div className="admin-sidebar-top"><Link href="/" className="admin-brand"><span className="admin-brand-symbol">N</span><span>NEXVORO<small>STORE ADMIN</small></span></Link><button className="admin-mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={19} /></button></div><div className="admin-store-switch"><span className="admin-store-avatar">N</span><span><strong>NEXVORO</strong><small>{databaseStatus === "connected" ? "DATABASE STORE" : "BROWSER PREVIEW"}</small></span><ChevronDown size={14} /></div><nav className="admin-nav" aria-label="Admin navigation"><span className="admin-nav-label">WORKSPACE</span>{navItems.map((item) => { const Icon = item.icon; return <Link key={item.id} href={item.href} className={key === item.id ? "admin-nav-active" : ""} onClick={() => setMobileNavOpen(false)}><Icon size={16} /><span>{item.label}</span>{item.id === "orders" && orders.some((order) => order.status === "pending") && <i>{orders.filter((order) => order.status === "pending").length}</i>}</Link>; })}</nav><div className="admin-sidebar-bottom"><div className="admin-sidebar-help"><span><Sparkles size={14} />NEXVORO / 01</span><p>Thoughtful technology. Carefully chosen.</p></div><Link href="/" target="_blank" className="admin-sidebar-store-link">View storefront <ExternalLink size={14} /></Link></div></aside>
    <div className="admin-main-area"><header className="admin-topbar"><button className="admin-mobile-open" onClick={() => setMobileNavOpen(true)} aria-label="Open admin navigation"><Menu size={20} /></button><div className="admin-topbar-crumb"><span>WORKSPACE</span><b>/</b><strong>{pageTitle.title}</strong></div><div className="admin-topbar-actions"><span className={`admin-connection-pill ${databaseStatus === "connected" ? "connected" : "preview"}`}><i />{databaseStatus === "connected" ? "Supabase connected" : "Browser preview"}</span><Link href="/" target="_blank" className="admin-view-store">View store <ExternalLink size={13} /></Link><span className="admin-role-badge">{adminDisplayName || "Super Admin"} · {adminRole}</span>{databaseStatus === "connected" && adminAuthenticated && <button className="admin-logout" onClick={async () => { await logoutAdmin(); notify("Admin session ended.", "info"); }} aria-label="Sign out of admin"><LogOut size={16} /></button>}</div></header>
      <main className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">NEXVORO / OPERATIONS</span><h1>{pageTitle.title}</h1><p>{pageTitle.subtitle}</p></div>{key === "overview" && <div className="admin-date-shortcut"><span>REPORTING PERIOD</span><select value={period.period} onChange={(event) => setPeriod({ ...period, period: event.target.value as PeriodKey })}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="year">This year</option><option value="custom">Custom dates</option></select></div>}</div>
      {databaseStatus === "connected" && adminAuthenticated && adminRole === "SUPER_ADMIN" && !adminMustChangePassword && !remoteLoaded && <div className="admin-sync-note"><span className="loading-orbit loading-orbit-small" />Syncing the live store database…</div>}
      {remoteError && <div className="admin-error-banner"><span>{remoteError}</span><button onClick={() => window.location.reload()}>Retry <ArrowRight size={13} /></button></div>}
      {key === "overview" || key === "analytics" ? <AnalyticsDashboard orders={orders} products={products} customers={customerList} settings={settings} period={period} setPeriod={setPeriod} />
        : key === "products" ? <ProductsManager />
        : key === "orders" ? <OrdersManager />
        : key === "customers" ? <CustomersManager customers={customerList} />
        : key === "categories" ? <CategoriesManager />
        : key === "marketing" ? <MarketingManager newsletter={newsletter} messages={messages} />
        : key === "reviews" ? <ReviewsManager />
        : key === "themes" ? <SettingsManager themeOnly />
        : key === "settings" ? <><SettingsManager /><section className="admin-account-security"><div className="admin-settings-section-heading"><span className="settings-section-icon"><ShieldCheck size={16} /></span><div><strong>Super Admin account security</strong><small>Update the password used to access the production admin workspace.</small></div></div><AdminPasswordChange compact /></section></>
        : <SettingsManager />}
      </main></div>
  </div>;
}
