import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function databaseConfigured() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getDatabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "nexvoro-store" } },
  });
}

export function mapDatabaseProduct(row: Record<string, unknown>) {
  const related = row.related_ids ?? row.relatedIds;
  return {
    id: String(row.id || ""),
    slug: String(row.slug || row.id || ""),
    sku: String(row.sku || ""),
    name: String(row.name || ""),
    brand: String(row.brand || "NEXVORO"),
    category: String(row.category_slug || row.category || ""),
    price: Number(row.price || 0),
    compareAt: Number(row.compare_at || row.compareAt || row.price || 0),
    description: String(row.description || ""),
    specs: (row.specs && typeof row.specs === "object" ? row.specs : {}) as Record<string, string>,
    stock: Number(row.stock || 0),
    variants: Array.isArray(row.variants) ? row.variants.map(String) : [],
    images: Array.isArray(row.images) ? row.images.map(String) : [],
    featured: Boolean(row.featured),
    bestseller: Boolean(row.bestseller),
    newArrival: Boolean(row.new_arrival ?? row.newArrival),
    rating: row.rating == null ? null : Number(row.rating),
    reviewCount: Number(row.review_count ?? row.reviewCount ?? 0),
    relatedIds: Array.isArray(related) ? related.map(String) : [],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  };
}

export function mapDatabaseOrder(row: Record<string, unknown>) {
  const address = row.address && typeof row.address === "object" ? row.address as Record<string, unknown> : {};
  const customer = row.customer && typeof row.customer === "object" ? row.customer as Record<string, unknown> : {};
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: String(row.id || ""),
    orderNo: String(row.order_no || row.orderNo || ""),
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    customer: {
      name: String(row.customer_name || customer.name || ""),
      email: String(row.email || customer.email || ""),
      phone: String(row.phone || customer.phone || ""),
    },
    address: {
      line1: String(address.line1 || ""), line2: String(address.line2 || ""), city: String(address.city || ""),
      region: String(address.region || ""), postalCode: String(address.postalCode || address.postal_code || ""),
      country: String(address.country || ""),
    },
    items: items.map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        productId: String(entry.product_id || entry.productId || ""),
        name: String(entry.product_name || entry.name || ""),
        sku: String(entry.sku || ""), price: Number(entry.unit_price || entry.price || 0),
        quantity: Number(entry.quantity || 0), variant: String(entry.variant || ""),
      };
    }),
    subtotal: Number(row.subtotal || 0),
    shipping: Number(row.shipping || 0),
    discount: Number(row.discount || 0),
    total: Number(row.total || 0),
    currency: String(row.currency_code || row.currency || "") || undefined,
    paymentCurrency: String(row.payment_currency || row.paymentCurrency || "") || undefined,
    fxRate: row.fx_rate == null && row.fxRate == null ? undefined : Number(row.fx_rate ?? row.fxRate),
    fxRateAt: String(row.fx_rate_at || row.fxRateAt || "") || undefined,
    fxRateSource: (String(row.fx_rate_source || row.fxRateSource || "") || undefined) as "identity" | "live" | "fallback" | "stale" | undefined,
    paymentSubtotal: row.payment_subtotal == null && row.paymentSubtotal == null ? undefined : Number(row.payment_subtotal ?? row.paymentSubtotal),
    paymentShipping: row.payment_shipping == null && row.paymentShipping == null ? undefined : Number(row.payment_shipping ?? row.paymentShipping),
    paymentDiscount: row.payment_discount == null && row.paymentDiscount == null ? undefined : Number(row.payment_discount ?? row.paymentDiscount),
    paymentTotal: row.payment_total == null && row.paymentTotal == null ? undefined : Number(row.payment_total ?? row.paymentTotal),
    status: String(row.status || "pending"),
    paymentMethod: String(row.payment_method || row.paymentMethod || "cash_on_delivery"),
    coupon: String(row.coupon || ""),
    trackingNumber: String(row.tracking_number || row.trackingNumber || ""),
  };
}
