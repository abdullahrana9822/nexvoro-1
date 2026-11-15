import type { Product } from "./types";
import { formatMoney } from "./currency.mjs";

export { formatMoney };

export function salePercent(product: Pick<Product, "price" | "compareAt">) {
  if (!product.compareAt || product.compareAt <= product.price) return 0;
  return Math.round((1 - product.price / product.compareAt) * 100);
}

export function productImage(product?: Product) {
  return product?.images?.[0] || "";
}

export function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function safeText(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function makeId(prefix = "nx") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function toDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
