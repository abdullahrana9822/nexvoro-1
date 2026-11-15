import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import edits from "../data/storefront-edits.json" with { type: "json" };

const storeProvider = await readFile(resolve("lib/store.tsx"), "utf8");
assert.doesNotMatch(
  storeProvider,
  /from ["']\.\/catalog["']/,
  "The browser store must load catalog data from the store API, not bundle the full sample catalog into every page.",
);

const expectedCollections = [
  "Future Tech Picks",
  "Gadgets You Didn't Know Existed",
  "AI-Powered Innovations",
  "Smart Life Collection",
  "Desk Setup Essentials",
  "Hidden Tech Gems",
  "Next-Gen Gaming",
  "Portable Tech",
  "Viral Tech Finds",
  "Premium Gadget Collection",
];
const expectedDiscovery = [
  "Discover Something New",
  "Trending This Week",
  "New Technology Arrivals",
  "Staff Picks",
  "Compare Interesting Gadgets",
  "Featured Gadget of the Day",
];

assert.equal(edits.exploreByInterest.name, "Explore by Interest");
assert.deepEqual(edits.collections.map((item) => item.name), expectedCollections);
assert.deepEqual(edits.discovery.map((item) => item.name), expectedDiscovery);

for (const [kind, entries] of [["collection", edits.collections], ["discovery", edits.discovery]]) {
  const slugs = new Set();
  const tags = new Set();
  for (const entry of entries) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid ${kind} slug: ${entry.slug}`);
    assert.ok(!slugs.has(entry.slug), `Duplicate ${kind} slug: ${entry.slug}`);
    assert.ok(!tags.has(entry.tag), `Duplicate ${kind} product tag: ${entry.tag}`);
    assert.equal(entry.tag, `${kind}:${entry.slug}`, `Unexpected ${kind} tag convention for ${entry.slug}`);
    assert.ok(entry.description.trim().length > 20, `Missing ${kind} description: ${entry.slug}`);
    if (kind === "collection") {
      assert.ok(entry.image.startsWith("/images/collections/"), `Missing collection illustration path: ${entry.slug}`);
      const image = await readFile(resolve("public", entry.image.slice(1)));
      assert.deepEqual([...image.subarray(0, 3)], [0xff, 0xd8, 0xff], `Collection art must be a JPEG: ${entry.slug}`);
      assert.ok(image.length > 10_000, `Collection illustration looks unexpectedly small: ${entry.slug}`);
    }
    slugs.add(entry.slug);
    tags.add(entry.tag);
  }
}

console.log(`Storefront edit checks passed: ${edits.collections.length} named collections, Explore by Interest, and ${edits.discovery.length} discovery shelves.`);
