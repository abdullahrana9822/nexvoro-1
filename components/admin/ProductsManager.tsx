"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { ArrowRight, Edit3, ImagePlus, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatMoney, makeId } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { COLLECTIONS, DISCOVERY } from "@/lib/storefront-edits";
import ProductMedia from "@/components/ProductMedia";

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const blankProduct = (): Product => ({
  id: "", slug: "", sku: "", name: "", brand: "NEXVORO", category: "smartphones", price: 0, compareAt: 0,
  description: "", specs: { Highlights: "" }, stock: 0, variants: [], images: [], featured: false,
  bestseller: false, newArrival: true, rating: null, reviewCount: 0, relatedIds: [], tags: [],
});

export default function ProductsManager() {
  const { products, categories, settings, archiveProduct, saveProduct, notify, databaseStatus, adminAuthenticated } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const filtered = useMemo(() => products.filter((product) => {
    const matches = `${product.name} ${product.brand} ${product.sku}`.toLowerCase().includes(query.trim().toLowerCase());
    const byCategory = category === "all" || product.category === category;
    const byStock = stockFilter === "all" || (stockFilter === "low" ? product.stock > 0 && product.stock <= 8 : stockFilter === "out" ? product.stock === 0 : product.stock > 0);
    return matches && byCategory && byStock;
  }), [products, query, category, stockFilter]);
  const lowStock = products.filter((product) => product.stock > 0 && product.stock <= 8).length;
  const outOfStock = products.filter((product) => product.stock === 0).length;
  const openNew = () => { setEditing(blankProduct()); setShowEditor(true); };
  const edit = (product: Product) => { setEditing(product); setShowEditor(true); };
  const remove = async (product: Product) => {
    const confirmed = window.confirm(`Archive “${product.name}”? It will disappear from the storefront. Existing order items remain in order history.`);
    if (!confirmed) return;
    const ok = await archiveProduct(product.id);
    if (ok) notify("Product archived. Order history has been preserved.");
  };
  const submit = async (product: Product) => {
    if (product.stock < 0 || product.price < 0 || product.compareAt < product.price) return false;
    const ok = await saveProduct(product);
    if (ok) { notify(editing?.id ? "Product changes saved." : "Product added to the catalog."); setShowEditor(false); setEditing(null); }
    return ok;
  };
  return <div className="admin-management-page">
    <div className="admin-stat-strip"><div><span>ACTIVE PRODUCTS</span><strong>{products.length}</strong></div><div><span>CATEGORIES</span><strong>{categories.length}</strong></div><div><span>LOW STOCK</span><strong className={lowStock ? "stat-warning" : ""}>{lowStock}</strong></div><div><span>OUT OF STOCK</span><strong>{outOfStock}</strong></div></div>
    <div className="management-toolbar"><div className="management-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, brands or SKU" /></div><div className="management-toolbar-actions"><label className="management-select"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label><label className="management-select"><span>Stock</span><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">Any stock level</option><option value="low">Low stock (1–8)</option><option value="out">Out of stock</option><option value="in">In stock</option></select></label><button className="admin-button admin-button-primary" onClick={openNew}><Plus size={15} />Add product</button></div></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>SKU / CATEGORY</th><th>PRICE</th><th>INVENTORY</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><div className="admin-product-cell"><div className="admin-product-thumb"><ProductMedia product={product} /></div><div><strong>{product.name}</strong><small>{product.brand}</small></div></div></td><td><strong className="sku-cell">{product.sku}</strong><small className="table-subline">{categories.find((item) => item.slug === product.category)?.name || product.category}</small></td><td><strong>{formatMoney(product.price, settings.currency)}</strong>{product.compareAt > product.price && <small className="table-subline">Was {formatMoney(product.compareAt, settings.currency)}</small>}</td><td><span className={`stock-indicator ${product.stock === 0 ? "stock-out" : product.stock <= 8 ? "stock-low" : "stock-good"}`}><i />{product.stock === 0 ? "Out of stock" : `${product.stock} available`}</span></td><td><span className="product-status-tags">{product.featured && <i>Featured</i>}{product.bestseller && <i>Bestseller</i>}{product.newArrival && <i>New</i>}{!product.featured && !product.bestseller && !product.newArrival && <i>Active</i>}</span></td><td><div className="admin-row-actions"><button aria-label={`Edit ${product.name}`} title="Edit product" onClick={() => edit(product)}><Edit3 size={15} /></button><button aria-label={`Archive ${product.name}`} title="Archive product" onClick={() => remove(product)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="admin-table-empty"><Search size={19} /><strong>No products match these filters.</strong><button onClick={() => { setQuery(""); setCategory("all"); setStockFilter("all"); }}>Clear filters</button></div>}</div>
    <div className="admin-table-foot"><span>Showing {filtered.length} of {products.length} active products</span><span>Product deletion is archival only — order snapshots are retained.</span></div>
    {showEditor && editing && <ProductEditor key={editing.id || "new-product"} product={editing} categories={categories} settingsCurrency={settings.currency} databaseConnected={databaseStatus === "connected"} adminAuthenticated={adminAuthenticated} onClose={() => { setShowEditor(false); setEditing(null); }} onSave={submit} />}
  </div>;
}

