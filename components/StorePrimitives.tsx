"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  AudioLines,
  BatteryCharging,
  Camera,
  ChevronDown,
  CircleHelp,
  Gamepad2,
  Heart,
  House,
  Laptop,
  Mail,
  Menu,
  Monitor,
  PackageCheck,
  Radio,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Speaker,
  Tablet,
  UserRound,
  Watch,
  X,
  GitCompare,
  Plus,
} from "lucide-react";
import type { Category, Product, ThemeId } from "@/lib/types";
import { useStore } from "@/lib/store";
import { salePercent } from "@/lib/utils";
import ProductMedia from "./ProductMedia";
import CurrencySelector from "./CurrencySelector";

const iconByCategory: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  smartphones: Smartphone, laptops: Laptop, tablets: Tablet, headphones: AudioLines, earbuds: AudioLines,
  "smart-watches": Watch, "gaming-accessories": Gamepad2, "gaming-consoles": Gamepad2, speakers: Speaker,
  cameras: Camera, "smart-home": House, "computer-accessories": Radio, monitors: Monitor,
  "keyboards-mice": Radio, "power-banks-chargers": BatteryCharging,
};

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand-mark ${compact ? "brand-mark-compact" : ""}`} aria-label="NEXVORO home">
      <span className="brand-symbol" aria-hidden="true"><span /><i /><b /></span>
      <span className="brand-lockup"><strong>NEXVORO</strong>{!compact && <small>WHERE INNOVATION MEETS LIFESTYLE</small>}</span>
    </Link>
  );
}

export function SiteHeader({ theme }: { theme: ThemeId }) {
  const { cart, wishlist, compare, categories, settings, databaseStatus, commerceConfigured, formatPrice } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null);
  const searchReturnFocusRef = useRef<HTMLElement | null>(null);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const storeNeedsSetup = databaseStatus === "connected" && !commerceConfigured;
  const announcementCopy = databaseStatus === "checking"
    ? "Checking live store status"
    : databaseStatus === "disconnected"
      ? "Preview only · orders and forms are not live"
      : storeNeedsSetup
        ? "Checkout paused · store setup needed"
        : settings.freeShippingThreshold > 0
          ? `Complimentary delivery over ${formatPrice(settings.freeShippingThreshold)}`
          : "Complimentary delivery on every order";
  const announcementLink = databaseStatus === "disconnected"
    ? { href: "/faq", label: "Store notes" }
    : storeNeedsSetup
      ? { href: "/admin/products", label: "Catalog setup" }
      : { href: "/shipping-returns", label: "Shipping & returns" };

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscapeOrTab = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = document.getElementById("mobile-navigation");
      const focusable = panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeOnDesktop = () => {
      if (window.matchMedia("(min-width: 1280px)").matches) setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscapeOrTab);
    window.addEventListener("resize", closeOnDesktop);
    let focusFrame = 0;
    const focusFirstMenuItem = () => {
      const panel = document.getElementById("mobile-navigation");
      if (!panel || panel.getAttribute("aria-hidden") === "true") return;
      if (getComputedStyle(panel).visibility !== "visible") {
        focusFrame = window.requestAnimationFrame(focusFirstMenuItem);
        return;
      }
      const firstMenuItem = firstMenuLinkRef.current ?? panel.querySelector<HTMLElement>("a[href]");
      firstMenuItem?.focus({ preventScroll: true });
    };
    focusFrame = window.requestAnimationFrame(focusFirstMenuItem);
    const menuButton = menuButtonRef.current;
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscapeOrTab);
      window.removeEventListener("resize", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  const nav = [
    { label: "Shop", href: "/shop" },
    { label: "New arrivals", href: "/new-arrivals" },
    { label: "Best sellers", href: "/best-sellers" },
    { label: "Theme studio", href: "/theme-studio" },
  ];

  return (
    <>
      <div className="announcement-bar">
        <span>THE NEXVORO EDIT</span>
        <span className="announcement-copy" role="status" aria-live="polite">{announcementCopy}</span>
        <Link href={announcementLink.href}>{announcementLink.label} <ArrowRight size={12} /></Link>
      </div>
      <header className={`site-header header-${theme}`}>
        <div className="header-inner">
          <button ref={menuButtonRef} className="icon-button mobile-menu-button" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <BrandMark />
          <nav className={`main-nav ${menuOpen ? "main-nav-open" : ""}`} aria-label="Main navigation">
            <Link href="/shop" onClick={() => setMenuOpen(false)} className="nav-shop-link">Shop <ChevronDown size={13} /></Link>
            <div className="mega-menu">
              <div className="mega-menu-intro">
                <span className="eyebrow">SHOP BY CATEGORY</span>
                <h3>Find your<br />next favorite.</h3>
                <Link href="/shop" className="text-link">Shop everything <ArrowRight size={14} /></Link>
              </div>
              <div className="mega-category-list">
                {categories.slice(0, 12).map((category) => {
                  const Icon = iconByCategory[category.slug] || Sparkles;
                  return <Link href={`/category/${category.slug}`} key={category.slug} onClick={() => setMenuOpen(false)}><Icon size={15} />{category.name}</Link>;
                })}
              </div>
              <div className="mega-menu-note">
                <span>Curated for the curious</span>
                <p>Good design. Useful technology. Nothing you don&apos;t need.</p>
                <Link href="/about">Our point of view <ArrowRight size={14} /></Link>
              </div>
            </div>
            {nav.slice(1).map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
          </nav>
          <div className="header-actions">
            <CurrencySelector variant="header" />
            <button className="icon-button" aria-label="Search products" onClick={(event) => { searchReturnFocusRef.current = event.currentTarget; setMenuOpen(false); setSearchOpen(true); }}><Search size={19} /></button>
            <Link className="icon-button action-account" href="/account" aria-label="Your account"><UserRound size={19} /></Link>
            <Link className="icon-button action-wishlist" href="/wishlist" aria-label="Wishlist"><Heart size={19} />{wishlist.length > 0 && <sup>{wishlist.length}</sup>}</Link>
            <Link className="icon-button action-compare" href="/compare" aria-label="Compare products"><GitCompare size={19} />{compare.length > 0 && <sup>{compare.length}</sup>}</Link>
            <Link className="bag-button" href="/cart" aria-label={`Shopping bag, ${itemCount} items`}>
              <ShoppingBag size={19} /><span>Bag</span><b>{itemCount}</b>
            </Link>
          </div>
        </div>
        <div id="mobile-navigation" className={`mobile-nav-panel ${menuOpen ? "mobile-nav-panel-open" : ""}`} role="region" aria-label="Mobile navigation" aria-hidden={!menuOpen} inert={!menuOpen}>
          <div className="mobile-nav-primary">
            <Link ref={firstMenuLinkRef} href="/shop" onClick={() => setMenuOpen(false)}>Shop all <ArrowRight size={15} /></Link>
            <Link href="/new-arrivals" onClick={() => setMenuOpen(false)}>New arrivals <ArrowRight size={15} /></Link>
            <Link href="/best-sellers" onClick={() => setMenuOpen(false)}>Best sellers <ArrowRight size={15} /></Link>
            <Link href="/offers" onClick={() => setMenuOpen(false)}>Special offers <ArrowRight size={15} /></Link>
            <Link href="/theme-studio" onClick={() => setMenuOpen(false)}>Theme studio <ArrowRight size={15} /></Link>
          </div>
          <div className="mobile-nav-categories">
            {categories.slice(0, 8).map((category) => <Link key={category.slug} href={`/category/${category.slug}`} onClick={() => setMenuOpen(false)}>{category.name}</Link>)}
          </div>
          <CurrencySelector variant="mobile" />
        </div>
      </header>
      {menuOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} returnFocusTarget={searchReturnFocusRef.current} />}
    </>
  );
}

function SearchOverlay({ onClose, returnFocusTarget }: { onClose: () => void; returnFocusTarget: HTMLElement | null }) {
  const { products, categories, formatPrice } = useStore();
  const onCloseRef = useRef(onClose);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(returnFocusTarget);
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const results = trimmed.length > 0
    ? products.filter((item) => `${item.name} ${item.brand} ${item.category}`.toLowerCase().includes(trimmed)).slice(0, 6)
    : products.filter((item) => item.featured).slice(0, 4);
  const matchingCategories = trimmed.length > 0
    ? categories.filter((item) => item.name.toLowerCase().includes(trimmed)).slice(0, 3)
    : [];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusTarget = returnFocusRef.current;
    document.body.style.overflow = "hidden";
    const closeOnEscapeOrTab = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = searchPanelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscapeOrTab);
    const focusFrame = window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscapeOrTab);
      returnFocusTarget?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={searchPanelRef} className="search-panel" role="dialog" aria-modal="true" aria-label="Search the store">
        <div className="search-panel-top">
          <div className="search-input-wrap"><Search size={19} /><input ref={searchInputRef} autoFocus placeholder="Search the considered edit…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></div>
          <button className="icon-button" aria-label="Close search" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="search-panel-content">
          <span className="eyebrow">{trimmed ? `SUGGESTIONS FOR “${query}”` : "POPULAR RIGHT NOW"}</span>
          <div className="search-results">
            {results.map((product) => <Link href={`/product/${product.slug}`} key={product.id} className="search-result" onClick={onClose}>
              <div className="search-result-image"><ProductMedia product={product} /></div>
              <span><small>{product.brand}</small><strong>{product.name}</strong></span>
              <b>{formatPrice(product.price)}</b>
            </Link>)}
            {results.length === 0 && <p className="search-empty">No products match yet. Try a brand, category or model.</p>}
          </div>
          {matchingCategories.length > 0 && <div className="search-category-links">{matchingCategories.map((item) => <Link key={item.slug} href={`/category/${item.slug}`} onClick={onClose}>{item.name}<ArrowRight size={13} /></Link>)}</div>}
          <Link href={`/shop${query ? `?q=${encodeURIComponent(query)}` : ""}`} className="search-all-link" onClick={onClose}>View all results <ArrowRight size={14} /></Link>
        </div>
      </section>
    </div>
  );
}

export function SiteFooter({ theme }: { theme: ThemeId }) {
  const { categories, settings, notify } = useStore();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const subscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: address, consent: true, company: "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Subscription could not be saved.");
      if (data.persisted !== true) throw new Error("Your signup was not saved. Please try again when the store is available.");
      setSubscribed(true);
      setEmail("");
      notify("You’re on the list. Watch your inbox.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Subscription could not be saved.", "error");
    }
  };

  return (
    <footer className={`site-footer footer-${theme}`}>
      <div className="footer-newsletter">
        <div><span className="eyebrow">THE NEXVORO LETTER</span><h2>A little more<br /><em>signal.</em></h2><p>New finds, considered ideas and the occasional good offer. No noise.</p></div>
        <form onSubmit={subscribe} className="newsletter-form">
          <label htmlFor="newsletter-email">Your email address</label>
          <div className="newsletter-input-row"><input id="newsletter-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><button type="submit">{subscribed ? "You’re in" : "Join the list"}<ArrowRight size={15} /></button></div>
          <small>By subscribing, you agree to receive NEXVORO updates. Unsubscribe whenever you like.</small>
        </form>
      </div>
      <div className="footer-main">
        <div className="footer-brand-column"><BrandMark /><p>{settings.tagline}. Technology chosen with intention, for the way you actually live.</p><div className="footer-socials">{settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram">ig</a>}{settings.facebookUrl && <a href={settings.facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook">f</a>}{settings.xUrl && <a href={settings.xUrl} target="_blank" rel="noreferrer" aria-label="X">x</a>}</div></div>
        <div className="footer-link-group"><span>DISCOVER</span><Link href="/shop">Shop all</Link><Link href="/new-arrivals">New arrivals</Link><Link href="/best-sellers">Best sellers</Link><Link href="/offers">Special offers</Link><Link href="/theme-studio">Theme studio</Link></div>
        <div className="footer-link-group"><span>EXPLORE</span>{categories.slice(0, 5).map((category) => <Link key={category.slug} href={`/category/${category.slug}`}>{category.name}</Link>)}<Link href="/about">Our story</Link></div>
        <div className="footer-link-group"><span>HERE TO HELP</span><Link href="/contact">Contact</Link><Link href="/faq">FAQs</Link><Link href="/shipping-returns">Shipping &amp; returns</Link><Link href="/order-tracking">Track an order</Link><Link href="/account">My account</Link></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} NEXVORO. Thoughtfully selected.</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/shipping-returns">Shipping</Link><Link href="/admin">Store admin</Link></div><CurrencySelector variant="footer" /></div>
    </footer>
  );
}

export function SectionHeading({ eyebrow, title, action, href = "/shop", light = false }: { eyebrow: string; title: string; action?: string; href?: string; light?: boolean }) {
  return <div className={`section-heading ${light ? "section-heading-light" : ""}`}><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action && <Link href={href} className="text-link">{action}<ArrowRight size={15} /></Link>}</div>;
}

export function ProductCard({ product, onQuickView, compact = false, index = 0 }: { product: Product; onQuickView?: (product: Product) => void; compact?: boolean; index?: number }) {
  const { wishlist, compare, reviews, toggleWishlist, toggleCompare, addToCart, formatPrice, notify } = useStore();
  const publishedReviews = reviews.filter((review) => review.productId === product.id && review.approved);
  const averageRating = publishedReviews.length ? publishedReviews.reduce((sum, review) => sum + review.rating, 0) / publishedReviews.length : null;
  const discount = salePercent(product);
  const wished = wishlist.includes(product.id);
  const compared = compare.includes(product.id);
  const add = () => {
    if (product.stock <= 0) { notify("This item is currently out of stock.", "error"); return; }
    addToCart(product.id, 1, product.variants[0]);
  };
  return (
    <article className={`product-card ${compact ? "product-card-compact" : ""}`} style={{ "--card-index": index } as React.CSSProperties}>
      <div className="product-card-visual">
        <Link className="product-card-image-link" href={`/product/${product.slug}`} aria-label={`View ${product.name}`}><ProductMedia product={product} /></Link>
        <div className="product-badges">{product.newArrival && <span className="badge badge-new">JUST IN</span>}{product.bestseller && !product.newArrival && <span className="badge badge-best">BESTSELLER</span>}{discount > 0 && <span className="badge badge-sale">−{discount}%</span>}</div>
        <div className="product-quick-actions">
          <button className={`round-action ${wished ? "is-active" : ""}`} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} title="Wishlist" onClick={() => { toggleWishlist(product.id); notify(wished ? "Removed from your wishlist." : "Saved to your wishlist.", "info"); }}><Heart size={16} fill={wished ? "currentColor" : "none"} /></button>
          <button className={`round-action ${compared ? "is-active" : ""}`} aria-label={compared ? "Remove from compare" : "Add to compare"} title="Compare" onClick={() => toggleCompare(product.id)}><GitCompare size={15} /></button>
          {onQuickView && <button className="round-action quick-view-button" aria-label="Quick view" title="Quick view" onClick={() => onQuickView(product)}><Plus size={17} /></button>}
        </div>
        <button className="quick-add-button" onClick={add} disabled={product.stock <= 0}>{product.stock > 0 ? "Quick add" : "Sold out"}<ShoppingBag size={14} /></button>
      </div>
      <div className="product-card-info">
        <div className="product-card-brand-line"><span>{product.brand}</span><span>{product.stock > 0 ? "IN STOCK" : "SOLD OUT"}</span></div>
        <Link href={`/product/${product.slug}`} className="product-card-title">{product.name}</Link>
        <div className="product-card-spec">{product.specs.Highlights?.split(" · ").slice(0, 2).join(" · ") || product.category}</div>
        <div className="product-card-bottom"><div className="product-price"><strong>{formatPrice(product.price)}</strong>{product.compareAt > product.price && <del>{formatPrice(product.compareAt)}</del>}</div><span className="review-count">{averageRating !== null ? `★ ${averageRating.toFixed(1)} (${publishedReviews.length})` : "No reviews yet"}</span></div>
      </div>
    </article>
  );
}

export function CategoryTile({ category, product }: { category: Category; product?: Product }) {
  const Icon = iconByCategory[category.slug] || Sparkles;
  return (
    <Link href={`/category/${category.slug}`} className={`category-tile category-tile-${category.slug}`}>
      <div className="category-tile-media">
        {product ? <ProductMedia product={product} /> : <div className="category-symbol"><Icon size={32} strokeWidth={1.1} /></div>}
        <span className="category-tile-overlay" />
        <span className="category-tile-icon"><Icon size={16} /></span>
      </div>
      <div className="category-tile-text"><div><small>{category.eyebrow || "THE EDIT"}</small><strong>{category.name}</strong></div><span className="category-arrow"><ArrowRight size={15} /></span></div>
    </Link>
  );
}

export function ToastStack() {
  const { toasts } = useStore();
  if (!toasts.length) return null;
  return <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`toast toast-${toast.kind}`} key={toast.id}><span className="toast-dot" />{toast.message}</div>)}</div>;
}

export function PolicyLinkRow() {
  return <div className="policy-link-row"><Link href="/shipping-returns"><PackageCheck size={15} />Delivery details</Link><Link href="/faq"><CircleHelp size={15} />Need a hand?</Link><Link href="/contact"><Mail size={15} />Talk to us</Link><Link href="/privacy"><ShieldCheck size={15} />Privacy first</Link></div>;
}
