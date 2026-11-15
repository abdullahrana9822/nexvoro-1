"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  X,
  GitCompare,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import { makeId, salePercent } from "@/lib/utils";
import type { Product, ThemeId } from "@/lib/types";
import ProductMedia from "@/components/ProductMedia";
import { ProductCard, SectionHeading } from "@/components/StorePrimitives";

export function ProductQuickView({ product, onClose }: { product: Product; onClose: () => void }) {
  const { addToCart, formatPrice } = useStore();
  const [variant, setVariant] = useState(product.variants[0] || "");
  const [quantity, setQuantity] = useState(1);
  const percent = salePercent(product);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="quick-view-modal" role="dialog" aria-modal="true" aria-label={`Quick view: ${product.name}`}>
        <button className="modal-close" onClick={onClose} aria-label="Close quick view"><X size={20} /></button>
        <div className="quick-view-image"><ProductMedia product={product} /></div>
        <div className="quick-view-content"><span className="eyebrow">{product.brand} / QUICK LOOK</span><h2>{product.name}</h2><p>{product.description}</p><div className="quick-view-price"><strong>{formatPrice(product.price)}</strong>{product.compareAt > product.price && <del>{formatPrice(product.compareAt)}</del>}{percent > 0 && <span>{percent}% OFF</span>}</div>
          {product.variants.length > 0 && <label className="variant-select-label">Choose a finish or configuration<select value={variant} onChange={(event) => setVariant(event.target.value)}>{product.variants.map((item) => <option key={item}>{item}</option>)}</select></label>}
          <div className="quick-view-actions"><div className="quantity-picker quick-view-quantity"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus size={13} /></button><span>{quantity}</span><button type="button" aria-label="Increase quantity" disabled={quantity >= Math.min(10, product.stock)} onClick={() => setQuantity((current) => Math.min(Math.min(10, product.stock), current + 1))}><Plus size={13} /></button></div><button className="button button-primary" onClick={() => { addToCart(product.id, quantity, variant); onClose(); }} disabled={product.stock < 1}><ShoppingBag size={15} />Add to bag</button><Link className="button button-outline" href={`/product/${product.slug}`} onClick={onClose}>Full details <ArrowRight size={14} /></Link></div>
          <small className="stock-line">{product.stock > 0 ? `${product.stock} in stock · Ships with care` : "Currently sold out"}</small>
        </div>
      </section>
    </div>
  );
}

