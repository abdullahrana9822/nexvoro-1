"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_THEME, isThemeId } from "./themes";
import type {
  Banner,
  CartLine,
  Category,
  Coupon,
  Customer,
  DatabaseStatus,
  Order,
  Product,
  Review,
  StoreContextValue,
  StoreSettings,
  StoreSnapshot,
  ThemeId,
  ToastNotice,
} from "./types";
import { makeId } from "./utils";
import { convertBetweenCurrencies, formatDisplayMoney, isCurrencyCode, sanitizeRates } from "./currency.mjs";
import { getBrowserSupabase } from "./supabase-browser";

const STORE_VERSION = "v1";
const keys = {
  products: `nexvoro.products.${STORE_VERSION}`,
  categories: `nexvoro.categories.${STORE_VERSION}`,
  cart: `nexvoro.cart.${STORE_VERSION}`,
  wishlist: `nexvoro.wishlist.${STORE_VERSION}`,
  compare: `nexvoro.compare.${STORE_VERSION}`,
  recent: `nexvoro.recent.${STORE_VERSION}`,
  orders: `nexvoro.orders.${STORE_VERSION}`,
  coupons: `nexvoro.coupons.${STORE_VERSION}`,
  banners: `nexvoro.banners.${STORE_VERSION}`,
  reviews: `nexvoro.reviews.${STORE_VERSION}`,
  customers: `nexvoro.customers.${STORE_VERSION}`,
  settings: `nexvoro.settings.${STORE_VERSION}`,
  displayCurrency: `nexvoro.currency.${STORE_VERSION}`,
  theme: `nexvoro.theme.${STORE_VERSION}`,
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "NEXVORO",
  tagline: "Where Innovation Meets Lifestyle",
  currency: "PKR",
  fxFallbackRates: {},
  fxAdjustmentBps: 0,
  fxCacheTtlMinutes: 60,
  defaultTheme: DEFAULT_THEME,
  allowThemeSwitch: true,
  shippingFee: 0,
  freeShippingThreshold: 0,
  supportEmail: "",
  contactPhone: "",
  instagramUrl: "",
  facebookUrl: "",
  xUrl: "",
  salesTarget: 0,
};

const DEFAULT_COUPONS: Coupon[] = [];

const DEFAULT_BANNERS: Banner[] = [
  {
    id: "banner-audio",
    title: "Find your frequency.",
    subtitle: "A quieter commute. A clearer moment.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85",
    href: "/category/headphones",
    active: true,
  },
  {
    id: "banner-studio",
    title: "Make room for ideas.",
    subtitle: "Thoughtful tools for your next big thing.",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=85",
    href: "/category/computer-accessories",
    active: true,
  },
];

