import test from "node:test";
import assert from "node:assert/strict";
import { isDemoOnlyProduct } from "../lib/demo-products.mjs";

test("fixture markers block demo products from the public storefront", () => {
  assert.equal(isDemoOnlyProduct({ id: "demo-test-phone" }), true);
  assert.equal(isDemoOnlyProduct({ sku: "NV-DEMO-001" }), true);
  assert.equal(isDemoOnlyProduct({ name: "[TEST] Demo Smartphone" }), true);
  assert.equal(isDemoOnlyProduct({ tags: ["demo-only"] }), true);
  assert.equal(isDemoOnlyProduct({ tags: ["test-catalog"] }), true);
});

test("normal catalogue records remain sellable", () => {
  assert.equal(isDemoOnlyProduct({
    id: "iphone-16-pro",
    sku: "NV-APL-001",
    name: "iPhone 16 Pro",
    tags: ["smartphone", "bestseller"],
  }), false);
});

test("malformed optional fixture fields do not throw", () => {
  assert.equal(isDemoOnlyProduct(null), false);
  assert.equal(isDemoOnlyProduct(undefined), false);
  assert.equal(isDemoOnlyProduct({ id: 123, sku: null, name: {}, tags: "demo-only" }), false);
});
