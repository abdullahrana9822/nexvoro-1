import { NextResponse } from "next/server";
import catalog from "@/data/catalog.json";
import { isCurrencyCode } from "@/lib/currency.mjs";
import { isDemoOnlyProduct } from "@/lib/demo-products.mjs";
import { getDatabase, mapDatabaseProduct } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasCommerceSettings(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const settings = payload as Record<string, unknown>;
  return typeof settings.storeName === "string" && settings.storeName.trim().length >= 2 &&
    isCurrencyCode(settings.currency) &&
    typeof settings.shippingFee === "number" && Number.isFinite(settings.shippingFee) && settings.shippingFee >= 0 &&
    typeof settings.freeShippingThreshold === "number" && Number.isFinite(settings.freeShippingThreshold) && settings.freeShippingThreshold >= 0;
}

export async function GET() {
  const db = getDatabase();
  if (!db) {
    return NextResponse.json({
      products: catalog.products,
      categories: catalog.categories,
      source: "preview",
      database: false,
      commerceConfigured: false,
    }, {
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
    });
  }

  try {
    const [productsResult, categoriesResult, settingsResult, couponsResult, bannersResult, reviewsResult] = await Promise.all([
      db.from("nexvoro_products").select("*").eq("is_active", true).order("featured", { ascending: false }).order("name"),
      db.from("nexvoro_categories").select("slug,name,eyebrow,description,image,is_active").eq("is_active", true).order("name"),
      db.from("nexvoro_store_settings").select("payload").eq("id", "store").maybeSingle(),
      db.from("nexvoro_coupons").select("id,code,kind,value,is_active,expires_at,usage_limit,usage_count").eq("is_active", true).order("created_at", { ascending: false }),
      db.from("nexvoro_banners").select("id,title,subtitle,image,href,is_active").eq("is_active", true).order("created_at", { ascending: false }),
      db.from("nexvoro_reviews").select("id,product_id,reviewer_name,rating,title,body,created_at,is_approved").eq("is_approved", true).order("created_at", { ascending: false }).limit(1000),
    ]);
    const firstError = [productsResult, categoriesResult, settingsResult, couponsResult, bannersResult, reviewsResult].find((result) => result.error);
    if (firstError?.error) {
      return NextResponse.json({ error: "The store database is not ready. Apply the supplied Supabase migration and try again." }, {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }

    const now = Date.now();
    const coupons = (couponsResult.data || [])
      .filter((row) => (!row.expires_at || new Date(row.expires_at).getTime() > now) &&
        (row.usage_limit == null || Number(row.usage_count || 0) < Number(row.usage_limit)))
      .map((row) => ({
        id: row.id,
        code: row.code,
        type: row.kind,
        value: Number(row.value),
        active: row.is_active,
        expiresAt: row.expires_at || undefined,
        usageLimit: row.usage_limit || undefined,
      }));
    const settings = settingsResult.data?.payload && typeof settingsResult.data.payload === "object"
      ? settingsResult.data.payload
      : undefined;
    const storefrontProducts = (productsResult.data || []).filter((row) => !isDemoOnlyProduct(row as Record<string, unknown>));
    const storefrontCategorySlugs = new Set(storefrontProducts.map((row) => row.category_slug));
    const storefrontCategories = (categoriesResult.data || []).filter((row) => storefrontCategorySlugs.has(row.slug));
    const hasInStockProduct = storefrontProducts.some((row) => Number(row.stock) > 0);
    const commerceConfigured = hasCommerceSettings(settings) && hasInStockProduct;

    return NextResponse.json({
      products: storefrontProducts.map((row) => mapDatabaseProduct(row as Record<string, unknown>)),
      categories: storefrontCategories.map((row) => ({
        slug: row.slug,
        name: row.name,
        eyebrow: row.eyebrow,
        description: row.description,
        image: row.image || undefined,
      })),
      coupons,
      banners: (bannersResult.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        image: row.image,
        href: row.href,
        active: row.is_active,
      })),
      reviews: (reviewsResult.data || []).map((row) => ({
        id: row.id,
        productId: row.product_id,
        name: row.reviewer_name,
        rating: row.rating,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        approved: row.is_approved,
      })),
      settings,
      source: "database",
      database: true,
      commerceConfigured,
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The store database could not be reached." }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
