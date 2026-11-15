"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Filter, SlidersHorizontal, X, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatMoney, salePercent } from "@/lib/utils";
import { convertBetweenCurrencies } from "@/lib/currency.mjs";
import type { Product } from "@/lib/types";
import ProductMedia from "@/components/ProductMedia";
import { ProductCard } from "@/components/StorePrimitives";

export type CatalogMode = "all" | "category" | "new" | "best" | "trending" | "offers" | "flash" | "collection" | "discovery";

const modeInfo: Record<CatalogMode, { eyebrow: string; title: string; description: string }> = {
  all: { eyebrow: "THE COMPLETE NEXVORO EDIT", title: "The considered collection.", description: "A thoughtful mix of technology for work, play and the in-between. Find what fits your life." },
  category: { eyebrow: "THE CATEGORY EDIT", title: "Find your frequency.", description: "Explore a considered selection, chosen for how it works and how it feels." },
  new: { eyebrow: "FRESH OFF THE EDITOR'S DESK", title: "New, and already essential.", description: "The latest additions to our edit. New arrivals, considered from the first look." },
  best: { eyebrow: "THE ONES THAT KEEP THEIR PLACE", title: "The NEXVORO favorites.", description: "Our current best sellers, chosen by the community and kept in good company." },
  trending: { eyebrow: "A LITTLE MOMENTUM", title: "Worth talking about.", description: "Fresh finds, community favorites and the products people keep coming back to." },
  offers: { eyebrow: "THE GOOD-FIND SALE", title: "Good things. Better prices.", description: "Thoughtful offers on selected pieces. The original and current prices are shown clearly." },
  flash: { eyebrow: "THE LIVE OFFER EDIT", title: "A moment worth catching.", description: "A changing selection of current offers. No made-up countdowns — just the prices available now." },
  collection: { eyebrow: "THE NEXVORO COLLECTIONS", title: "A considered edit.", description: "A focused selection of gadgets and useful technology." },
  discovery: { eyebrow: "THE NEXVORO DISCOVERY EDIT", title: "Discover something new.", description: "A curated selection with product details checked before it is listed." },
};