function ProductEditor({ product, categories, settingsCurrency, databaseConnected, adminAuthenticated, onClose, onSave }: {
  product: Product; categories: { slug: string; name: string }[]; settingsCurrency: string; databaseConnected: boolean; adminAuthenticated: boolean;
  onClose: () => void; onSave: (product: Product) => Promise<boolean>;
}) {
  const { notify } = useStore();
  const [form, setForm] = useState({
    name: product.name, brand: product.brand, category: product.category || categories[0]?.slug || "smartphones",
    sku: product.sku, price: product.price ? String(product.price) : "", compareAt: product.compareAt ? String(product.compareAt) : "",
    stock: String(product.stock), description: product.description, specs: Object.entries(product.specs || {}).map(([key, value]) => `${key}: ${value}`).join("\n"),
    variants: product.variants.join(", "), images: product.images, tags: product.tags,
    featured: product.featured, bestseller: product.bestseller, newArrival: product.newArrival,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const set = (key: string, value: string | boolean | string[]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTag = (tag: string, checked: boolean) => set("tags", checked ? Array.from(new Set([...form.tags, tag])) : form.tags.filter((item) => item !== tag));

  const localImage = async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This image could not be prepared.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size > 1_200_000) throw new Error("This image is still too large after compression.");
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image could not be read.")); reader.onerror = () => reject(new Error("Image could not be read.")); reader.readAsDataURL(blob);
    });
  };

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setUploading(true); setUploadError("");
    const uploaded: string[] = [];
    try {
      for (const file of files.slice(0, 5)) {
        if (databaseConnected) {
          if (!adminAuthenticated) throw new Error("Sign in to the protected admin before uploading a shared image.");
          const data = new FormData(); data.append("file", file); data.append("folder", `products/${product.id || "new"}`);
          const response = await fetch("/api/admin/upload", { method: "POST", body: data });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Image upload failed.");
          uploaded.push(result.url as string);
        } else uploaded.push(await localImage(file));
      }
      setForm((current) => ({ ...current, images: [...current.images, ...uploaded].slice(0, 12) }));
      notify(databaseConnected ? `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded to the store.` : `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} added to this browser preview.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image upload failed.";
      setUploadError(message); notify(message, "error");
    } finally { setUploading(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true);
    const slug = slugify(form.name);
    const price = Number(form.price);
    const compareAt = Number(form.compareAt || form.price);
    const stock = Number(form.stock);
    const specs = Object.fromEntries(form.specs.split("\n").map((line) => {
      const pivot = line.indexOf(":"); return pivot < 0 ? ["Highlights", line.trim()] : [line.slice(0, pivot).trim(), line.slice(pivot + 1).trim()];
    }).filter(([key, value]) => Boolean(key) && Boolean(value)) as [string, string][]);
    const next: Product = {
      ...product,
      id: product.id || slug || makeId("product"), slug,
      sku: form.sku.trim() || `NV-${slug.slice(0, 8).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      name: form.name.trim(), brand: form.brand.trim(), category: form.category,
      price, compareAt: Math.max(price, compareAt), stock,
      description: form.description.trim(), specs: { ...specs, Brand: form.brand.trim() },
      variants: form.variants.split(",").map((item) => item.trim()).filter(Boolean), images: form.images, tags: form.tags,
      featured: form.featured, bestseller: form.bestseller, newArrival: form.newArrival,
    };
    if (!next.images.length) { setBusy(false); setUploadError("Add at least one product image or upload an image file."); return; }
    if (next.price < 0 || next.stock < 0 || !next.name || !next.brand || !next.sku) { setBusy(false); setUploadError("Check the product name, brand, price, SKU and stock."); return; }
    await onSave(next); setBusy(false);
  };

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-editor-modal" role="dialog" aria-modal="true" aria-label={product.id ? "Edit product" : "Add product"}>
    <div className="admin-modal-heading"><div><span className="eyebrow">CATALOG / {product.id ? "EDIT" : "NEW PRODUCT"}</span><h2>{product.id ? "Edit this piece." : "Add a new piece."}</h2></div><button onClick={onClose} aria-label="Close editor"><X size={19} /></button></div>
    <form className="admin-product-form" onSubmit={submit}><div className="admin-form-grid"><label>Product name<input required minLength={2} maxLength={180} value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Arc wireless headphones" /></label><label>Brand<input required value={form.brand} onChange={(event) => set("brand", event.target.value)} placeholder="Brand" /></label><label>Category<select value={form.category} onChange={(event) => set("category", event.target.value)}>{categories.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label><label>SKU<input value={form.sku} onChange={(event) => set("sku", event.target.value)} placeholder="Auto-generated if left blank" /></label><label>Sale price ({settingsCurrency})<input type="number" min="0" step="1" required value={form.price} onChange={(event) => set("price", event.target.value)} placeholder="0" /></label><label>Original price ({settingsCurrency})<input type="number" min="0" step="1" value={form.compareAt} onChange={(event) => set("compareAt", event.target.value)} placeholder="Optional" /></label><label>Stock quantity<input type="number" min="0" step="1" required value={form.stock} onChange={(event) => set("stock", event.target.value)} /></label><label>Variants<input value={form.variants} onChange={(event) => set("variants", event.target.value)} placeholder="Black, Silver, 256GB" /><small>Separate options with commas.</small></label><label className="admin-form-full">Description<textarea required rows={4} maxLength={4000} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="Describe what makes this product useful…" /></label><label className="admin-form-full">Specifications<textarea rows={4} value={form.specs} onChange={(event) => set("specs", event.target.value)} placeholder="Display: 6.5 inch\nBattery: all-day" /><small>One specification per line in “Label: value” format.</small></label>
      <fieldset className="admin-form-full admin-curation-field"><legend>Homepage collections &amp; discovery</legend><p>Choose the shelves and collections this product belongs in. These memberships use the existing product tags field and persist through the current admin API and database schema.</p><div className="admin-curation-group"><strong>Collections</strong><div className="admin-curation-checklist">{COLLECTIONS.map((collection) => <label key={collection.slug}><input type="checkbox" checked={form.tags.includes(collection.tag)} onChange={(event) => toggleTag(collection.tag, event.target.checked)} /><span>{collection.name}</span></label>)}</div></div><div className="admin-curation-group"><strong>Discovery shelves</strong><div className="admin-curation-checklist admin-curation-checklist-discovery">{DISCOVERY.map((section) => <label key={section.slug}><input type="checkbox" checked={form.tags.includes(section.tag)} onChange={(event) => toggleTag(section.tag, event.target.checked)} /><span>{section.name}</span></label>)}</div></div></fieldset>
      <div className="admin-form-full image-upload-field"><div className="image-field-heading"><span>PRODUCT PHOTOGRAPHY</span><small>{form.images.length} image{form.images.length === 1 ? "" : "s"} · up to 12</small></div><label className="image-upload-drop"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadFiles} /><ImagePlus size={19} /><span><strong>{uploading ? "Preparing images…" : "Add product images"}</strong><small>JPG, PNG or WebP · max 5 MB per image</small></span><b><Upload size={14} />{uploading ? "Working" : "Upload"}</b></label>{databaseConnected ? <small className="image-storage-note">Images upload to the protected NEXVORO Supabase Storage bucket.</small> : <small className="image-storage-note">Preview uploads are compressed and kept only in this browser. Connect Supabase for shared image storage.</small>}{uploadError && <small className="image-upload-error">{uploadError}</small>}{form.images.length > 0 && <div className="image-upload-previews">{form.images.map((image, index) => <div key={`${image.slice(0,60)}-${index}`}><Image src={image} alt={`Product image ${index + 1}`} width={54} height={58} unoptimized /><button type="button" aria-label="Remove image" onClick={() => set("images", form.images.filter((_, i) => i !== index))}><X size={13} /></button></div>)}</div>}<label className="image-urls-label">Or paste secure image URLs<textarea rows={2} value={form.images.filter((image) => !image.startsWith("data:")).join("\n")} onChange={(event) => set("images", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean).concat(form.images.filter((image) => image.startsWith("data:"))))} placeholder="https://…" /><small>Use distinct HTTPS product images. Existing gallery images remain attached.</small></label></div>
      <div className="admin-form-full admin-product-flags"><label><input type="checkbox" checked={form.featured} onChange={(event) => set("featured", event.target.checked)} /><span>Featured on storefront</span></label><label><input type="checkbox" checked={form.bestseller} onChange={(event) => set("bestseller", event.target.checked)} /><span>Mark as bestseller</span></label><label><input type="checkbox" checked={form.newArrival} onChange={(event) => set("newArrival", event.target.checked)} /><span>New arrival</span></label></div></div>
      <div className="admin-editor-footer"><span>Order history retains a snapshot if this product is archived.</span><div><button type="button" className="admin-button admin-button-quiet" onClick={onClose}>Cancel</button><button className="admin-button admin-button-primary" disabled={busy}>{busy ? "Saving…" : product.id ? "Save product" : "Add product"}<ArrowRight size={14} /></button></div></div>
    </form>
  </section></div>;
}
