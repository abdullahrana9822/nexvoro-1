"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { getCollection, getDiscoverySection } from "@/lib/storefront-edits";
import { SiteFooter, SiteHeader, ToastStack } from "@/components/StorePrimitives";
import HomePage from "@/components/pages/Home";
import CatalogPage from "@/components/pages/Catalog";
import { ProductDetailPage, ProductQuickView, ThemeStudioPage } from "@/components/pages/ProductDetail";
import { AboutPage, ContactPage, FAQPage, PolicyPage } from "@/components/pages/Content";
import {
  CartPage,
  CheckoutPage,
  ComparePage,
  CustomerAccountPage,
  OrderConfirmationPage,
  OrderTrackingPage,
  WishlistPage,
} from "@/components/pages/Commerce";
import AdminDashboard from "@/components/admin/AdminDashboard";

const directCategoryPaths: Record<string, string> = {
  smartphones: "smartphones", laptops: "laptops", tablets: "tablets", headphones: "headphones", earbuds: "earbuds",
  "smart-watches": "smart-watches", speakers: "speakers", cameras: "cameras", "smart-home": "smart-home",
  "computer-accessories": "computer-accessories", monitors: "monitors", "keyboards-mice": "keyboards-mice",
  "power-banks-chargers": "power-banks-chargers",
};

function NotFoundPage() {
  return <div className="not-found-page"><span className="eyebrow">THAT’S NOT IN THE EDIT</span><h1>It’s a little quiet<br />around here.</h1><p>We couldn’t find that page. There are still plenty of good things to discover.</p><div><Link className="button button-primary" href="/shop">Explore the shop</Link><Link className="text-link" href="/">Return home</Link></div></div>;
}