export function ProductDetailPage({ slug, onQuickView }: { slug: string; onQuickView: (product: Product) => void }) {
  const { products, categories, addToCart, toggleWishlist, wishlist, toggleCompare, compare, recordView, settings, reviews, notify, saveReview, commerceConfigured, formatPrice } = useStore();
  const product = products.find((item) => item.slug === slug || item.id === slug);
  const [imageIndex, setImageIndex] = useState(0);
  const [variant, setVariant] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reviewName, setReviewName] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSent, setReviewSent] = useState(false);

  useEffect(() => { if (product) recordView(product.id); }, [product, recordView]);
  useEffect(() => { setVariant(product?.variants[0] || ""); setImageIndex(0); }, [product?.id, product?.variants]);
  const approvedReviews = useMemo(() => reviews.filter((review) => review.productId === product?.id && review.approved), [reviews, product?.id]);
  if (!product) return <div className="not-found-page"><span className="eyebrow">NOT FOUND IN THIS EDIT</span><h1>That piece seems to have moved.</h1><p>Try the collection again — there’s plenty more to discover.</p><Link className="button button-primary" href="/shop">Explore the shop <ArrowRight size={15} /></Link></div>;
  const category = categories.find((item) => item.slug === product.category);
  const gallery = product.images.length ? product.images : [];
  const activeProduct = gallery[imageIndex] ? { ...product, images: [gallery[imageIndex]] } : product;
  const isWished = wishlist.includes(product.id);
  const isCompared = compare.includes(product.id);
  const percent = salePercent(product);
  const averageRating = approvedReviews.length
    ? approvedReviews.reduce((sum, review) => sum + review.rating, 0) / approvedReviews.length
    : null;
  const allReviews = approvedReviews;
  const related = product.relatedIds.map((id) => products.find((item) => item.id === id)).filter((item): item is Product => Boolean(item)).slice(0, 4);
  const add = () => addToCart(product.id, quantity, variant);

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await saveReview({
      id: makeId("review"), productId: product.id, name: reviewName.trim(), rating: reviewRating,
      title: reviewTitle.trim(), body: reviewBody.trim(), createdAt: new Date().toISOString(), approved: false,
    });
    if (ok) { setReviewSent(true); setReviewName(""); setReviewTitle(""); setReviewBody(""); }
  };

  return (
    <div className="product-detail-page">
      <div className="breadcrumbs product-breadcrumbs"><Link href="/">Home</Link><ChevronRight size={13} /><Link href="/shop">Shop</Link><ChevronRight size={13} />{category && <><Link href={`/category/${category.slug}`}>{category.name}</Link><ChevronRight size={13} /></>}<span>{product.name}</span></div>
      <div className="product-detail-grid">
        <div className="product-gallery"><div className="product-gallery-main"><ProductMedia product={activeProduct} priority /><span className="gallery-count">{gallery.length > 1 ? `${String(imageIndex + 1).padStart(2, "0")} / ${String(gallery.length).padStart(2, "0")}` : "N / 01"}</span>{product.newArrival && <span className="gallery-label">NEW ARRIVAL</span>}</div>
          {gallery.length > 1 && <div className="product-thumbnails">{gallery.map((src, index) => <button key={src} className={index === imageIndex ? "thumbnail-active" : ""} onClick={() => setImageIndex(index)} aria-label={`View product image ${index + 1}`}><ProductMedia product={{ ...product, images: [src] }} /></button>)}</div>}
          <div className="gallery-annotation"><span>THE DETAILS MATTER</span><span>CURATED BY NEXVORO</span></div>
        </div>
        <div className="product-detail-info"><span className="eyebrow">{product.brand} / {category?.name || "THE EDIT"}</span><h1>{product.name}</h1><p className="product-description">{product.description}</p>
          <div className="detail-rating-row">{averageRating ? <><span className="rating-stars"><Star size={15} fill="currentColor" />{averageRating.toFixed(1)}</span><a href="#product-reviews">{approvedReviews.length} customer {approvedReviews.length === 1 ? "review" : "reviews"}</a></> : <span className="no-rating-note">No customer ratings yet — we don’t invent them.</span>}</div>
          <div className="detail-price-row"><strong>{formatPrice(product.price)}</strong>{product.compareAt > product.price && <del>{formatPrice(product.compareAt)}</del>}{percent > 0 && <span className="detail-discount">YOU SAVE {percent}%</span>}</div>
          <div className="sku-line">SKU <span>{product.sku}</span></div>
          {product.variants.length > 0 && <fieldset className="variant-picker"><legend>Finish &amp; configuration</legend><div className="variant-options">{product.variants.map((option) => <button type="button" key={option} className={variant === option ? "variant-selected" : ""} onClick={() => setVariant(option)}>{option}{variant === option && <Check size={12} />}</button>)}</div></fieldset>}
          <div className="detail-purchase-row"><div className="quantity-picker"><button aria-label="Reduce quantity" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus size={13} /></button><span>{quantity}</span><button aria-label="Add quantity" disabled={quantity >= Math.min(10, product.stock)} onClick={() => setQuantity((current) => Math.min(Math.min(10, product.stock), current + 1))}><Plus size={13} /></button></div><button className="button button-primary add-to-bag-button" onClick={add} disabled={product.stock < 1}><ShoppingBag size={16} />{product.stock > 0 ? "Add to bag" : "Sold out"}</button></div>
          <div className="product-secondary-actions"><button className={isWished ? "secondary-action-active" : ""} onClick={() => { toggleWishlist(product.id); notify(isWished ? "Removed from your wishlist." : "Saved to your wishlist.", "info"); }}><Heart size={15} fill={isWished ? "currentColor" : "none"} />{isWished ? "Saved to wishlist" : "Save to wishlist"}</button><button className={isCompared ? "secondary-action-active" : ""} onClick={() => toggleCompare(product.id)}><GitCompare size={15} />{isCompared ? "In compare" : "Compare this piece"}</button></div>
          <div className="product-promises"><div><Truck size={17} /><span><strong>Delivery, thoughtfully handled</strong><small>{commerceConfigured ? settings.freeShippingThreshold > 0 ? product.price >= settings.freeShippingThreshold ? "Complimentary delivery on this order" : `Delivery from ${formatPrice(settings.shippingFee)} · free over ${formatPrice(settings.freeShippingThreshold)}` : "Complimentary delivery on every order" : "Delivery pricing is not configured yet."}</small></span></div><div><ShieldCheck size={17} /><span><strong>Cash on delivery available</strong><small>Pay when your order arrives. Online card payments are not connected.</small></span></div><div><RotateCcw size={17} /><span><strong>Need a hand?</strong><small><Link href="/shipping-returns">See shipping &amp; returns</Link> or <Link href="/contact">talk to our team</Link>.</small></span></div></div>
          <div className="product-detail-accordion"><details open><summary>Product details <Plus size={14} /></summary><p>{product.description}</p></details><details><summary>Specifications <Plus size={14} /></summary><dl>{Object.entries(product.specs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details><details><summary>Shipping &amp; returns <Plus size={14} /></summary><p>Delivery fees are calculated at checkout. Current shipping and return terms are available on our <Link href="/shipping-returns">shipping &amp; returns page</Link>.</p></details></div>
        </div>
      </div>

      <section className="product-reviews-section" id="product-reviews"><div className="product-reviews-heading"><div><span className="eyebrow">REAL WORDS, REAL PEOPLE</span><h2>What it’s like,<br /><em>from here.</em></h2></div><div className="review-score-panel">{averageRating ? <><strong>{averageRating.toFixed(1)}</strong><span>out of 5</span><div className="rating-stars">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} fill={averageRating >= i + 1 ? "currentColor" : "none"} />)}</div></> : <><strong>—</strong><span>No reviews yet</span></>}</div></div>
        <div className="product-reviews-content"><div className="review-list">{allReviews.length ? allReviews.map((review) => <article className="review-card review-card-detail" key={review.id}><div className="review-stars">{Array.from({ length: 5 }).map((_, i) => <Star size={12} key={i} fill={i < review.rating ? "currentColor" : "none"} />)}</div><h3>{review.title}</h3><p>“{review.body}”</p><span>{review.name} · {new Date(review.createdAt).toLocaleDateString()}</span></article>) : <div className="no-reviews-note"><Star size={20} /><strong>No reviews yet.</strong><p>We’ll publish reviews after moderation. If you’ve tried this piece, share your honest take.</p></div>}</div>
          <form className="review-form" onSubmit={submitReview}><span className="eyebrow">LEAVE THE FIRST NOTE</span><h3>Share an honest review.</h3>{reviewSent ? <div className="form-success"><Check size={17} />Thanks — your review has been received and is awaiting moderation.</div> : <><label>Your name<input required maxLength={100} value={reviewName} onChange={(event) => setReviewName(event.target.value)} placeholder="How should we credit you?" /></label><label>Review title<input required maxLength={120} value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} placeholder="A few words about it" /></label><label>Your review<textarea required minLength={10} maxLength={1200} rows={4} value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} placeholder="Tell future customers what you genuinely think…" /></label><label className="review-rating-input">Your rating <span>{[1,2,3,4,5].map((rating) => <button type="button" key={rating} aria-label={`${rating} star${rating === 1 ? "" : "s"}`} onClick={() => setReviewRating(rating)}><Star size={17} fill={rating <= reviewRating ? "currentColor" : "none"} /></button>)}</span></label><button className="button button-primary" type="submit">Submit for review <ArrowRight size={14} /></button></>}</form>
        </div>
      </section>

      {related.length > 0 && <section className="home-section related-products-section"><SectionHeading eyebrow="GOOD COMPANY" title="Pairs well with." action="See the full collection" href={`/category/${product.category}`} /><div className="product-grid product-grid-home">{related.map((item, index) => <ProductCard key={item.id} product={item} onQuickView={onQuickView} index={index} />)}</div></section>}
    </div>
  );
}

