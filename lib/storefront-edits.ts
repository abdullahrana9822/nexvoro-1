import edits from "@/data/storefront-edits.json";

export type StorefrontCollection = (typeof edits.collections)[number];
export type DiscoverySection = (typeof edits.discovery)[number];

export const EXPLORE_BY_INTEREST = edits.exploreByInterest;
export const COLLECTIONS = edits.collections;
export const DISCOVERY = edits.discovery;

export function getCollection(slug: string) {
  return COLLECTIONS.find((collection) => collection.slug === slug);
}

export function getDiscoverySection(slug: string) {
  return DISCOVERY.find((section) => section.slug === slug);
}
