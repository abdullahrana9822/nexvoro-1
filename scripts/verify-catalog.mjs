import assert from "node:assert/strict";
import catalog from "../data/catalog.json" with { type: "json" };

assert.equal(catalog.categories.length, 15, "The launch catalog must cover all 15 requested categories.");
assert.ok(catalog.products.length >= 50, "The launch catalog must contain at least 50 products.");

const categorySlugs = new Set(catalog.categories.map((category) => category.slug));
const ids = new Set();
const slugs = new Set();
const skus = new Set();
const names = new Set();

for (const product of catalog.products) {
  assert.ok(product.id && !ids.has(product.id), `Duplicate or empty product id: ${product.id}`);
  assert.ok(product.slug && !slugs.has(product.slug), `Duplicate or empty product slug: ${product.slug}`);
  assert.ok(product.sku && !skus.has(product.sku), `Duplicate or empty product SKU: ${product.sku}`);
  assert.ok(product.name && !names.has(product.name.toLowerCase()), `Duplicate or empty product name: ${product.name}`);
  assert.ok(categorySlugs.has(product.category), `Unknown product category: ${product.category}`);
  assert.ok(Number.isFinite(product.price) && product.price >= 0, `Invalid price for ${product.id}`);
  assert.ok(Number.isFinite(product.compareAt) && product.compareAt >= product.price, `Invalid compare-at price for ${product.id}`);
  assert.ok(Number.isInteger(product.stock) && product.stock >= 0, `Invalid inventory for ${product.id}`);
  assert.ok(product.description.trim().length >= 20, `Missing description for ${product.id}`);
  assert.ok(Object.keys(product.specs || {}).length > 0, `Missing specifications for ${product.id}`);
  assert.ok(Array.isArray(product.images) && product.images.length > 0 && product.images.length <= 12, `Missing or oversized gallery for ${product.id}`);
  assert.ok(product.images.every((image) => typeof image === "string" && image.startsWith("https://")), `Non-HTTPS image for ${product.id}`);
  assert.ok(product.rating === null && product.reviewCount === 0, `Seed data must not invent ratings or reviews for ${product.id}`);
  assert.ok(Array.isArray(product.relatedIds) && product.relatedIds.every((id) => id !== product.id), `Invalid related products for ${product.id}`);
  ids.add(product.id);
  slugs.add(product.slug);
  skus.add(product.sku);
  names.add(product.name.toLowerCase());
}

for (const product of catalog.products) {
  for (const id of product.relatedIds) assert.ok(ids.has(id), `Unknown related product ${id} referenced by ${product.id}`);
}
for (const category of catalog.categories) {
  assert.ok(catalog.products.some((product) => product.category === category.slug), `No products in category ${category.slug}`);
}

console.log(`Catalog structure checks passed: ${catalog.products.length} sample records across ${catalog.categories.length} categories. This check does not verify product identity, specifications, prices, stock, or image rights.`);