type ContextShape = StoreContextValue & {
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
};
const StoreContext = createContext<ContextShape | null>(null);

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function responseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>(DEFAULT_COUPONS);
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_BANNERS);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [displayCurrency, setDisplayCurrencyState] = useState<string>(DEFAULT_SETTINGS.currency);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ PKR: 1 });
  const [exchangeRateSources, setExchangeRateSources] = useState<Record<string, "identity" | "live" | "fallback" | "stale">>({ PKR: "identity" });
  const [exchangeRateUpdatedAt, setExchangeRateUpdatedAt] = useState<Record<string, string>>({});
  const [exchangeRateStatus, setExchangeRateStatus] = useState<"idle" | "loading" | "live" | "mixed" | "fallback" | "stale" | "unavailable">("idle");
  const hasSavedDisplayCurrency = useRef(false);
  const [theme, setActiveTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ready, setReady] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus>("checking");
  const [commerceConfigured, setCommerceConfigured] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminMustChangePassword, setAdminMustChangePassword] = useState(false);
  const [adminRole, setAdminRole] = useState<"SUPER_ADMIN" | null>(null);
  const [adminDisplayName, setAdminDisplayName] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const notify = useCallback((message: string, kind: ToastNotice["kind"] = "success") => {
    const id = makeId("toast");
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3400);
  }, []);

  useEffect(() => {
    const savedSettings = readStored<Partial<StoreSettings> | null>(keys.settings, DEFAULT_SETTINGS) || DEFAULT_SETTINGS;
    const localSettings: StoreSettings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      fxFallbackRates: savedSettings.fxFallbackRates && typeof savedSettings.fxFallbackRates === "object" ? sanitizeRates(savedSettings.fxFallbackRates) : {},
      fxAdjustmentBps: typeof savedSettings.fxAdjustmentBps === "number" && Number.isFinite(savedSettings.fxAdjustmentBps) ? savedSettings.fxAdjustmentBps : DEFAULT_SETTINGS.fxAdjustmentBps,
      fxCacheTtlMinutes: typeof savedSettings.fxCacheTtlMinutes === "number" && Number.isFinite(savedSettings.fxCacheTtlMinutes) ? savedSettings.fxCacheTtlMinutes : DEFAULT_SETTINGS.fxCacheTtlMinutes,
    };
    const savedDisplayCurrency = readStored<unknown>(keys.displayCurrency, null);
    hasSavedDisplayCurrency.current = isCurrencyCode(savedDisplayCurrency);
    let hadSavedTheme = false;
    try { hadSavedTheme = Boolean(window.localStorage.getItem(keys.theme)); } catch { /* Storage may be unavailable in private browsing. */ }
    setProducts(process.env.NODE_ENV === "production" ? [] : readStored(keys.products, []));
    setCategories(process.env.NODE_ENV === "production" ? [] : readStored(keys.categories, []));
    setCart(readStored(keys.cart, []));
    setWishlist(readStored(keys.wishlist, []));
    setCompare(readStored(keys.compare, []));
    setRecent(readStored(keys.recent, []));
    setOrders(readStored(keys.orders, []));
    setCoupons(readStored(keys.coupons, DEFAULT_COUPONS));
    setBanners(readStored(keys.banners, DEFAULT_BANNERS));
    setReviews(readStored(keys.reviews, []));
    setCustomers(readStored(keys.customers, []));
    setSettings(localSettings);
    setDisplayCurrencyState(isCurrencyCode(savedDisplayCurrency) ? String(savedDisplayCurrency) : isCurrencyCode(localSettings.currency) ? localSettings.currency : DEFAULT_SETTINGS.currency);
    const storedTheme = readStored<unknown>(keys.theme, localSettings.defaultTheme);
    const nextTheme = isThemeId(storedTheme) ? storedTheme : DEFAULT_THEME;
    setActiveTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setReady(true);

    fetch("/api/health", { cache: "no-store" })
      .then(responseJson)
      .then((data) => {
        setDatabaseStatus(data?.database === true ? "connected" : "disconnected");
        setCommerceConfigured(data?.commerceConfigured === true);
        setAdminConfigured(data?.adminConfigured === true);
      })
      .catch(() => {
        setDatabaseStatus("disconnected");
        setCommerceConfigured(false);
        setAdminConfigured(false);
      });
    fetch("/api/admin/session", { cache: "no-store" })
      .then(responseJson)
      .then((data) => {
        setAdminConfigured(data?.configured === true);
        setAdminAuthenticated(data?.authenticated === true && data?.role === "SUPER_ADMIN");
        setAdminRole(data?.authenticated === true && data?.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : null);
        setAdminMustChangePassword(data?.authenticated === true && data?.mustChangePassword === true);
        setAdminDisplayName(data?.authenticated === true && typeof data?.displayName === "string" ? data.displayName : null);
      })
      .catch(() => undefined);
    fetch("/api/store", { cache: "no-store" })
      .then((response) => response.ok ? responseJson(response) : null)
      .then((data) => {
        if (typeof data?.commerceConfigured === "boolean") setCommerceConfigured(data.commerceConfigured);
        if (Array.isArray(data?.products)) setProducts(data.products as Product[]);
        if (Array.isArray(data?.categories)) setCategories(data.categories as Category[]);
        if (Array.isArray(data?.coupons)) setCoupons(data.coupons as Coupon[]);
        if (Array.isArray(data?.banners)) setBanners(data.banners as Banner[]);
        if (Array.isArray(data?.reviews)) setReviews(data.reviews as Review[]);
        if (data?.settings && typeof data.settings === "object") {
          const serverSettings = data.settings as Partial<StoreSettings>;
          setSettings((current) => ({
            ...current,
            ...serverSettings,
            fxFallbackRates: serverSettings.fxFallbackRates && typeof serverSettings.fxFallbackRates === "object"
              ? sanitizeRates(serverSettings.fxFallbackRates)
              : current.fxFallbackRates,
          }));
          if (!hasSavedDisplayCurrency.current && typeof serverSettings.currency === "string" && isCurrencyCode(serverSettings.currency)) setDisplayCurrencyState(serverSettings.currency);
          const serverTheme = (data.settings as Partial<StoreSettings>).defaultTheme;
          const customerSwitching = (data.settings as Partial<StoreSettings>).allowThemeSwitch;
          if (isThemeId(serverTheme) && (!hadSavedTheme || customerSwitching === false)) {
            setActiveTheme(serverTheme);
            document.documentElement.dataset.theme = serverTheme;
          }
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready || !isCurrencyCode(settings.currency)) return;
    let cancelled = false;
    const refreshRates = async () => {
      setExchangeRateStatus((current) => current === "idle" || current === "unavailable" ? "loading" : current);
      try {
        const response = await fetch(`/api/currency/rates?base=${encodeURIComponent(settings.currency)}`, { cache: "no-store" });
        const data = await responseJson(response);
        if (!response.ok || data?.base !== settings.currency) throw new Error("Rate request failed.");
        if (cancelled) return;
        const rates = sanitizeRates(data.rates);
        rates[settings.currency] = 1;
        const validSources = new Set(["identity", "live", "fallback", "stale"]);
        const sources = data.rateSources && typeof data.rateSources === "object"
          ? Object.fromEntries(Object.entries(data.rateSources).filter(([code, source]) => isCurrencyCode(code) && validSources.has(String(source)))) as Record<string, "identity" | "live" | "fallback" | "stale">
          : {};
        const updatedAt = data.rateUpdatedAt && typeof data.rateUpdatedAt === "object"
          ? Object.fromEntries(Object.entries(data.rateUpdatedAt).filter(([code, date]) => isCurrencyCode(code) && typeof date === "string")) as Record<string, string>
          : {};
        setExchangeRates(rates);
        setExchangeRateSources({ ...sources, [settings.currency]: "identity" });
        setExchangeRateUpdatedAt(updatedAt);
        const status = ["live", "mixed", "fallback", "stale", "unavailable"].includes(data.source) ? data.source : "unavailable";
        setExchangeRateStatus(status as "live" | "mixed" | "fallback" | "stale" | "unavailable");
      } catch {
        if (!cancelled) setExchangeRateStatus((current) => current === "live" || current === "mixed" || current === "fallback" ? "stale" : "unavailable");
      }
    };
    void refreshRates();
    const timer = window.setInterval(() => void refreshRates(), 15 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [ready, settings.currency, settings.fxFallbackRates, settings.fxAdjustmentBps, settings.fxCacheTtlMinutes]);

  useEffect(() => {
    if (!ready) return;
    const values: [string, unknown][] = [
      [keys.products, products], [keys.categories, categories], [keys.cart, cart],
      [keys.wishlist, wishlist], [keys.compare, compare], [keys.recent, recent],
      [keys.orders, orders], [keys.coupons, coupons], [keys.banners, banners],
      [keys.reviews, reviews], [keys.customers, customers], [keys.settings, settings],
      [keys.displayCurrency, displayCurrency], [keys.theme, theme],
    ];
    values.forEach(([key, value]) => {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing may block storage. */ }
    });
    document.documentElement.dataset.theme = theme;
  }, [ready, products, categories, cart, wishlist, compare, recent, orders, coupons, banners, reviews, customers, settings, displayCurrency, theme]);

  const writeRemote = useCallback(async (resource: string, action: string, record: unknown) => {
    if (databaseStatus === "checking") { notify("Connecting to the store. Please try again in a moment.", "info"); return false; }
    if (databaseStatus !== "connected") {
      notify("The live store database is unavailable. No admin changes were saved.", "error");
      return false;
    }
    if (!adminAuthenticated) {
      notify("Sign in to the protected store admin before saving shared changes.", "error");
      return false;
    }
    try {
      const response = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource, action, record }),
      });
      const data = await responseJson(response);
      if (!response.ok) {
        notify(data?.error || "The database could not save this change.", "error");
        return false;
      }
      return true;
    } catch {
      notify("The database could not be reached. Your change was not saved.", "error");
      return false;
    }
  }, [adminAuthenticated, databaseStatus, notify]);

  const setTheme = useCallback((next: ThemeId) => {
    setActiveTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const setDisplayCurrency = useCallback((next: string) => {
    if (!isCurrencyCode(next)) return;
    hasSavedDisplayCurrency.current = true;
    setDisplayCurrencyState(next);
    try { window.localStorage.setItem(keys.displayCurrency, JSON.stringify(next)); } catch { /* Browser storage may be unavailable. */ }
  }, []);

  const convertDisplayAmount = useCallback((amount: number, targetCurrency = displayCurrency) =>
    convertBetweenCurrencies(amount, settings.currency, targetCurrency, settings.currency, exchangeRates),
  [settings.currency, displayCurrency, exchangeRates]);

  const formatPrice = useCallback((amount: number) =>
    formatDisplayMoney(amount, settings.currency, displayCurrency, exchangeRates).text,
  [settings.currency, displayCurrency, exchangeRates]);

  const updateSettings = useCallback(async (patch: Partial<StoreSettings>) => {
    const next = { ...settings, ...patch };
    if (!(await writeRemote("settings", "upsert", next))) return false;
    setSettings(next);
    if (databaseStatus === "connected") setCommerceConfigured(true);
    if (patch.defaultTheme) setTheme(patch.defaultTheme);
    return true;
  }, [settings, databaseStatus, setTheme, writeRemote]);

  const addToCart = useCallback((productId: string, quantity = 1, variant?: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    if (product.stock < 1) { notify("This item is currently out of stock.", "error"); return; }
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId && line.variant === variant);
      if (existing) return current.map((line) => line === existing ? { ...line, quantity: Math.min(product.stock, line.quantity + quantity) } : line);
      return [...current, { productId, quantity: Math.min(product.stock, quantity), variant }];
    });
    notify(`${product.name} added to your bag.`);
  }, [products, notify]);

  const removeFromCart = useCallback((productId: string, variant?: string) => {
    setCart((current) => current.filter((line) => !(line.productId === productId && line.variant === variant)));
  }, []);

  const setCartQuantity = useCallback((productId: string, quantity: number, variant?: string) => {
    if (quantity <= 0) { removeFromCart(productId, variant); return; }
    const product = products.find((item) => item.id === productId);
    setCart((current) => current.map((line) => line.productId === productId && line.variant === variant
      ? { ...line, quantity: Math.min(product?.stock ?? quantity, quantity) }
      : line));
  }, [products, removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);
  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  }, []);
  const toggleCompare = useCallback((productId: string) => {
    setCompare((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : current.length >= 4 ? (notify("Compare up to four products at a time.", "info"), current) : [...current, productId]);
  }, [notify]);
  const recordView = useCallback((productId: string) => setRecent((current) => [productId, ...current.filter((id) => id !== productId)].slice(0, 8)), []);

  const saveProduct = useCallback(async (product: Product) => {
    if (!(await writeRemote("products", "upsert", product))) return false;
    setProducts((current) => current.some((item) => item.id === product.id)
      ? current.map((item) => item.id === product.id ? product : item)
      : [product, ...current]);
    return true;
  }, [writeRemote]);

  const archiveProduct = useCallback(async (productId: string) => {
    if (!(await writeRemote("products", "archive", { id: productId }))) return false;
    setProducts((current) => current.filter((product) => product.id !== productId));
    setCart((current) => current.filter((line) => line.productId !== productId));
    return true;
  }, [writeRemote]);

  const saveCategory = useCallback(async (category: Category) => {
    if (!(await writeRemote("categories", "upsert", category))) return false;
    setCategories((current) => current.some((item) => item.slug === category.slug)
      ? current.map((item) => item.slug === category.slug ? category : item)
      : [...current, category]);
    return true;
  }, [writeRemote]);

  const archiveCategory = useCallback(async (slug: string) => {
    if (!(await writeRemote("categories", "archive", { slug }))) return false;
    setCategories((current) => current.filter((category) => category.slug !== slug));
    return true;
  }, [writeRemote]);

  const saveCustomer = useCallback(async (customer: Customer) => {
    if (!(await writeRemote("customers", "upsert", customer))) return false;
    setCustomers((current) => current.some((item) => item.id === customer.id)
      ? current.map((item) => item.id === customer.id ? customer : item)
      : [customer, ...current]);
    return true;
  }, [writeRemote]);

  const saveOrder = useCallback(async (order: Order) => {
    if (!(await writeRemote("orders", "upsert", order))) return false;
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    return true;
  }, [writeRemote]);

  const updateOrder = useCallback(async (id: string, patch: Partial<Order>) => {
    const currentOrder = orders.find((order) => order.id === id);
    if (!currentOrder) return false;
    const next = { ...currentOrder, ...patch };
    if ((currentOrder.status === "cancelled" || currentOrder.status === "refunded") && patch.status && patch.status !== currentOrder.status) {
      notify("Cancelled or refunded orders cannot be reopened from this dashboard.", "error");
      return false;
    }
    if (!(await writeRemote("orders", "update", next))) return false;
    if (patch.status === "cancelled" && currentOrder.status !== "cancelled") {
      setProducts((current) => current.map((product) => {
        const returned = currentOrder.items.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
        return returned ? { ...product, stock: product.stock + returned } : product;
      }));
    }
    setOrders((current) => current.map((order) => order.id === id ? next : order));
    return true;
  }, [orders, writeRemote, notify]);

  const saveCoupon = useCallback(async (coupon: Coupon) => {
    if (!(await writeRemote("coupons", "upsert", coupon))) return false;
    setCoupons((current) => current.some((item) => item.id === coupon.id)
      ? current.map((item) => item.id === coupon.id ? coupon : item)
      : [coupon, ...current]);
    return true;
  }, [writeRemote]);

  const saveBanner = useCallback(async (banner: Banner) => {
    if (!(await writeRemote("banners", "upsert", banner))) return false;
    setBanners((current) => current.some((item) => item.id === banner.id)
      ? current.map((item) => item.id === banner.id ? banner : item)
      : [banner, ...current]);
    return true;
  }, [writeRemote]);

  const saveReview = useCallback(async (review: Review) => {
    if (databaseStatus !== "connected") {
      notify("Reviews cannot be saved until the live store is connected.", "error");
      return false;
    }
    try {
      const response = await fetch("/api/reviews", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(review),
      });
      const data = await responseJson(response);
      if (!response.ok) { notify(data?.error || "Review could not be submitted.", "error"); return false; }
    } catch { notify("Review could not be submitted. Please try again.", "error"); return false; }
    setReviews((current) => [review, ...current]);
    notify("Thanks — your review was received and is awaiting moderation.");
    return true;
  }, [databaseStatus, notify]);

  const moderateReview = useCallback(async (review: Review) => {
    if (!(await writeRemote("reviews", "update", review))) return false;
    setReviews((current) => current.map((item) => item.id === review.id ? review : item));
    return true;
  }, [writeRemote]);

  const checkout = useCallback(async (order: Order) => {
    if (databaseStatus === "checking") return { ok: false, persisted: false, message: "The store is still connecting. Please try again in a moment." };
    if (databaseStatus === "connected" && !commerceConfigured) return { ok: false, persisted: false, message: "Checkout is paused until verified delivery terms and at least one sale-ready product are available." };
    if (databaseStatus !== "connected" && process.env.NODE_ENV === "production") {
      return { ok: false, persisted: false, message: "This store is not accepting orders because its live database is unavailable. Please try again later." };
    }
    if (databaseStatus === "connected") {
      try {
        const headers: Record<string, string> = { "content-type": "application/json" };
        const authClient = getBrowserSupabase();
        if (authClient) {
          const { data: sessionData } = await authClient.auth.getSession();
          if (sessionData.session?.access_token) headers.authorization = `Bearer ${sessionData.session.access_token}`;
        }
        const response = await fetch("/api/orders", {
          method: "POST", headers, body: JSON.stringify({
            ...order,
            expectedBaseCurrency: order.currency || settings.currency,
            expectedFxRate: order.fxRate ?? 1,
          }),
        });
        const data = await responseJson(response);
        if (!response.ok) return { ok: false, persisted: false, message: data?.error || "We could not place your order. Please try again." };
        const saved = (data?.order || order) as Order;
        setOrders((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        clearCart();
        return { ok: true, order: saved, persisted: true };
      } catch {
        return { ok: false, persisted: false, message: "We could not reach the store database. Your order was not submitted." };
      }
    }
    setOrders((current) => [order, ...current]);
    clearCart();
    return { ok: true, order, persisted: false, message: "Preview mode: this order is saved only in this browser." };
  }, [databaseStatus, commerceConfigured, clearCart, settings.currency]);

  const applyDatabaseSnapshot = useCallback((snapshot: Partial<StoreSnapshot>) => {
    if (snapshot.products) setProducts(snapshot.products);
    if (snapshot.categories) setCategories(snapshot.categories);
    if (snapshot.orders) setOrders(snapshot.orders);
    if (snapshot.coupons) setCoupons(snapshot.coupons);
    if (snapshot.banners) setBanners(snapshot.banners);
    if (snapshot.reviews) setReviews(snapshot.reviews);
    if (snapshot.customers) setCustomers(snapshot.customers);
    if (snapshot.settings) setSettings((current) => ({ ...current, ...snapshot.settings }));
  }, []);

  const loginAdmin = useCallback(async (username: string, password: string) => {
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }),
      });
      const data = await responseJson(response);
      if (!response.ok || data?.role !== "SUPER_ADMIN") {
        notify(data?.error || "Super Admin sign-in failed.", "error");
        return false;
      }
      setAdminAuthenticated(true);
      setAdminRole("SUPER_ADMIN");
      setAdminMustChangePassword(data.mustChangePassword === true);
      setAdminDisplayName(typeof data.displayName === "string" ? data.displayName : null);
      return true;
    } catch {
      notify("Admin sign-in could not reach the server.", "error");
      return false;
    }
  }, [notify]);

  const changeAdminPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await responseJson(response);
      if (!response.ok) {
        notify(data?.error || "Password change failed.", "error");
        return false;
      }
      setAdminAuthenticated(true);
      setAdminRole("SUPER_ADMIN");
      setAdminMustChangePassword(false);
      notify("Admin password changed. Other active sessions have been signed out.", "success");
      return true;
    } catch {
      notify("Password change could not reach the server.", "error");
      return false;
    }
  }, [notify]);

  const logoutAdmin = useCallback(async () => {
    try { await fetch("/api/admin/session", { method: "DELETE" }); } catch { /* local state still closes the session */ }
    setAdminAuthenticated(false);
    setAdminMustChangePassword(false);
    setAdminRole(null);
    setAdminDisplayName(null);
  }, []);

  const value = useMemo<ContextShape>(() => ({
    products, categories, cart, wishlist, compare, recent, orders, coupons, banners, reviews,
    settings, displayCurrency, exchangeRates, exchangeRateSources, exchangeRateUpdatedAt, exchangeRateStatus,
    setDisplayCurrency, formatPrice, convertDisplayAmount, theme, ready, databaseStatus, commerceConfigured,
    adminAuthenticated, adminConfigured, adminMustChangePassword, adminRole, adminDisplayName, toasts, customers,
    setCustomers, setTheme, updateSettings, addToCart, removeFromCart, setCartQuantity,
    clearCart, toggleWishlist, toggleCompare, recordView, notify, saveProduct,
    archiveProduct, saveCategory, archiveCategory, saveCustomer, saveOrder, updateOrder, saveCoupon, saveBanner,
    saveReview, moderateReview, checkout, applyDatabaseSnapshot, loginAdmin, changeAdminPassword, logoutAdmin,
  }), [
    products, categories, cart, wishlist, compare, recent, orders, coupons, banners, reviews,
    settings, displayCurrency, exchangeRates, exchangeRateSources, exchangeRateUpdatedAt, exchangeRateStatus,
    setDisplayCurrency, formatPrice, convertDisplayAmount, theme, ready, databaseStatus, commerceConfigured,
    adminAuthenticated, adminConfigured, adminMustChangePassword, adminRole, adminDisplayName, toasts, customers,
    setTheme, updateSettings, addToCart, removeFromCart, setCartQuantity, clearCart,
    toggleWishlist, toggleCompare, recordView, notify, saveProduct, archiveProduct,
    saveCategory, archiveCategory, saveCustomer, saveOrder, updateOrder, saveCoupon, saveBanner, saveReview, moderateReview, checkout,
    applyDatabaseSnapshot, loginAdmin, changeAdminPassword, logoutAdmin,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used within StoreProvider");
  return value;
}
