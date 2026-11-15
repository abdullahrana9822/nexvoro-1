import { NextResponse } from "next/server";
import { adminConfigured } from "@/lib/server/admin-auth";
import { isCurrencyCode } from "@/lib/currency.mjs";
import { isDemoOnlyProduct } from "@/lib/demo-products.mjs";
import { databaseConfigured, getDatabase } from "@/lib/server/db";

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

function unavailable() {
  return NextResponse.json({ ok: true, database: false, adminConfigured: false, commerceConfigured: false, mode: "preview" }, {
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  if (!databaseConfigured()) return unavailable();

  try {
    const db = getDatabase();
    if (!db) return unavailable();
    const { data, error } = await db.rpc("nexvoro_store_health");
    const database = !error && data === true;
    if (!database) {
      return NextResponse.json({ ok: true, database: false, adminConfigured: false, commerceConfigured: false, mode: "preview" }, {
        headers: { "cache-control": "no-store" },
      });
    }

    const [{ data: settings, error: settingsError }, { error: adminTableError }, { data: products, error: productsError }] = await Promise.all([
      db.from("nexvoro_store_settings").select("payload").eq("id", "store").maybeSingle(),
      db.from("nexvoro_admin_users").select("id").limit(1),
      db.from("nexvoro_products").select("id,sku,name,tags,stock").eq("is_active", true).limit(1000),
    ]);
    const hasSaleableProduct = !productsError && (products || []).some((product) =>
      Number(product.stock) > 0 && !isDemoOnlyProduct(product as Record<string, unknown>),
    );
    const commerceConfigured = !settingsError && hasCommerceSettings(settings?.payload) && hasSaleableProduct;
    return NextResponse.json({
      ok: true,
      database: true,
      adminConfigured: adminConfigured() && !adminTableError,
      commerceConfigured,
      mode: "database",
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return unavailable();
  }
}
