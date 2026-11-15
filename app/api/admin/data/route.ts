import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { THEMES } from "@/lib/themes";
import { CURRENCY_CODES, isCurrencyCode } from "@/lib/currency.mjs";
import { getAdminSession } from "@/lib/server/admin-auth";
import { readJsonBody } from "@/lib/server/http";
import { databaseConfigured, getDatabase, mapDatabaseOrder, mapDatabaseProduct } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapSpendByCurrency(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([currency, amount]) =>
    isCurrencyCode(currency) && typeof amount === "number" && Number.isFinite(amount) && amount >= 0,
  ));
}

const topLevel = z.object({
  resource: z.enum(["products", "categories", "orders", "customers", "coupons", "banners", "settings", "reviews"]),
  action: z.enum(["upsert", "update", "archive"]),
  record: z.record(z.string(), z.unknown()),
});
const price = z.number().finite().min(0).max(100_000_000);
const productSchema = z.object({
  id: z.string().min(1).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sku: z.string().min(2).max(80), name: z.string().min(2).max(180), brand: z.string().min(1).max(100),
  category: z.string().min(1).max(100), price, compareAt: price, description: z.string().max(4000),
  specs: z.record(z.string(), z.string()).default({}), stock: z.number().int().min(0).max(1_000_000),
  variants: z.array(z.string().max(120)).max(30).default([]),
  images: z.array(z.string().url().refine((value) => value.startsWith("https://"), "Images must use HTTPS.")).max(12).default([]),
  featured: z.boolean().default(false), bestseller: z.boolean().default(false), newArrival: z.boolean().default(false),
  rating: z.number().min(0).max(5).nullable().default(null), reviewCount: z.number().int().min(0).default(0),
  relatedIds: z.array(z.string()).default([]), tags: z.array(z.string()).default([]),
}).refine((value) => value.compareAt >= value.price, { message: "Original price must be at least the sale price." });
const categorySchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().min(2).max(120),
  eyebrow: z.string().max(120).default(""), description: z.string().max(500).default(""), image: z.string().max(2000).optional(),
});
const couponSchema = z.object({
  id: z.string().min(1).max(120), code: z.string().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(["percent", "fixed"]), value: z.number().finite().min(0).max(100_000_000),
  active: z.boolean(), expiresAt: z.string().optional(), usageLimit: z.number().int().min(1).optional(),
});
const bannerSchema = z.object({
  id: z.string().min(1).max(120), title: z.string().min(2).max(160), subtitle: z.string().max(300),
  image: z.string().url().refine((value) => value.startsWith("https://"), "Image must use HTTPS."),
  href: z.string().max(250).refine((value) => value.startsWith("/") || value.startsWith("https://"), "Use a site path or HTTPS URL."),
  active: z.boolean(),
});
const settingsSchema = z.object({
  storeName: z.string().min(2).max(100), tagline: z.string().max(180),
  currency: z.string().refine((code) => CURRENCY_CODES.includes(code), "Choose a supported store currency."),
  fxFallbackRates: z.record(z.string(), z.number().finite().positive().max(1_000_000_000_000)).default({}),
  fxAdjustmentBps: z.number().int().min(-5000).max(50000).default(0),
  fxCacheTtlMinutes: z.number().int().min(1).max(1440).default(60),
  defaultTheme: z.enum(THEMES.map((theme) => theme.id) as [string, ...string[]]), allowThemeSwitch: z.boolean(),
  shippingFee: price, freeShippingThreshold: price, supportEmail: z.string().email().max(180),
  contactPhone: z.string().max(60), instagramUrl: z.string().max(250).refine((value) => !value || value.startsWith("https://")),
  facebookUrl: z.string().max(250).refine((value) => !value || value.startsWith("https://")),
  xUrl: z.string().max(250).refine((value) => !value || value.startsWith("https://")), salesTarget: price,
}).refine((settings) => Object.keys(settings.fxFallbackRates).every((code) => CURRENCY_CODES.includes(code) && code !== settings.currency), {
  message: "Fallback rates must use supported currencies and cannot include the store base currency.",
});
const orderSchema = z.object({
  id: z.string().min(1).max(120), status: z.enum(["pending", "processing", "shipped", "completed", "cancelled", "refunded"]),
  trackingNumber: z.string().max(160).optional(),
});
const customerSchema = z.object({
  id: z.string().min(1).max(180), email: z.string().email().max(180), name: z.string().min(1).max(160), phone: z.string().max(60),
});
const reviewSchema = z.object({
  id: z.string().min(1).max(120), productId: z.string().min(1).max(120), name: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5), title: z.string().max(120), body: z.string().min(5).max(1200),
  approved: z.boolean(), createdAt: z.string().optional(),
});
const tables = {
  products: "nexvoro_products", categories: "nexvoro_categories", orders: "nexvoro_orders",
  customers: "nexvoro_customers", coupons: "nexvoro_coupons", banners: "nexvoro_banners",
  settings: "nexvoro_store_settings", reviews: "nexvoro_reviews",
} as const;

