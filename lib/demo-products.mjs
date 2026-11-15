/**
 * Identify catalogue fixtures that are explicitly marked as non-fulfillable.
 * These checks are intentionally redundant so removing one marker alone cannot
 * accidentally make a demo listing sellable.
 *
 * @param {{ id?: unknown; sku?: unknown; name?: unknown; tags?: unknown } | null | undefined} product
 */
export function isDemoOnlyProduct(product) {
  if (!product || typeof product !== "object") return false;
  const id = typeof product.id === "string" ? product.id.trim().toLowerCase() : "";
  const sku = typeof product.sku === "string" ? product.sku.trim().toLowerCase() : "";
  const name = typeof product.name === "string" ? product.name.trim().toLowerCase() : "";
  const tags = Array.isArray(product.tags)
    ? product.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim().toLowerCase())
    : [];

  return id.startsWith("demo-test-") || sku.startsWith("nv-demo-") || name.startsWith("[test]") ||
    tags.includes("demo-only") || tags.includes("test-catalog");
}