export function ThemeStudioPage() {
  const { theme, setTheme, settings, notify } = useStore();
  const [preview, setPreview] = useState<ThemeId>(theme);
  const activeTheme = theme;
  const current = THEMES.find((item) => item.id === preview) || THEMES[0];
  const selectPreview = (id: ThemeId) => { setPreview(id); document.documentElement.dataset.theme = id; };
  const apply = () => {
    if (!settings.allowThemeSwitch) { notify("Theme switching is currently turned off by the store.", "info"); return; }
    setTheme(preview);
    notify(`${current.name} is now your NEXVORO experience.`);
  };
  const reset = () => { setPreview(activeTheme); document.documentElement.dataset.theme = activeTheme; };
  return (
    <div className="theme-studio-page">
      <div className="theme-studio-hero"><span className="eyebrow">YOUR STORE, YOUR POINT OF VIEW</span><h1>Choose a mood.<br /><em>Find your NEXVORO.</em></h1><p>Eight distinct visual worlds. Each one changes the way the whole store feels — from navigation and typography to product cards, layouts and motion.</p><div className="theme-studio-hero-foot"><span><Sparkles size={15} /> 08 FULL STORE EXPERIENCES</span><span>LIVE PREVIEW · SAVED TO THIS DEVICE</span></div></div>
      <div className="theme-studio-toolbar"><div><span className="eyebrow">THE THEME AT A GLANCE</span><strong>Previewing: {current.name}</strong><small>{current.mood}</small></div><div><button className="button button-outline" onClick={reset}>Reset preview</button><button className="button button-primary" disabled={!settings.allowThemeSwitch} onClick={apply}>Apply this theme <ArrowRight size={15} /></button></div></div>
      {!settings.allowThemeSwitch && <div className="theme-lock-note"><ShieldCheck size={16} />Customer theme switching is currently disabled by the store. You can still preview the eight experiences.</div>}
      <div className="theme-cards-grid">{THEMES.map((item, index) => <article className={`theme-option-card ${preview === item.id ? "theme-option-selected" : ""}`} key={item.id}>
        <button className={`theme-option-preview theme-preview-${item.id}`} data-theme-preview={item.id} onClick={() => selectPreview(item.id)} aria-label={`Preview ${item.name}`}>
          <div className="preview-mini-header"><i /><span>NEXVORO</span><b>⌕　♡　▢</b></div>
          <div className="preview-mini-content"><small>{String(index + 1).padStart(2,"0")} / NEXVORO EDIT</small><strong>{item.id === "gaming-universe" ? "PLAY THE" : item.id === "creative-colorful" ? "MAKE IT" : "LIVE A LITTLE"}<br /><em>{item.id === "gaming-universe" ? "FUTURE" : item.id === "creative-colorful" ? "BRIGHTER" : "BETTER"}</em></strong><span className="preview-mini-cta">EXPLORE THE EDIT ↗</span></div>
          <div className="preview-mini-products"><i /><i /><i /></div><span className="theme-preview-zoom">CLICK TO PREVIEW <ArrowRight size={11} /></span>
        </button>
        <div className="theme-option-copy"><div><span className="theme-number">0{index + 1}</span><h2>{item.name}</h2>{preview === item.id && <span className="theme-selected-dot"><Check size={11} /></span>}</div><p>{item.descriptor}</p><span className="theme-mood">{item.mood}</span><button className={`theme-preview-action ${preview === item.id ? "theme-preview-action-active" : ""}`} onClick={() => selectPreview(item.id)}>{preview === item.id ? "Previewing now" : "Live preview"}<ArrowRight size={13} /></button></div>
      </article>)}</div>
      <div className="theme-studio-bottom"><span>Selected theme: <strong>{THEMES.find((item) => item.id === activeTheme)?.name}</strong></span><button className="button button-primary" disabled={!settings.allowThemeSwitch} onClick={apply}>Apply {current.name} <ArrowRight size={15} /></button></div>
    </div>
  );
}