export default function Storefront() {
  const pathname = usePathname() || "/";
  const path = pathname.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);
  const { theme, databaseStatus, commerceConfigured } = useStore();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const onQuickView = (product: Product) => setQuickViewProduct(product);
  const isAdmin = segments[0] === "admin";
  const page = useMemo(() => {
    if (path === "/") return <HomePage theme={theme} onQuickView={onQuickView} />;
    if (isAdmin) return <AdminDashboard section={segments[1] || "overview"} />;
    if (segments[0] === "product" && segments[1]) return <ProductDetailPage slug={decodeURIComponent(segments.slice(1).join("/"))} onQuickView={onQuickView} />;
    if (segments[0] === "collection") {
      const collection = segments.length === 2 ? getCollection(decodeURIComponent(segments[1])) : undefined;
      return collection
        ? <CatalogPage key={path} mode="collection" tagFilter={collection.tag} customTitle={collection.name} customDescription={collection.description} onQuickView={onQuickView} />
        : <NotFoundPage />;
    }
    if (segments[0] === "discovery") {
      const section = segments.length === 2 ? getDiscoverySection(decodeURIComponent(segments[1])) : undefined;
      return section
        ? <CatalogPage key={path} mode="discovery" tagFilter={section.tag} customTitle={section.name} customDescription={section.description} onQuickView={onQuickView} />
        : <NotFoundPage />;
    }
    if (segments[0] === "category" && segments[1]) return <CatalogPage key={path} mode="category" categorySlug={decodeURIComponent(segments.slice(1).join("/"))} onQuickView={onQuickView} />;
    if (path === "/shop" || path === "/shop-all") return <CatalogPage mode="all" onQuickView={onQuickView} />;
    if (path === "/new-arrivals") {
      const section = getDiscoverySection("new-technology-arrivals");
      return <CatalogPage mode="discovery" tagFilter={section?.tag} customTitle={section?.name} customDescription={section?.description} onQuickView={onQuickView} />;
    }
    if (path === "/best-sellers") return <CatalogPage mode="best" onQuickView={onQuickView} />;
    if (path === "/trending") {
      const section = getDiscoverySection("trending-this-week");
      return <CatalogPage mode="discovery" tagFilter={section?.tag} customTitle={section?.name} customDescription={section?.description} onQuickView={onQuickView} />;
    }
    if (path === "/offers" || path === "/special-offers") return <CatalogPage mode="offers" onQuickView={onQuickView} />;
    if (path === "/flash-sale") return <CatalogPage mode="flash" onQuickView={onQuickView} />;
    if (path === "/gaming") return <CatalogPage mode="all" includeCategories={["gaming-accessories", "gaming-consoles"]} customTitle="Play without limits." customDescription="A considered selection of consoles, controls and gaming gear — ready for your next good session." onQuickView={onQuickView} />;
    if (path === "/audio") return <CatalogPage mode="all" includeCategories={["headphones", "earbuds", "speakers"]} customTitle="Find your frequency." customDescription="Immersive listening, pocket-ready sound and room-filling speakers. Chosen to make every note feel closer." onQuickView={onQuickView} />;
    if (path === "/wearables") return <CatalogPage mode="all" includeCategories={["smart-watches"]} customTitle="Time well spent." customDescription="Thoughtful watches that bring movement, wellbeing and everyday information a little closer." onQuickView={onQuickView} />;
    if (path === "/smart-home") return <CatalogPage mode="category" categorySlug="smart-home" customTitle="Make home feel in sync." customDescription="Small, thoughtful upgrades for a home that works more beautifully together." onQuickView={onQuickView} />;
    if (directCategoryPaths[segments[0]]) return <CatalogPage key={path} mode="category" categorySlug={directCategoryPaths[segments[0]]} onQuickView={onQuickView} />;
    if (path === "/theme-studio" || path === "/themes") return <ThemeStudioPage />;
    if (path === "/wishlist") return <WishlistPage onQuickView={onQuickView} />;
    if (path === "/compare") return <ComparePage />;
    if (path === "/cart") return <CartPage onQuickView={onQuickView} />;
    if (path === "/checkout") return <CheckoutPage />;
    if (segments[0] === "order-confirmation") return <OrderConfirmationPage orderId={decodeURIComponent(segments[1] || "")} preview={databaseStatus !== "connected"} />;
    if (path === "/order-tracking" || path === "/track-order") return <OrderTrackingPage />;
    if (path === "/login" || path === "/account/login") return <CustomerAccountPage mode="login" />;
    if (path === "/register" || path === "/account/register") return <CustomerAccountPage mode="register" />;
    if (path === "/account" || path === "/my-account") return <CustomerAccountPage mode="account" />;
    if (path === "/orders" || path === "/my-orders") return <CustomerAccountPage mode="orders" />;
    if (path === "/about" || path === "/about-us") return <AboutPage />;
    if (path === "/contact" || path === "/contact-us") return <ContactPage />;
    if (path === "/faq") return <FAQPage />;
    if (path === "/privacy" || path === "/privacy-policy") return <PolicyPage kind="privacy" />;
    if (path === "/terms" || path === "/terms-and-conditions") return <PolicyPage kind="terms" />;
    if (path === "/shipping-returns" || path === "/shipping-and-returns") return <PolicyPage kind="shipping" />;
    return <NotFoundPage />;
  }, [path, theme, databaseStatus, isAdmin, segments]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [path]);

  if (isAdmin) return <>{page}<ToastStack /></>;
  return <div className={`store-frame theme-${theme}`}>
    {databaseStatus === "disconnected" && <div className="store-preview-notice" role="status"><span className="store-preview-badge">PREVIEW ENVIRONMENT</span><p>This browser is not connected to the live store database. Catalog availability and promotions may be sample data; orders and form submissions are not saved to the live store.</p><Link href="/faq">Read the store notes <span aria-hidden="true">↗</span></Link></div>}
    {databaseStatus === "connected" && !commerceConfigured && <div className="store-preview-notice" role="status"><span className="store-preview-badge">STORE SETUP INCOMPLETE</span><p>The live database is connected, but checkout is disabled until verified store identity and delivery terms are saved.</p><Link href="/admin/settings">Configure store settings <span aria-hidden="true">↗</span></Link></div>}
    <SiteHeader theme={theme} />
    <main id="main-content" key={path} className="page-transition">{page}</main>
    <SiteFooter theme={theme} />
    {quickViewProduct && <ProductQuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />}
    <ToastStack />
  </div>;
}
