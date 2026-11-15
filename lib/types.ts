export type ThemeId =
  | "luxury-black"
  | "neon-cyber"
  | "apple-minimal"
  | "premium-purple"
  | "modern-tech"
  | "gaming-universe"
  | "silver-metallic"
  | "creative-colorful";

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  compareAt: number;
  description: string;
  specs: Record<string, string>;
  stock: number;
  variants: string[];
  images: string[];
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  rating: number | null;
  reviewCount: number;
  relatedIds: string[];
  tags: string[];
};

export type Category = {
  slug: string;
  name: string;
  eyebrow: string;
  description: string;
  image?: string;
  active?: boolean;
};

export type CartLine = { productId: string; quantity: number; variant?: string };
export type OrderStatus = "pending" | "processing" | "shipped" | "completed" | "cancelled" | "refunded";
export type Order = {
  id: string;
  orderNo: string;
  createdAt: string;
  customer: { name: string; email: string; phone: string };
  address: { line1: string; line2?: string; city: string; region: string; postalCode: string; country: string };
  items: { productId: string; name: string; sku: string; price: number; quantity: number; variant?: string }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  /** Store/base currency used for the saved line-item amounts. Missing on legacy orders. */
  currency?: string;
  /** Actual currency collected by the configured payment method (COD is PKR only). */
  paymentCurrency?: string;
  /** Immutable server-side conversion snapshot for the payment amount. */
  fxRate?: number;
  fxRateAt?: string;
  fxRateSource?: "identity" | "live" | "fallback" | "stale";
  paymentSubtotal?: number;
  paymentShipping?: number;
  paymentDiscount?: number;
  paymentTotal?: number;
  status: OrderStatus;
  paymentMethod: string;
  coupon?: string;
  trackingNumber?: string;
};

export type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  expiresAt?: string;
  usageLimit?: number;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
  active: boolean;
};

export type StoreSettings = {
  storeName: string;
  tagline: string;
  /** Currency in which product, shipping, coupon and target amounts are stored. */
  currency: string;
  /** Operator-supplied rates used only when the live exchange-rate API cannot provide a pair. */
  fxFallbackRates: Record<string, number>;
  /** Display-price adjustment in basis points; zero leaves provider rates unchanged. */
  fxAdjustmentBps: number;
  /** Server-side cache lifetime for live rates, in minutes. */
  fxCacheTtlMinutes: number;
  defaultTheme: ThemeId;
  allowThemeSwitch: boolean;
  shippingFee: number;
  freeShippingThreshold: number;
  supportEmail: string;
  contactPhone: string;
  instagramUrl: string;
  facebookUrl: string;
  xUrl: string;
  salesTarget: number;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  orderCount: number;
  /** Saved order totals by their recorded payment currency; never aggregate across currencies. */
  spendByCurrency?: Record<string, number>;
  joinedAt: string;
};

export type Review = {
  id: string;
  productId: string;
  name: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  approved: boolean;
};

export type DatabaseStatus = "checking" | "connected" | "disconnected";

export type ToastNotice = {
  id: string;
  message: string;
  kind: "success" | "error" | "info";
};

export type StoreContextValue = {
  products: Product[];
  categories: Category[];
  cart: CartLine[];
  wishlist: string[];
  compare: string[];
  recent: string[];
  orders: Order[];
  coupons: Coupon[];
  banners: Banner[];
  reviews: Review[];
  settings: StoreSettings;
  /** Persistent customer-facing currency preference; not a payment-method selection. */
  displayCurrency: string;
  exchangeRates: Record<string, number>;
  exchangeRateSources: Record<string, "identity" | "live" | "fallback" | "stale">;
  exchangeRateUpdatedAt: Record<string, string>;
  exchangeRateStatus: "idle" | "loading" | "live" | "mixed" | "fallback" | "stale" | "unavailable";
  setDisplayCurrency: (currency: string) => void;
  formatPrice: (amount: number) => string;
  convertDisplayAmount: (amount: number, targetCurrency?: string) => number | null;
  theme: ThemeId;
  ready: boolean;
  databaseStatus: DatabaseStatus;
  commerceConfigured: boolean;
  adminAuthenticated: boolean;
  adminConfigured: boolean;
  adminMustChangePassword: boolean;
  adminRole: "SUPER_ADMIN" | null;
  adminDisplayName: string | null;
  toasts: ToastNotice[];
  setTheme: (theme: ThemeId) => void;
  updateSettings: (patch: Partial<StoreSettings>) => Promise<boolean>;
  addToCart: (productId: string, quantity?: number, variant?: string) => void;
  removeFromCart: (productId: string, variant?: string) => void;
  setCartQuantity: (productId: string, quantity: number, variant?: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  toggleCompare: (productId: string) => void;
  recordView: (productId: string) => void;
  notify: (message: string, kind?: ToastNotice["kind"]) => void;
  saveProduct: (product: Product) => Promise<boolean>;
  archiveProduct: (productId: string) => Promise<boolean>;
  saveCategory: (category: Category) => Promise<boolean>;
  archiveCategory: (slug: string) => Promise<boolean>;
  saveCustomer: (customer: Customer) => Promise<boolean>;
  saveOrder: (order: Order) => Promise<boolean>;
  updateOrder: (id: string, patch: Partial<Order>) => Promise<boolean>;
  saveCoupon: (coupon: Coupon) => Promise<boolean>;
  saveBanner: (banner: Banner) => Promise<boolean>;
  saveReview: (review: Review) => Promise<boolean>;
  moderateReview: (review: Review) => Promise<boolean>;
  checkout: (order: Order) => Promise<{ ok: boolean; order?: Order; persisted: boolean; message?: string }>;
  applyDatabaseSnapshot: (snapshot: Partial<StoreSnapshot>) => void;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  changeAdminPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
};

export type StoreSnapshot = {
  products: Product[];
  categories: Category[];
  orders: Order[];
  coupons: Coupon[];
  banners: Banner[];
  settings: StoreSettings;
  reviews: Review[];
  customers: Customer[];
};