export default function CatalogPage({ mode, categorySlug, includeCategories, tagFilter, customTitle, customDescription, onQuickView }: { mode: CatalogMode; categorySlug?: string; includeCategories?: string[]; tagFilter?: string; customTitle?: string; customDescription?: string; onQuickView: (product: Product) => void }) {
  const { products, categories, settings, displayCurrency, exchangeRates } = useStore();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(categorySlug || "all");
  const [brand, setBrand] = useState("all");
  const [sort, setSort] = useState("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const meta = modeInfo[mode];
  const selectedCategory = categories.find((category) => category.slug === categorySlug);
  const brands = useMemo(() => Array.from(new Set(products.map((product) => product.brand))).sort(), [products]);
  const maxAvailableBase = useMemo(() => Math.max(...products.map((product) => product.price), 1), [products]);
  const filterCurrency = displayCurrency !== settings.currency && Number.isFinite(exchangeRates[displayCurrency]) ? displayCurrency : settings.currency;
  const maxAvailable = filterCurrency === settings.currency
    ? maxAvailableBase
    : convertBetweenCurrencies(maxAvailableBase, settings.currency, filterCurrency, settings.currency, exchangeRates) ?? maxAvailableBase;
  const minPriceBase = minPrice > 0
    ? convertBetweenCurrencies(minPrice, filterCurrency, settings.currency, settings.currency, exchangeRates) ?? minPrice
    : 0;
  const maxPriceBase = maxPrice > 0
    ? convertBetweenCurrencies(maxPrice, filterCurrency, settings.currency, settings.currency, exchangeRates) ?? maxPrice
    : maxAvailableBase;
  const maxValue = maxPrice > 0 ? maxPriceBase : maxAvailableBase;
  const heading = customTitle || (mode === "category" && selectedCategory ? selectedCategory.name : meta.title);
  const subheading = customDescription || (mode === "category" && selectedCategory ? selectedCategory.description : meta.description);
  const categoryFeature = mode === "category"
    ? products.find((product) => product.category === categorySlug && product.featured) || products.find((product) => product.category === categorySlug)
    : tagFilter ? products.find((product) => product.tags.includes(tagFilter)) : undefined;

  const filtered = useMemo(() => {
    let list = [...products];
    if (mode === "category" && categorySlug) list = list.filter((product) => product.category === categorySlug);
    if ((mode === "collection" || mode === "discovery") && tagFilter) list = list.filter((product) => product.tags.includes(tagFilter));
    if (includeCategories?.length) list = list.filter((product) => includeCategories.includes(product.category));
    if (mode === "new") list = list.filter((product) => product.newArrival);
    if (mode === "best") list = list.filter((product) => product.bestseller);
    if (mode === "trending") list = list.filter((product) => product.bestseller || product.featured);
    if (mode === "offers" || mode === "flash") list = list.filter((product) => salePercent(product) > 0);
    if (activeCategory !== "all") list = list.filter((product) => product.category === activeCategory);
    if (brand !== "all") list = list.filter((product) => product.brand === brand);
    if (inStockOnly) list = list.filter((product) => product.stock > 0);
    if (minPriceBase > 0) list = list.filter((product) => product.price >= minPriceBase);
    list = list.filter((product) => product.price <= maxValue);
    const needle = search.trim().toLowerCase();
    if (needle) list = list.filter((product) => `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(needle));
    if (sort === "price-low") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-high") list.sort((a, b) => b.price - a.price);
    else if (sort === "newest") list.sort((a, b) => Number(b.newArrival) - Number(a.newArrival));
    else if (sort === "discount") list.sort((a, b) => salePercent(b) - salePercent(a));
    else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.bestseller) - Number(a.bestseller));
    return list;
  }, [products, mode, categorySlug, includeCategories, tagFilter, activeCategory, brand, inStockOnly, minPriceBase, maxValue, search, sort]);

  const clearFilters = () => { setSearch(""); setBrand("all"); setActiveCategory(categorySlug || "all"); setMinPrice(0); setMaxPrice(0); setInStockOnly(false); setSort("featured"); setPageSize(20); };
  const activeCount = [search, brand !== "all", activeCategory !== "all" && mode !== "category", minPrice > 0, maxPrice > 0, inStockOnly].filter(Boolean).length;

  return (
    <div className={`catalog-page catalog-mode-${mode}`}>
      <div className={`catalog-hero ${categoryFeature ? "catalog-hero-with-image" : ""}`}>
        {categoryFeature && <div className="catalog-hero-image"><ProductMedia product={categoryFeature} /></div>}
        <div className="catalog-hero-copy"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link>{(selectedCategory || mode === "collection" || mode === "discovery") && <><span>/</span><span>{selectedCategory?.name || heading}</span></>}</div><span className="eyebrow">{selectedCategory?.eyebrow || meta.eyebrow}</span><h1>{heading}</h1><p>{subheading}</p><div className="catalog-hero-foot"><span>{filtered.length} {filtered.length === 1 ? "considered piece" : "considered pieces"}</span><span><i /> Curated for everyday life</span></div></div>
        {!categoryFeature && <span className="catalog-hero-stamp"><Sparkles size={18} />N / 01</span>}
      </div>

      {mode === "all" && <div className="catalog-category-links"><span className="eyebrow">JUMP INTO A CATEGORY</span><div className="catalog-category-pills">{categories.map((item) => <Link href={`/category/${item.slug}`} key={item.slug}>{item.name}<ArrowRight size={12} /></Link>)}</div></div>}

      <div className="catalog-toolbar"><div className="catalog-result-count"><span className="eyebrow">THE EDIT</span><strong>{filtered.length} products</strong></div><div className="catalog-toolbar-controls"><button className={`filter-toggle ${filtersOpen ? "is-active" : ""}`} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={15} />Filters{activeCount > 0 && <span>{activeCount}</span>}</button><label className="sort-select"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="newest">New arrivals</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="discount">Biggest saving</option><option value="name">Name, A–Z</option></select><ChevronDown size={14} /></label></div></div>

      <div className={`catalog-layout ${filtersOpen ? "catalog-layout-filter-open" : ""}`}>
        <aside className={`filter-panel ${filtersOpen ? "filter-panel-open" : ""}`}>
          <div className="filter-panel-heading"><strong>Refine the edit</strong><button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={16} /></button></div>
          <label className="filter-search"><span>SEARCH PRODUCTS</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Brand, model, category" /></label>
          <fieldset><legend>Category</legend><label><input type="radio" name="catalog-category" checked={activeCategory === "all"} onChange={() => setActiveCategory("all")} /><span>All categories</span><small>{products.length}</small></label>{categories.map((item) => <label key={item.slug}><input type="radio" name="catalog-category" checked={activeCategory === item.slug} onChange={() => setActiveCategory(item.slug)} /><span>{item.name}</span><small>{products.filter((product) => product.category === item.slug).length}</small></label>)}</fieldset>
          <fieldset><legend>Brand</legend><select className="filter-select" value={brand} onChange={(event) => setBrand(event.target.value)}><option value="all">All brands</option>{brands.map((item) => <option value={item} key={item}>{item}</option>)}</select></fieldset>
          <fieldset><legend>Price range</legend><div className="price-range-inputs"><label><small>FROM</small><input inputMode="numeric" type="number" min="0" value={minPrice || ""} placeholder="0" onChange={(event) => setMinPrice(Math.max(0, Number(event.target.value) || 0))} /></label><span>—</span><label><small>TO</small><input inputMode="numeric" type="number" min="0" value={maxPrice || ""} placeholder={maxAvailable.toString()} onChange={(event) => setMaxPrice(Math.max(0, Number(event.target.value) || 0))} /></label></div><div className="price-range-label"><span>{formatMoney(minPrice, filterCurrency)}</span><span>{formatMoney(maxPrice || maxAvailable, filterCurrency)}</span></div></fieldset>
          <label className="filter-checkbox"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} /><span>Show in-stock only</span></label>
          <button className="filter-clear" onClick={clearFilters}>Clear all filters</button>
        </aside>
        <div className="catalog-results-area">
          {filtered.length > 0 ? <>
            <div className="product-grid product-grid-catalog">{filtered.slice(0, pageSize).map((product, index) => <ProductCard key={product.id} product={product} onQuickView={onQuickView} index={index % 4} />)}</div>
            {filtered.length > pageSize && <div className="load-more-row"><span>Showing {Math.min(pageSize, filtered.length)} of {filtered.length} pieces</span><button className="button button-outline" onClick={() => setPageSize((size) => size + 20)}>Load more <ArrowRight size={14} /></button></div>}
          </> : <div className="catalog-empty"><div><Filter size={22} /></div><span className="eyebrow">NO MATCHES THIS TIME</span><h2>Let’s try a different angle.</h2><p>Clear a filter or search for another brand, model or category.</p><button className="button button-primary" onClick={clearFilters}>Clear filters <ArrowRight size={15} /></button></div>}
        </div>
      </div>
    </div>
  );
}
