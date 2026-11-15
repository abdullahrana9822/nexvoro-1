import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import catalog from "../data/catalog.json" with { type: "json" };

const apply = process.argv.includes("--apply");
const replace = process.argv.includes("--replace");
const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!base || !key) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in the shell before seeding.");
  process.exit(1);
}

const headers = {
  apikey: key,
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
};
const endpoint = (table, query = "") => `${base.replace(/\/$/, "")}/rest/v1/${table}${query}`;

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const [existingProducts, existingCategories] = await Promise.all([
    request(endpoint("nexvoro_products", "?select=*&limit=2000")),
    request(endpoint("nexvoro_categories", "?select=*&limit=1000")),
  ]);
  const active = existingProducts.filter((product) => product.is_active);
  if (active.length && !replace) {
    console.error(`Found ${active.length} active NEXVORO product records. No changes made. Re-run with --apply --replace after reviewing a backup.`);
    process.exit(2);
  }

  // Preserve an existing product's primary key when its slug or SKU is being
  // reconciled; order-item foreign keys may refer to that key. Refuse ambiguous
  // collisions instead of deleting or silently merging unrelated records.
  const existingById = new Map(existingProducts.map((product) => [product.id, product]));
  const existingBySlug = new Map(existingProducts.map((product) => [product.slug, product]));
  const existingBySku = new Map(existingProducts.map((product) => [product.sku, product]));
  const productIdMap = new Map();
  const assignedIds = new Set();
  for (const product of catalog.products) {
    const matches = new Set([existingById.get(product.id), existingBySlug.get(product.slug), existingBySku.get(product.sku)].filter(Boolean));
    if (matches.size > 1) {
      console.error(`Catalog identity conflict for ${product.name}: its id, slug and SKU match different existing records. No changes made; reconcile these rows manually.`);
      process.exit(4);
    }
    const existing = matches.values().next().value;
    const targetId = existing?.id || product.id;
    if (assignedIds.has(targetId)) {
      console.error(`Multiple catalog products resolve to existing id ${targetId}. No changes made; reconcile these rows manually.`);
      process.exit(4);
    }
    productIdMap.set(product.id, targetId);
    assignedIds.add(targetId);
  }

  console.log(`Catalog source: ${catalog.products.length} products across ${catalog.categories.length} categories.`);
  console.log(`NEXVORO tables currently contain ${existingProducts.length} product records and ${existingCategories.length} categories.`);
  if (!apply) {
    console.log("Dry run only. No database changes made. Add --apply to export a backup and seed the catalog.");
    return;
  }
  if (process.env.NEXVORO_CATALOG_REVIEWED !== "true") {
    console.error("Refusing to write an unverified catalog. Review product identity, specs, market prices, stock and image rights, then set NEXVORO_CATALOG_REVIEWED=true for this one run.");
    process.exit(3);
  }

  const backupDir = resolve(here, "../catalog-backups");
  await mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupPath = resolve(backupDir, `${timestamp}-nexvoro-catalog.json`);
  await writeFile(backupPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    scope: "Only nexvoro_products and nexvoro_categories; no other tables are exported or modified.",
    products: existingProducts,
    categories: existingCategories,
  }, null, 2) + "\n", { flag: "wx" });
  console.log(`Pre-change catalog export written to ${backupPath}`);

  const now = new Date().toISOString();
  if (active.length) {
    await request(endpoint("nexvoro_products", "?is_active=eq.true"), {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ is_active: false, archived_at: now, updated_at: now }),
    });
    console.log(`Archived ${active.length} existing NEXVORO product rows; nothing was deleted.`);
  }
  const activeCategories = existingCategories.filter((category) => category.is_active);
  if (replace && activeCategories.length) {
    await request(endpoint("nexvoro_categories", "?is_active=eq.true"), {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ is_active: false, updated_at: now }),
    });
    console.log(`Archived ${activeCategories.length} old category rows; product and order records were not deleted.`);
  }

  const categoryRows = catalog.categories.map((category) => ({ ...category, is_active: true, updated_at: now }));
  await request(endpoint("nexvoro_categories", "?on_conflict=slug"), {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(categoryRows),
  });
  const productRows = catalog.products.map((product) => ({
    id: productIdMap.get(product.id),
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category_slug: product.category,
    price: product.price,
    compare_at: product.compareAt,
    description: product.description,
    specs: product.specs,
    stock: product.stock,
    variants: product.variants,
    images: product.images,
    featured: product.featured,
    bestseller: product.bestseller,
    new_arrival: product.newArrival,
    rating: product.rating,
    review_count: product.reviewCount,
    related_ids: product.relatedIds.map((id) => productIdMap.get(id) || id),
    tags: product.tags,
    is_active: true,
    archived_at: null,
    updated_at: now,
  }));
  await request(endpoint("nexvoro_products", "?on_conflict=id"), {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(productRows),
  });

  console.log(`Catalog seeded: ${productRows.length} active products. Existing products were exported before any archival. No records were deleted. Store settings, delivery prices and promotions must be configured separately after review.`);
}

main().catch((error) => {
  console.error(`Catalog seed failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exit(1);
});
