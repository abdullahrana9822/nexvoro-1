import catalog from "@/data/catalog.json";
import type { Category, Product } from "./types";

export const SEED_CATEGORIES = catalog.categories as Category[];
export const SEED_PRODUCTS = catalog.products as Product[];
export const findProduct = (products: Product[], slugOrId: string) =>
  products.find((product) => product.slug === slugOrId || product.id === slugOrId);
export const getCategory = (categories: Category[], slug: string) =>
  categories.find((category) => category.slug === slug);
