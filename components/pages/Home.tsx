"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles, Star } from "lucide-react";
import { useStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import { salePercent } from "@/lib/utils";
import type { Product, ThemeId } from "@/lib/types";
import { COLLECTIONS, DISCOVERY, EXPLORE_BY_INTEREST, type DiscoverySection } from "@/lib/storefront-edits";
import { CategoryTile, ProductCard, SectionHeading } from "@/components/StorePrimitives";
import ProductMedia from "@/components/ProductMedia";

const heroCopy: Record<ThemeId, { overline: string; title: string; italic: string; body: string; cta: string }> = {
  "luxury-black": { overline: "THE NEXVORO EDIT · VOL. 01", title: "Technology,", italic: "considered.", body: "The objects that make everyday life feel a little more extraordinary. Curated with intention, chosen to last.", cta: "Discover the edit" },
  "neon-cyber": { overline: "SIGNAL FOUND · 01/08", title: "Tomorrow,", italic: "in your hands.", body: "The next wave of sound, speed and possibility is closer than you think. Find your new favorite frequency.", cta: "Enter the signal" },
  "apple-minimal": { overline: "A MORE CONSIDERED EDIT", title: "A better way", italic: "to connect.", body: "Thoughtful technology for the details that matter. Beautifully simple. Ready for every day.", cta: "Explore the collection" },
  "premium-purple": { overline: "THE FUTURE, WITH FEELING", title: "Made for", italic: "your moments.", body: "A little more color. A lot more possibility. Meet the pieces that bring your everyday into focus.", cta: "Find your favorite" },
  "modern-tech": { overline: "TECHNOLOGY, MADE HUMAN", title: "Smarter by", italic: "design.", body: "The right tools make room for better work, better play and more time for everything else.", cta: "Shop the edit" },
  "gaming-universe": { overline: "READY PLAYER · NEXVORO", title: "Take the", italic: "next level.", body: "Precision gear, deeper worlds and the equipment to make every session count. The arena is yours.", cta: "Explore gaming" },
  "silver-metallic": { overline: "FORM MEETS FUNCTION · 001", title: "Future", italic: "in focus.", body: "Sculpted lines. Quiet power. A selection of technology where engineering is part of the beauty.", cta: "View the collection" },
  "creative-colorful": { overline: "GOOD THINGS, IN FULL COLOR", title: "A bright idea", italic: "for every day.", body: "Big feelings. Useful little things. Discover technology that makes life more playful and more yours.", cta: "Find your color" },
};

function HomeHero({ theme, heroProduct }: { theme: ThemeId; heroProduct: Product }) {
  const { formatPrice } = useStore();
  const copy = heroCopy[theme];
  const themeName = THEMES.find((item) => item.id === theme)?.name || "Luxury Black";
  return (
    <section className={`hero hero-${theme}`}>
      <div className="hero-copy">
        <span className="hero-overline"><i />{copy.overline}</span>
        <h1>{copy.title}<br /><em>{copy.italic}</em></h1>
        <p>{copy.body}</p>
        <div className="hero-actions"><Link href={theme === "gaming-universe" ? "/gaming" : "/shop"} className="button button-primary">{copy.cta}<ArrowRight size={16} /></Link><Link href="/theme-studio" className="hero-secondary-link">A store with eight moods <ArrowUpRight size={15} /></Link></div>
        <div className="hero-index"><span>01</span><i /><span>THE {themeName.toUpperCase()} EXPERIENCE</span></div>
      </div>
      <div className="hero-art" aria-label={`${heroProduct.name} featured product`}>
        <div className="hero-art-halo" />
        <div className="hero-art-grain" />
        <div className="hero-product"><ProductMedia product={heroProduct} priority /></div>
        <div className="hero-product-caption"><span>THE OBJECT OF THE MOMENT</span><strong>{heroProduct.name}</strong><small>{formatPrice(heroProduct.price)}</small></div>
        <span className="hero-side-note">DESIGN / PERFORMANCE / EVERYDAY</span>
        <span className="hero-art-number">Nº 01</span>
      </div>
      <div className="hero-scroll-hint"><ArrowDownRight size={14} />SCROLL TO DISCOVER</div>
      <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
    </section>
  );
}

function CuratedShelf({ section, items, onQuickView }: { section: DiscoverySection; items: Product[]; onQuickView: (product: Product) => void }) {
  const href = section.slug === "compare-interesting-gadgets" ? "/compare" : `/discovery/${section.slug}`;
  return <section className={`home-section discovery-shelf discovery-shelf-${section.slug}`}>
    <SectionHeading eyebrow={section.eyebrow} title={section.name} action={section.slug === "compare-interesting-gadgets" ? "Open comparison" : "Explore this edit"} href={href} />
    {items.length > 0
      ? <div className="product-grid product-grid-home">{items.map((product, index) => <ProductCard key={product.id} product={product} onQuickView={onQuickView} index={index} />)}</div>
      : <div className="discovery-empty"><Sparkles size={18} /><div><strong>This edit is being curated.</strong><p>Products will appear after their details and availability have been checked.</p></div></div>}
  </section>;
}

export default function HomePage({ theme, onQuickView }: { theme: ThemeId; onQuickView: (product: Product) => void }) {
  const { products, categories, recent, reviews, settings, coupons, commerceConfigured, formatPrice } = useStore();
  const heroProduct = products.find((item) => item.featured && item.stock > 0) || products[0];
  const findDiscoveryItems = (slug: string, limit = 4) => {
    const section = DISCOVERY.find((item) => item.slug === slug);
    return section ? products.filter((product) => product.tags.includes(section.tag)).slice(0, limit) : [];
  };
  const featured = findDiscoveryItems("staff-picks");
  const newDiscovery = findDiscoveryItems("discover-something-new");
  const trending = findDiscoveryItems("trending-this-week");
  const fresh = findDiscoveryItems("new-technology-arrivals");
  const comparisonPicks = findDiscoveryItems("compare-interesting-gadgets", 2);
  const dailyFeature = findDiscoveryItems("featured-gadget-of-the-day", 1);
  const offers = products.filter((item) => salePercent(item) > 0).sort((a, b) => salePercent(b) - salePercent(a)).slice(0, 4);
  const viewed = recent.map((id) => products.find((product) => product.id === id)).filter((item): item is Product => Boolean(item)).slice(0, 4);
  const firstCoupon = coupons.find((coupon) => coupon.active);
  const brandNames = Array.from(new Set(products.map((item) => item.brand))).slice(0, 8);
  const averageDiscount = offers.length ? Math.round(offers.reduce((total, item) => total + salePercent(item), 0) / offers.length) : 0;

  return (
    <div className="home-page">
      <HomeHero theme={theme} heroProduct={heroProduct} />
      <div className="home-trust-strip">
        <div><span>01</span><strong>Good design, chosen with care</strong></div>
        <div><span>02</span><strong>Cash on delivery available</strong></div>
        <div><span>03</span><strong>{commerceConfigured ? settings.freeShippingThreshold > 0 ? `Free delivery over ${formatPrice(settings.freeShippingThreshold)}` : "Free delivery on every order" : "Delivery terms are being prepared"}</strong></div>
        <div><span>04</span><strong>Here when you need us</strong></div>
      </div>

      <section className="home-section category-section" id="collections">
        <SectionHeading eyebrow={EXPLORE_BY_INTEREST.eyebrow} title={EXPLORE_BY_INTEREST.name} action="Browse all interests" href="/shop" />
        <div className="category-grid-home">
          {categories.slice(0, 6).map((category) => <CategoryTile key={category.slug} category={category} product={products.find((product) => product.category === category.slug)} />)}
        </div>
        <div className="category-more-row"><span>{EXPLORE_BY_INTEREST.description}</span><Link href="/shop" className="text-link">Explore every category <ArrowRight size={14} /></Link></div>
      </section>

      <section className="home-section named-collections-section" id="named-collections">
        <SectionHeading eyebrow="TEN WAYS INTO TOMORROW" title="Find your kind of gadget." action="Browse the full shop" href="/shop" />
        <div className="homepage-collection-grid">{COLLECTIONS.map((collection, index) => {
          const count = products.filter((product) => product.tags.includes(collection.tag)).length;
          return <Link className="homepage-collection-card" href={`/collection/${collection.slug}`} key={collection.slug}>
            <div className="homepage-collection-art" aria-hidden="true"><Image src={collection.image} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, 20vw" /><span>AI-GENERATED ART · NOT PRODUCT PHOTO</span></div>
            <span className="homepage-collection-index">N / {String(index + 1).padStart(2, "0")}</span><ArrowUpRight size={16} className="homepage-collection-arrow" />
            <strong>{collection.name}</strong><small>{collection.description}</small><span className="homepage-collection-count">{count} {count === 1 ? "product" : "products"}</span>
          </Link>;
        })}</div>
      </section>

      <CuratedShelf section={DISCOVERY.find((section) => section.slug === "discover-something-new")!} items={newDiscovery} onQuickView={onQuickView} />
      <CuratedShelf section={DISCOVERY.find((section) => section.slug === "staff-picks")!} items={featured} onQuickView={onQuickView} />

      <section className={`editorial-banner editorial-banner-${theme}`}>
        <div className="editorial-banner-copy"><span className="eyebrow">THE SOUND EDIT</span><h2>A little less noise.<br /><em>A lot more feeling.</em></h2><p>When the world gets loud, find your own frequency. Meet considered audio for the way you listen.</p><Link href="/audio" className="button button-light">Explore audio <ArrowRight size={15} /></Link><small>01 / 03 — LISTEN WITH INTENTION</small></div>
        <div className="editorial-banner-image"><ProductMedia product={products.find((item) => item.category === "headphones") || heroProduct} /><span className="image-caption">SOUND, SHAPED AROUND YOU</span></div>
      </section>

      <CuratedShelf section={DISCOVERY.find((section) => section.slug === "new-technology-arrivals")!} items={fresh} onQuickView={onQuickView} />

      {(offers.length > 0 || Boolean(firstCoupon)) && <section className="offer-band">
        <div className="offer-band-art"><span>GOOD<br />THINGS<br /><em>ON SALE.</em></span><div className="offer-sparkle"><Sparkles size={30} strokeWidth={1} /></div></div>
        <div className="offer-band-copy"><span className="eyebrow">THE GOOD-FIND SALE</span><h2>{averageDiscount ? `A little more, for a little less.` : "Special offers, thoughtfully picked."}</h2><p>{firstCoupon ? `Use ${firstCoupon.code} at checkout for ${firstCoupon.type === "percent" ? `${firstCoupon.value}% off` : `${formatPrice(firstCoupon.value)} off`}.` : "A small thank-you for finding your way here."} Selected offers are applied before you pay.</p><Link href="/offers" className="text-link">Browse current offers <ArrowRight size={15} /></Link></div>
        <div className="offer-band-stat"><strong>{averageDiscount ? `${averageDiscount}%` : "01"}</strong><span>AVERAGE SAVING<br />ON THIS EDIT</span><div className="offer-stat-line" /></div>
      </section>}

      {offers.length > 0 && <section className="home-section offers-section">
        <SectionHeading eyebrow="A GOOD FIND, AT A BETTER PRICE" title="Little luxuries. Lovely offers." action="Shop all offers" href="/offers" />
        <div className="product-grid product-grid-home">
          {offers.map((product, index) => <ProductCard key={product.id} product={product} onQuickView={onQuickView} index={index} />)}
        </div>
      </section>}

      <section className="two-up-stories">
        <Link href="/gaming" className="story-card story-card-gaming">
          <div className="story-card-media"><ProductMedia product={products.find((item) => item.category === "gaming-consoles") || heroProduct} /></div>
          <div className="story-card-copy"><span className="eyebrow">PLAY YOUR WAY</span><h2>Get lost<br />in a good world.</h2><span className="story-link">Explore gaming <ArrowUpRight size={16} /></span></div><span className="story-card-number">01 / PLAY</span>
        </Link>
        <Link href="/smart-home" className="story-card story-card-home">
          <div className="story-card-media"><ProductMedia product={products.find((item) => item.category === "smart-home") || heroProduct} /></div>
          <div className="story-card-copy"><span className="eyebrow">LIFE, A LITTLE LIGHTER</span><h2>Make home<br />feel in sync.</h2><span className="story-link">Explore smart home <ArrowUpRight size={16} /></span></div><span className="story-card-number">02 / HOME</span>
        </Link>
      </section>

      <CuratedShelf section={DISCOVERY.find((section) => section.slug === "trending-this-week")!} items={trending} onQuickView={onQuickView} />

      <section className="brand-marquee-section">
        <div className="brand-marquee-heading"><span className="eyebrow">GOOD COMPANY</span><p>A few names you know.<br />A few new favorites.</p></div>
        <div className="brand-marquee" aria-label="Featured brands">{brandNames.map((name) => <span key={name}>{name}</span>)}</div>
      </section>

      <section className="comparison-teaser">
        <div className="comparison-teaser-copy"><span className="eyebrow">SIDE BY SIDE</span><h2>Compare Interesting<br /><em>Gadgets.</em></h2><p>Compare selected products using the specifications published for each listing. Add a product to the comparison from its card.</p><Link href="/compare" className="button button-primary">Open comparison <ArrowRight size={15} /></Link></div>
        <div className="comparison-preview">
          {comparisonPicks.map((product, index) => <Link href={`/product/${product.slug}`} key={product.id} className={`comparison-product comparison-product-${index}`}><div className="comparison-product-media"><ProductMedia product={product} /></div><span>{String(index + 1).padStart(2, "0")}</span><strong>{product.name}</strong><small>{product.specs.Highlights || product.category.replaceAll("-", " ")}</small><b>{formatPrice(product.price)}</b></Link>)}
          {comparisonPicks.length === 0 ? <div className="comparison-empty"><Sparkles size={19} /><strong>A useful comparison is being prepared.</strong><small>Products appear here after an editor selects distinct items.</small></div> : comparisonPicks.length === 1 ? <div className="comparison-empty comparison-empty-compact"><strong>One more product is needed.</strong><small>Compare works best with two or more distinct picks.</small></div> : <><div className="compare-vs">VS</div><div className="comparison-lines"><i /><i /><i /><i /></div></>}
        </div>
      </section>

      <CuratedShelf section={DISCOVERY.find((section) => section.slug === "featured-gadget-of-the-day")!} items={dailyFeature} onQuickView={onQuickView} />

      <section className="home-section customer-love-section">
        <div className="review-heading"><div><span className="eyebrow">A NOTE FROM THE COMMUNITY</span><h2>Good things,<br /><em>said honestly.</em></h2></div><Link href="/shop" className="text-link">Find your first favorite <ArrowRight size={15} /></Link></div>
        {reviews.filter((review) => review.approved).length > 0 ? (
          <div className="review-grid">{reviews.filter((review) => review.approved).slice(0, 3).map((review) => <article className="review-card" key={review.id}><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }).map((_, i) => <Star size={13} key={i} fill={i < review.rating ? "currentColor" : "none"} />)}</div><h3>{review.title}</h3><p>“{review.body}”</p><div className="review-author"><span>{review.name.charAt(0).toUpperCase()}</span><div><strong>{review.name}</strong><small>APPROVED CUSTOMER REVIEW</small></div></div></article>)}</div>
        ) : (
          <div className="review-empty"><div className="review-empty-mark"><Star size={22} strokeWidth={1} /></div><div><strong>No customer reviews yet.</strong><p>We don’t invent ratings. When the first customers share their experience, you’ll find it here.</p></div><Link href="/shop" className="text-link">Explore the collection <ArrowRight size={14} /></Link></div>
        )}
      </section>

      {viewed.length > 0 && <section className="home-section recently-viewed-section"><SectionHeading eyebrow="A SECOND LOOK" title="Picked up where you left off." action="Shop all" href="/shop" /><div className="product-grid product-grid-home">{viewed.map((product, index) => <ProductCard key={product.id} product={product} onQuickView={onQuickView} index={index} />)}</div></section>}

      <section className="home-closing-note"><div className="closing-note-rule" /><span className="eyebrow">THE NEXVORO PROMISE TO OURSELVES</span><p>Buy less, choose well.<br /><em>Let the good things earn their place.</em></p><Link href="/about" className="text-link">A little about us <ArrowRight size={14} /></Link><span className="closing-note-index">N / 01</span></section>
    </div>
  );
}