function dbProduct(row: Record<string, unknown>) {
  return {
    id: row.id, slug: row.slug, sku: row.sku, name: row.name, brand: row.brand, category_slug: row.category,
    price: row.price, compare_at: row.compareAt, description: row.description, specs: row.specs, stock: row.stock,
    variants: row.variants, images: row.images, featured: row.featured, bestseller: row.bestseller,
    new_arrival: row.newArrival, rating: row.rating, review_count: row.reviewCount,
    related_ids: row.relatedIds, tags: row.tags, is_active: true,
  };
}

export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  try {
    const [products, categories, orders, customers, coupons, banners, settings, reviews, newsletter, messages] = await Promise.all([
      db.from(tables.products).select("*").eq("is_active", true).order("created_at", { ascending: false }),
      db.from(tables.categories).select("*").eq("is_active", true).order("name"),
      db.from(tables.orders).select("*").order("created_at", { ascending: false }).limit(1000),
      db.from(tables.customers).select("*").order("joined_at", { ascending: false }).limit(1000),
      db.from(tables.coupons).select("*").order("created_at", { ascending: false }),
      db.from(tables.banners).select("*").order("created_at", { ascending: false }),
      db.from(tables.settings).select("payload").eq("id", "store").maybeSingle(),
      db.from(tables.reviews).select("*").order("created_at", { ascending: false }).limit(1000),
      db.from("nexvoro_newsletter_subscribers").select("*").order("consented_at", { ascending: false }).limit(2000),
      db.from("nexvoro_contact_messages").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    const firstError = [products, categories, orders, customers, coupons, banners, settings, reviews, newsletter, messages].find((item) => item.error);
    if (firstError?.error) {
      return NextResponse.json({ error: "Store tables are unavailable. Apply the supplied Supabase migration first." }, { status: 503 });
    }
    const orderRows = orders.data || [];
    const orderIds = orderRows.map((row) => row.id);
    const itemResult = orderIds.length
      ? await db.from("nexvoro_order_items").select("*").in("order_id", orderIds)
      : { data: [], error: null };
    if (itemResult.error) return NextResponse.json({ error: "Order items could not be loaded." }, { status: 503 });
    const groupedItems = new Map<string, Record<string, unknown>[]>();
    (itemResult.data || []).forEach((item) => {
      const list = groupedItems.get(item.order_id) || [];
      list.push(item as Record<string, unknown>);
      groupedItems.set(item.order_id, list);
    });
    return NextResponse.json({
      products: (products.data || []).map((row) => mapDatabaseProduct(row as Record<string, unknown>)),
      categories: (categories.data || []).map((row) => ({ slug: row.slug, name: row.name, eyebrow: row.eyebrow, description: row.description, image: row.image || undefined })),
      orders: orderRows.map((row) => mapDatabaseOrder({ ...row, items: groupedItems.get(row.id) || [] })),
      customers: (customers.data || []).map((row) => ({
        id: row.id, name: row.name, email: row.email, phone: row.phone, orderCount: row.order_count,
        spendByCurrency: mapSpendByCurrency(row.spend_by_currency), joinedAt: row.joined_at,
      })),
      coupons: (coupons.data || []).map((row) => ({ id: row.id, code: row.code, type: row.kind, value: Number(row.value), active: row.is_active, expiresAt: row.expires_at || undefined, usageLimit: row.usage_limit || undefined })),
      banners: (banners.data || []).map((row) => ({ id: row.id, title: row.title, subtitle: row.subtitle, image: row.image, href: row.href, active: row.is_active })),
      settings: settings.data?.payload || undefined,
      reviews: (reviews.data || []).map((row) => ({ id: row.id, productId: row.product_id, name: row.reviewer_name, rating: row.rating, title: row.title, body: row.body, createdAt: row.created_at, approved: row.is_approved })),
      newsletter: newsletter.data || [],
      messages: messages.data || [],
      database: true,
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The admin data could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin admin change rejected." }, { status: 403 });
  if (!getAdminSession(request)) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  const db = getDatabase();
  if (!db || !databaseConfigured()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const rawBody = await readJsonBody(request, 256_000);
  if (!rawBody.ok) return NextResponse.json({ error: rawBody.reason === "too_large" ? "Admin request is too large." : "Invalid admin request." }, { status: rawBody.reason === "too_large" ? 413 : 400 });
  const body = topLevel.safeParse(rawBody.value);
  if (!body.success) return NextResponse.json({ error: "Invalid admin request." }, { status: 400 });
  const { resource, action, record } = body.data;
  if (action === "archive" && ["products", "categories", "banners"].includes(resource)) {
    const id = typeof record.id === "string" ? record.id : typeof record.slug === "string" ? record.slug : "";
    if (!id) return NextResponse.json({ error: "A record id is required." }, { status: 400 });
    const key = resource === "categories" ? "slug" : "id";
    const archivePatch = resource === "products"
      ? { is_active: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : { is_active: false, updated_at: new Date().toISOString() };
    const result = await db.from(tables[resource as "products" | "categories" | "banners"])
      .update(archivePatch)
      .eq(key, id);
    if (result.error) return NextResponse.json({ error: "Record could not be archived." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (resource === "products") {
    const parsed = productSchema.safeParse(record);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product." }, { status: 400 });
    const data = dbProduct(parsed.data);
    const { error } = await db.from(tables.products).upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: "Product could not be saved. Check that its SKU and slug are unique." }, { status: 400 });
  } else if (resource === "categories") {
    const parsed = categorySchema.safeParse(record);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid category." }, { status: 400 });
    const { error } = await db.from(tables.categories).upsert({
      slug: parsed.data.slug, name: parsed.data.name, eyebrow: parsed.data.eyebrow,
      description: parsed.data.description, image: parsed.data.image || null, is_active: true, updated_at: new Date().toISOString(),
    }, { onConflict: "slug" });
    if (error) return NextResponse.json({ error: "Category could not be saved." }, { status: 400 });
  } else if (resource === "orders") {
    const parsed = orderSchema.safeParse(record);
    if (!parsed.success) return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
    const { error } = await db.rpc("nexvoro_update_order_status", {
      p_order_id: parsed.data.id, p_status: parsed.data.status, p_tracking_number: parsed.data.trackingNumber || null,
    });
    if (error) return NextResponse.json({ error: error.message.includes("cannot be reopened") ? error.message : "Order status could not be updated." }, { status: 400 });
  } else if (resource === "customers") {
    const parsed = customerSchema.safeParse(record);
    if (!parsed.success) return NextResponse.json({ error: "Invalid customer profile." }, { status: 400 });
    const { error } = await db.from(tables.customers).update({ name: parsed.data.name, phone: parsed.data.phone, updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
    if (error) return NextResponse.json({ error: "Customer profile could not be updated." }, { status: 400 });
  } else if (resource === "coupons") {
    const parsed = couponSchema.safeParse(record);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid coupon." }, { status: 400 });
    const { error } = await db.from(tables.coupons).upsert({
      id: parsed.data.id, code: parsed.data.code.toUpperCase(), kind: parsed.data.type, value: parsed.data.value,
      is_active: parsed.data.active, expires_at: parsed.data.expiresAt || null, usage_limit: parsed.data.usageLimit || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: "Coupon could not be saved. Coupon codes must be unique." }, { status: 400 });
  } else if (resource === "banners") {
    const parsed = bannerSchema.safeParse(record);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid banner." }, { status: 400 });
    const { error } = await db.from(tables.banners).upsert({
      id: parsed.data.id, title: parsed.data.title, subtitle: parsed.data.subtitle,
      image: parsed.data.image, href: parsed.data.href, is_active: parsed.data.active, updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: "Banner could not be saved." }, { status: 400 });
  } else if (resource === "settings") {
    const parsed = settingsSchema.safeParse(record);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid store settings." }, { status: 400 });
    const { error } = await db.from(tables.settings).upsert({ id: "store", payload: parsed.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: "Store settings could not be saved." }, { status: 400 });
  } else if (resource === "reviews") {
    const parsed = reviewSchema.safeParse(record);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid review." }, { status: 400 });
    const { error } = await db.from(tables.reviews).update({ is_approved: parsed.data.approved }).eq("id", parsed.data.id);
    if (error) return NextResponse.json({ error: "Review status could not be updated." }, { status: 400 });
  } else {
    return NextResponse.json({ error: "This admin action is not supported." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
