import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Heart, LockKeyhole, MapPin, Minus, PackageCheck, Plus, ShieldCheck, ShoppingBag, Trash2, Truck, UserRound, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatMoney, makeId } from "@/lib/utils";
import { COD_PAYMENT_CURRENCY, isCurrencyCode, roundCurrencyAmount } from "@/lib/currency.mjs";
import { orderRecordedSnapshot } from "@/lib/order-currency.mjs";
import { getBrowserSupabase, supabaseAuthConfigured } from "@/lib/supabase-browser";
import ProductMedia from "@/components/ProductMedia";
import CurrencySelector from "@/components/CurrencySelector";
import { ProductCard, SectionHeading } from "@/components/StorePrimitives";
import type { CartLine, Order, Product } from "@/lib/types";
function orderLineProducts(cart: CartLine[], products: Product[]): { line: CartLine; product: Product }[] {
  return cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? [{ line, product }] : [];
  });
}
export function CartPage({ onQuickView }: { onQuickView: (product: Product) => void }) {
  const {
    cart,
    products,
    setCartQuantity,
    removeFromCart,
    settings,
    commerceConfigured,
    databaseStatus,
    formatPrice
  } = useStore();
  const lines = orderLineProducts(cart, products);
  const subtotal = lines.reduce((sum, item) => sum + item.product.price * item.line.quantity, 0);
  const shipping = subtotal >= settings.freeShippingThreshold || subtotal === 0 ? 0 : settings.shippingFee;
  const remaining = Math.max(0, settings.freeShippingThreshold - subtotal);
  const deliveryLabel = commerceConfigured ? shipping === 0 ? "Complimentary" : formatPrice(shipping) : databaseStatus === "disconnected" ? "Preview only" : "Not configured";
  const recommended = products.filter(item => item.featured && !cart.some(line => line.productId === item.id)).slice(0, 4);
  return <div className={"cart-page"}><div className={"page-heading-quiet"}><div><div className={"breadcrumbs"}><Link href={"/"}>Home</Link><span>/</span><span>Your bag</span></div><span className={"eyebrow"}>A GOOD PLACE TO BE</span><h1>Your bag<span className={"heading-count"}>{cart.reduce((sum, item) => sum + item.quantity, 0).toString().padStart(2, "0")}</span></h1><p>The pieces you chose, ready for their next chapter.</p></div><Link href={"/shop"} className={"text-link"}><ArrowLeft size={14} />Keep looking</Link></div>{lines.length === 0 ? <div className={"empty-state cart-empty"}><div className={"empty-state-icon"}><ShoppingBag size={22} /></div><span className={"eyebrow"}>A CLEAN SLATE</span><h2>Your bag is waiting<br />for something good.</h2><p>Explore thoughtfully chosen technology for the way you live.</p><Link href={"/shop"} className={"button button-primary"}>Explore the edit <ArrowRight size={15} /></Link></div> : <><div className={"cart-layout"}><div className={"cart-lines"}><div className={"cart-column-labels"}><span>THE PIECE</span><span>QUANTITY</span><span>SUBTOTAL</span></div>{lines.map(param => {
            const {
              line,
              product
            } = param;
            return <article key={`${product.id}-${line.variant || ""}`} className={"cart-line"}><Link href={"/product/".concat(product.slug)} className={"cart-line-image"}><ProductMedia product={product} /></Link><div className={"cart-line-info"}><span className={"eyebrow"}>{product.brand}</span><Link href={"/product/".concat(product.slug)}><strong>{product.name}</strong></Link><small>{line.variant || product.variants[0] || product.sku}</small><span className={"cart-line-mobile-price"}>{formatPrice(product.price * line.quantity)}</span><button className={"remove-line"} onClick={() => removeFromCart(product.id, line.variant)}><Trash2 size={13} />Remove</button></div><div className={"cart-quantity"}><button aria-label={"Decrease quantity"} onClick={() => setCartQuantity(product.id, line.quantity - 1, line.variant)}><Minus size={13} /></button><span>{line.quantity}</span><button aria-label={"Increase quantity"} disabled={line.quantity >= product.stock} onClick={() => setCartQuantity(product.id, line.quantity + 1, line.variant)}><Plus size={13} /></button></div><strong className={"cart-line-total"}>{formatPrice(product.price * line.quantity)}</strong></article>;
          })}<div className={"cart-note"}><span><PackageCheck size={16} />{commerceConfigured ? remaining > 0 ? "You’re ".concat(formatPrice(remaining), " away from complimentary delivery.") : "Complimentary delivery is on us." : databaseStatus === "disconnected" ? "Preview mode · delivery terms are not confirmed." : "Delivery prices are not configured yet."}</span><Link href={"/shipping-returns"}>Delivery details <ArrowRight size={13} /></Link></div></div><aside className={"cart-summary"}><span className={"eyebrow"}>THE TOTAL, SO FAR</span><h2>Order summary</h2><div className={"summary-row"}><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><div className={"summary-row"}><span>Delivery</span><strong>{deliveryLabel}</strong></div><div className={"summary-divider"} /><div className={"summary-row summary-total"}><span>Estimated total</span><strong>{formatPrice(subtotal + shipping)}</strong></div><small>{commerceConfigured ? "Taxes and final delivery details are confirmed at checkout." : databaseStatus === "disconnected" ? "Preview prices only; no carrier quote is connected." : "Delivery terms must be set before checkout is enabled."} Display currency amounts are estimates. Cash on delivery is collected in PKR; the confirmed amount is shown at checkout.</small><Link className={"button button-primary checkout-link"} href={"/checkout"}>Continue to checkout <ArrowRight size={15} /></Link><div className={"cart-secure-note"}><LockKeyhole size={14} />Secure, server-validated order details</div><Link className={"text-link cart-track-link"} href={"/order-tracking"}>Already placed an order? Track it <ArrowRight size={13} /></Link></aside></div></>}{recommended.length > 0 && <section className={"home-section cart-recommendations"}><SectionHeading eyebrow={"A FEW GOOD ADDITIONS"} title={"You might like these."} action={"Shop the full edit"} href={"/shop"} /><div className={"product-grid product-grid-home"}>{recommended.map((product, index) => <ProductCard key={product.id} product={product} onQuickView={onQuickView} index={index} />)}</div></section>}</div>;
}
export function WishlistPage({ onQuickView }: { onQuickView: (product: Product) => void }) {
  const {
    wishlist,
    products,
    toggleWishlist
  } = useStore();
  const saved = wishlist.map((id) => products.find((product) => product.id === id)).filter((item): item is Product => item !== undefined);
  return <div className={"wishlist-page"}><div className={"page-heading-quiet"}><div><div className={"breadcrumbs"}><Link href={"/"}>Home</Link><span>/</span><span>Wishlist</span></div><span className={"eyebrow"}>A PLACE FOR THE MAYBES</span><h1>Your saved things<span className={"heading-count"}>{saved.length.toString().padStart(2, "0")}</span></h1><p>Keep the pieces you love close, until the moment feels right.</p></div><Link href={"/shop"} className={"text-link"}>Find another favorite <ArrowRight size={14} /></Link></div>{saved.length ? <><div className={"wishlist-toolbar"}><span>{saved.length} saved {saved.length === 1 ? "piece" : "pieces"}</span><span>Saved on this device</span></div><div className={"product-grid product-grid-catalog"}>{saved.map((product, index) => <div className={"wishlist-card-wrap"} key={product.id}><ProductCard product={product} onQuickView={onQuickView} index={index % 4} /><button className={"wishlist-remove"} onClick={() => toggleWishlist(product.id)}><X size={13} />Remove from saved</button></div>)}</div></> : <div className={"empty-state"}><div className={"empty-state-icon"}><Heart size={22} /></div><span className={"eyebrow"}>A FRESH PAGE</span><h2>Nothing saved just yet.</h2><p>Tap the heart on a product to keep it close. Your wishlist stays on this device.</p><Link href={"/shop"} className={"button button-primary"}>Browse the collection <ArrowRight size={15} /></Link></div>}</div>;
}
export function ComparePage() {
  const {
    compare,
    products,
    toggleCompare,
    formatPrice,
    addToCart,
    notify
  } = useStore();
  const compared = compare.map((id) => products.find((product) => product.id === id)).filter((item): item is Product => item !== undefined);
  const add = () => notify("Use the compare icon on any product to add it here.", "info");
  const specKeys = Array.from(new Set(compared.flatMap(product => Object.keys(product.specs))));
  return <div className={"compare-page"}><div className={"page-heading-quiet"}><div><div className={"breadcrumbs"}><Link href={"/"}>Home</Link><span>/</span><span>Compare</span></div><span className={"eyebrow"}>DETAILS, SIDE BY SIDE</span><h1>The comparison desk<span className={"heading-count"}>{compared.length.toString().padStart(2, "0")}</span></h1><p>Keep up to four products in view while you decide.</p></div><Link href={"/shop"} className={"text-link"}>Browse products <ArrowRight size={14} /></Link></div>{compared.length === 0 ? <div className={"empty-state"}><div className={"empty-state-icon"}><span>VS</span></div><span className={"eyebrow"}>A CLEARER CHOICE</span><h2>Let’s put a few things<br />side by side.</h2><p>Choose the compare icon on any product card to get started.</p><button className={"button button-primary"} onClick={add}>How comparison works <ArrowRight size={15} /></button></div> : <div className={"comparison-table-wrap"}><div className={"comparison-table"}><div className={"comparison-table-label"}><div className={"compare-table-title"}><span className={"eyebrow"}>THE SIDE-BY-SIDE</span><h2>Same questions.<br /><em>Different answers.</em></h2></div><div className={"comparison-row-labels"}><strong>Price</strong><strong>Brand</strong><strong>Category</strong><strong>Availability</strong>{specKeys.map(key => <strong key={key}>{key}</strong>)}</div></div>{compared.map(product => <div className={"comparison-product-column"} key={product.id}><div className={"comparison-table-product"}><button className={"compare-remove"} aria-label={"Remove ".concat(product.name, " from comparison")} onClick={() => toggleCompare(product.id)}><X size={14} /></button><Link href={"/product/".concat(product.slug)} className={"comparison-table-image"}><ProductMedia product={product} /></Link><span className={"eyebrow"}>{product.brand}</span><Link href={"/product/".concat(product.slug)} className={"comparison-table-name"}>{product.name}</Link><strong className={"comparison-table-price"}>{formatPrice(product.price)}</strong><button className={"button button-primary"} onClick={() => {
              addToCart(product.id, 1, product.variants[0]);
            }}><ShoppingBag size={14} />Add to bag</button></div><div className={"comparison-values"}><div>{formatPrice(product.price)}{product.compareAt > product.price && <small>Was {formatPrice(product.compareAt)}</small>}</div><div>{product.brand}</div><div>{product.category.replaceAll("-", " ")}</div><div>{product.stock > 0 ? `${product.stock} in stock` : "Sold out"}</div>{specKeys.map(key => <div key={key}>{product.specs[key] || "—"}</div>)}</div></div>)}</div><div className={"compare-hint"}><CircleAlert size={15} />Specifications are supplied for each listed product. Check the product page for the full details.</div></div>}</div>;
}
export function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    products,
    settings,
    coupons,
    checkout,
    commerceConfigured,
    databaseStatus,
    displayCurrency,
    exchangeRates,
    exchangeRateSources,
    exchangeRateUpdatedAt,
    formatPrice,
  } = useStore();
  const lines = orderLineProducts(cart, products);
  const subtotal = lines.reduce((sum, item) => sum + item.product.price * item.line.quantity, 0);
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [address, setAddress] = useState({
    line1: "", line2: "", city: "", region: "Punjab", postalCode: "", country: "Pakistan",
  });
  const shipping = subtotal >= settings.freeShippingThreshold || subtotal === 0 ? 0 : settings.shippingFee;
  const coupon = coupons.find((item) => item.code.toUpperCase() === couponCode.toUpperCase() && item.active);
  const discount = coupon
    ? coupon.type === "percent"
      ? Math.round((subtotal * coupon.value / 100 + Number.EPSILON) * 100) / 100
      : Math.min(subtotal, coupon.value)
    : 0;
  const total = Math.max(0, subtotal + shipping - discount);
  const deliveryLabel = commerceConfigured
    ? shipping > 0 ? formatPrice(shipping) : "Complimentary"
    : databaseStatus === "disconnected" ? "Preview only" : "Not configured";
  const checkoutRate = settings.currency === COD_PAYMENT_CURRENCY ? 1 : exchangeRates[COD_PAYMENT_CURRENCY];
  const checkoutRateSource = settings.currency === COD_PAYMENT_CURRENCY ? "identity" : exchangeRateSources[COD_PAYMENT_CURRENCY];
  const checkoutRateReady = settings.currency === COD_PAYMENT_CURRENCY || (
    Number.isFinite(checkoutRate) && checkoutRate! > 0 && (checkoutRateSource === "live" || checkoutRateSource === "fallback")
  );
  const paymentSubtotal = checkoutRateReady ? roundCurrencyAmount(subtotal * (checkoutRate || 1), COD_PAYMENT_CURRENCY) : null;
  const paymentShipping = checkoutRateReady ? roundCurrencyAmount(shipping * (checkoutRate || 1), COD_PAYMENT_CURRENCY) : null;
  const paymentDiscount = checkoutRateReady ? roundCurrencyAmount(discount * (checkoutRate || 1), COD_PAYMENT_CURRENCY) : null;
  const paymentTotal = checkoutRateReady ? roundCurrencyAmount(total * (checkoutRate || 1), COD_PAYMENT_CURRENCY) : null;
  const checkoutDisabled = busy || databaseStatus === "checking" ||
    (databaseStatus === "connected" && !commerceConfigured) ||
    (process.env.NODE_ENV === "production" && databaseStatus === "disconnected") ||
    !checkoutRateReady;

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setCustomer((current) => ({
        ...current,
        email: data.user.email || current.email,
        name: String(data.user.user_metadata?.full_name || current.name),
        phone: String(data.user.user_metadata?.phone || current.phone),
      }));
    });
  }, []);

  const applyCoupon = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = coupons.find((item) => item.code.toUpperCase() === couponInput.trim().toUpperCase() && item.active && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()));
    if (!found) {
      setCouponError("That code isn’t available. Check the spelling or try another.");
      setCouponCode("");
      return;
    }
    setCouponError("");
    setCouponCode(found.code);
    setCouponInput(found.code);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!lines.length) { setError("Your bag is empty."); return; }
    if (!checkoutRateReady || paymentTotal === null || checkoutRate === undefined) {
      setError("A current PKR cash-on-delivery rate is unavailable. Please refresh checkout or try again later.");
      return;
    }
    setBusy(true);
    const date = new Date().toISOString();
    const order: Order = {
      id: makeId("order"),
      orderNo: `NX-${date.slice(2, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      createdAt: date,
      customer,
      address,
      items: lines.map(({ line, product }) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: line.quantity,
        variant: line.variant,
      })),
      subtotal,
      shipping,
      discount,
      total,
      currency: settings.currency,
      paymentCurrency: COD_PAYMENT_CURRENCY,
      fxRate: checkoutRate,
      fxRateAt: settings.currency === COD_PAYMENT_CURRENCY ? date : exchangeRateUpdatedAt[COD_PAYMENT_CURRENCY] || date,
      fxRateSource: checkoutRateSource as "identity" | "live" | "fallback",
      paymentSubtotal: paymentSubtotal!,
      paymentShipping: paymentShipping!,
      paymentDiscount: paymentDiscount!,
      paymentTotal,
      status: "pending",
      paymentMethod: "cash_on_delivery",
      coupon: coupon?.code,
    };
    const result = await checkout(order);
    setBusy(false);
    if (!result.ok || !result.order) { setError(result.message || "We could not place your order."); return; }
    router.push(`/order-confirmation/${encodeURIComponent(result.order.id)}${result.persisted ? "?saved=1" : "?preview=1"}`);
  };

  if (!lines.length) return <div className="checkout-empty"><span className="eyebrow">NOTHING TO CHECK OUT YET</span><h1>Your bag is empty.</h1><p>Start with something that feels right.</p><Link href="/shop" className="button button-primary">Explore the shop <ArrowRight size={15} /></Link></div>;

  return <div className="checkout-page">
    <div className="checkout-title"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href="/cart">Bag</Link><span>/</span><span>Checkout</span></div><span className="eyebrow">ALMOST YOURS</span><h1>Let’s make it<br /><em>official.</em></h1><p>Thoughtfully chosen. Carefully packed. On its way to you.</p></div>
    <div className="checkout-layout">
      <form id="checkout-form" className="checkout-form" onSubmit={submit}>
        {databaseStatus === "connected" && !commerceConfigured && <div className="checkout-error"><CircleAlert size={16} />Checkout is disabled until verified delivery terms are saved in <Link href="/admin/settings">store settings</Link>.</div>}
        {!checkoutRateReady && settings.currency !== COD_PAYMENT_CURRENCY && <div className="checkout-error"><CircleAlert size={16} />A current PKR cash-on-delivery rate is unavailable. Checkout is paused rather than guessing the payable amount. Refresh the page or configure an admin fallback rate.</div>}
        <section className="checkout-form-section"><div className="checkout-section-title"><span>01</span><div><h2>Where to find you</h2><p>We’ll use these details to identify and manage your order.</p></div></div><div className="form-grid">
          <label className="form-field form-field-full">Full name<input autoComplete="name" required minLength={2} maxLength={160} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Your name" /></label>
          <label className="form-field">Email address<input autoComplete="email" type="email" required value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} placeholder="you@example.com" /></label>
          <label className="form-field">Phone number<input autoComplete="tel" type="tel" required minLength={5} value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="+92 300 0000000" /></label>
        </div></section>
        <section className="checkout-form-section"><div className="checkout-section-title"><span>02</span><div><h2>Where it’s going</h2><p>Delivery details, just as they should be.</p></div></div><div className="form-grid">
          <label className="form-field form-field-full">Street address<input autoComplete="address-line1" required minLength={4} value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} placeholder="House, street, area" /></label>
          <label className="form-field form-field-full">Apartment, suite or landmark <small>Optional</small><input autoComplete="address-line2" value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} placeholder="A little more detail" /></label>
          <label className="form-field">City<input autoComplete="address-level2" required value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} placeholder="Lahore" /></label>
          <label className="form-field">Province / region<input autoComplete="address-level1" required value={address.region} onChange={(event) => setAddress({ ...address, region: event.target.value })} placeholder="Punjab" /></label>
          <label className="form-field">Postal code<input autoComplete="postal-code" required value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} placeholder="54000" /></label>
          <label className="form-field">Country<input autoComplete="country-name" required value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })} placeholder="Pakistan" /></label>
        </div></section>
        <section className="checkout-form-section"><div className="checkout-section-title"><span>03</span><div><h2>How you’ll pay</h2><p>Clear, simple and no surprises.</p></div></div><div className="payment-option"><span className="payment-option-icon"><Truck size={18} /></span><div><strong>Cash on delivery · payable in PKR</strong><small>Pay {paymentTotal === null ? "the confirmed amount" : formatMoney(paymentTotal, COD_PAYMENT_CURRENCY)} when your order arrives. No card details needed.</small></div><span className="payment-option-selected"><Check size={13} /></span></div><div className="payment-notice"><CircleAlert size={14} />Displayed prices are estimates in {displayCurrency}. The confirmed COD amount is collected in PKR. Online card payments are not connected to this store.</div></section>
        {couponCode && <div className="checkout-applied-coupon"><Check size={16} /><span><strong>{couponCode}</strong> applied — you save {formatPrice(discount)}.</span><button type="button" onClick={() => { setCouponCode(""); setCouponInput(""); }}>Remove</button></div>}
        {error && <div className="checkout-error"><CircleAlert size={16} />{error}</div>}
        <button className="button button-primary checkout-submit" type="submit" disabled={checkoutDisabled}>{busy ? "Placing your order…" : `Place order · ${paymentTotal === null ? "PKR amount unavailable" : formatMoney(paymentTotal, COD_PAYMENT_CURRENCY)}`}<ArrowRight size={15} /></button>
        <p className="checkout-terms">By placing this order, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      </form>
      <aside className="checkout-sidebar"><div className="checkout-summary-card"><span className="eyebrow">YOUR EDIT, READY</span><h2>Order summary</h2><div className="checkout-product-lines">{lines.map(({ line, product }) => <div className="checkout-product-line" key={`${product.id}${line.variant || ""}`}><div className="checkout-product-thumb"><ProductMedia product={product} /><span>{line.quantity}</span></div><div><strong>{product.name}</strong><small>{product.variants[0] || product.sku}</small></div><b>{formatPrice(product.price * line.quantity)}</b></div>)}</div>
        {coupons.some((item) => item.active && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now())) && <form className="coupon-form" onSubmit={applyCoupon}><label htmlFor="coupon-code">Have a good code?</label><div><input id="coupon-code" value={couponInput} onChange={(event) => { setCouponInput(event.target.value); setCouponError(""); }} placeholder="Enter your code" /><button type="submit" aria-label="Apply discount code">Apply</button></div>{couponError && <small className="coupon-error">{couponError}</small>}</form>}
        <div className="summary-row"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><div className="summary-row"><span>Delivery</span><strong>{deliveryLabel}</strong></div>{discount > 0 && <div className="summary-row summary-discount"><span>Offer · {couponCode}</span><strong>−{formatPrice(discount)}</strong></div>}
        <div className="summary-divider" /><div className="summary-row summary-total"><span>Estimated total · {displayCurrency}</span><strong>{formatPrice(total)}</strong></div><div className="summary-row summary-payment-total"><span>Pay on delivery · PKR</span><strong>{paymentTotal === null ? "Unavailable" : formatMoney(paymentTotal, COD_PAYMENT_CURRENCY)}</strong></div>
        {settings.currency !== COD_PAYMENT_CURRENCY && exchangeRateUpdatedAt[COD_PAYMENT_CURRENCY] && <small className="checkout-rate-note">Rate 1 {settings.currency} = {formatMoney(checkoutRate || 0, COD_PAYMENT_CURRENCY)} · updated {new Date(exchangeRateUpdatedAt[COD_PAYMENT_CURRENCY]).toLocaleString()}.</small>}
        <div className="checkout-guarantees"><span><ShieldCheck size={14} />No card details required</span><span><PackageCheck size={14} />{databaseStatus === "connected" ? "Order recorded in the live store" : "Preview only · this device"}</span></div></div><Link href="/shipping-returns" className="checkout-help-link">Need delivery details? <ArrowRight size={13} /></Link></aside>
    </div>
  </div>;
}
export function OrderConfirmationPage({ orderId, preview }: { orderId: string; preview: boolean }) {
  const { orders, products } = useStore();
  const order = orders.find((item) => item.id === orderId || item.orderNo === orderId);
  const orderCurrency = order && isCurrencyCode(order.currency) ? order.currency : null;
  const paymentCurrency = order && isCurrencyCode(order.paymentCurrency) ? order.paymentCurrency : null;
  const baseAmount = (amount: number) => orderCurrency
    ? formatMoney(amount, orderCurrency)
    : `${amount.toLocaleString()} · currency not recorded`;
  return <div className="confirmation-page">
    <div className="confirmation-mark"><Check size={26} /></div>
    <span className="eyebrow">{preview ? "PREVIEW ORDER · THIS DEVICE ONLY" : "YOUR ORDER IS IN"}</span>
    <h1>Good choice.<br /><em>It’s official.</em></h1>
    <p className="confirmation-lede">{order ? `Thank you, ${order.customer.name.split(" ")[0]}. We’ve received your order and its details are ready below.` : "We’ve received your order. Keep your confirmation details handy."}</p>
    <div className="confirmation-card">
      <div className="confirmation-card-header"><span>ORDER NUMBER</span><strong>{order?.orderNo || orderId}</strong><span>{order?.createdAt ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</span></div>
      {order ? <>
        <div className="confirmation-items">{order.items.map((item) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          return <div className="confirmation-item" key={`${item.productId}${item.variant || ""}`}>
            <div className="confirmation-item-image">{product && <ProductMedia product={product} />}</div>
            <span><strong>{item.name}</strong><small>Qty {item.quantity}{item.variant ? ` · ${item.variant}` : ""}</small></span>
            <b>{baseAmount(item.price * item.quantity)}</b>
          </div>;
        })}</div>
        <div className="confirmation-totals">
          <div><span>Subtotal</span><strong>{baseAmount(order.subtotal)}</strong></div>
          <div><span>Delivery</span><strong>{order.shipping ? baseAmount(order.shipping) : "Complimentary"}</strong></div>
          {order.discount > 0 && <div><span>Offer</span><strong>−{baseAmount(order.discount)}</strong></div>}
          <div className="confirmation-total"><span>Base total · {orderCurrency || "currency not recorded"}</span><strong>{baseAmount(order.total)}</strong></div>
          {order.paymentTotal !== undefined && paymentCurrency && <div className="confirmation-payment-snapshot">
            <div><span>Cash to pay on delivery · {paymentCurrency}</span><strong>{formatMoney(order.paymentTotal, paymentCurrency)}</strong></div>
            {order.fxRate && orderCurrency && <small>Rate snapshot: 1 {orderCurrency} = {Number(order.fxRate).toPrecision(7)} {paymentCurrency}{order.fxRateAt ? ` · captured ${new Date(order.fxRateAt).toLocaleString()}` : ""}{order.fxRateSource === "fallback" ? " · admin fallback" : ""}.</small>}
          </div>}
        </div>
        <div className="confirmation-delivery"><MapPin size={15} /><span><strong>Delivering to</strong><small>{order.address.line1}, {order.address.city}, {order.address.region}, {order.address.country}</small></span></div>
      </> : <div className="confirmation-items"><p>Your full receipt is available in your account if you signed in, or in the browser where you placed this order.</p></div>}
    </div>
    <div className="confirmation-status-note"><PackageCheck size={16} /><span><strong>{preview ? "Preview mode" : "Cash on delivery"}</strong><small>{preview ? "This order is stored only in this browser and was not sent to a live store database." : "Your order is recorded in the store. Use order tracking or contact the store for updates."}</small></span></div>
    <div className="confirmation-actions"><Link href="/order-tracking" className="button button-outline">Track an order <ArrowRight size={14} /></Link><Link href="/shop" className="button button-primary">Back to the edit <ArrowRight size={14} /></Link></div>
  </div>;
}
export function OrderTrackingPage() {
  const { orders } = useStore();
  const [orderNo, setOrderNo] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Record<string, string | number | null> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const localResult = (order: Order) => {
    const recorded = orderRecordedSnapshot(order);
    return {
      orderNo: order.orderNo,
      status: order.status,
      trackingNumber: order.trackingNumber || "",
      createdAt: order.createdAt,
      total: recorded?.amount ?? null,
      currency: recorded?.currency || "",
    };
  };

  const lookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const query = new URLSearchParams({ order: orderNo.trim(), email: email.trim() });
      const response = await fetch(`/api/orders/track?${query.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.order) setResult(data.order);
      else {
        const local = orders.find((order) => order.orderNo.toLowerCase() === orderNo.trim().toLowerCase() && order.customer.email.toLowerCase() === email.trim().toLowerCase());
        if (local) setResult(localResult(local));
        else setError(data?.error || "We couldn’t find an order using those details.");
      }
    } catch {
      const local = orders.find((order) => order.orderNo.toLowerCase() === orderNo.trim().toLowerCase() && order.customer.email.toLowerCase() === email.trim().toLowerCase());
      if (local) setResult(localResult(local));
      else setError("Tracking is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const totalCurrency = typeof result?.currency === "string" && isCurrencyCode(result.currency) ? result.currency : null;
  const totalLabel = typeof result?.total === "number" && totalCurrency
    ? formatMoney(result.total, totalCurrency)
    : typeof result?.total === "number" ? `${result.total.toLocaleString()} · currency not recorded` : "Not recorded";
  return <div className="tracking-page"><div className="tracking-hero"><span className="eyebrow">WE’LL HELP YOU FIND IT</span><h1>Where’s it<br /><em>on its way?</em></h1><p>Enter the order number and email address used at checkout. We’ll show the latest status we have.</p><div className="tracking-steps"><span className="tracking-step-active"><i>01</i>PLACED</span><span><i>02</i>PREPARING</span><span><i>03</i>ON ITS WAY</span><span><i>04</i>DELIVERED</span></div></div>
    <div className="tracking-content"><form className="tracking-form" onSubmit={lookup}><label>Order number<input required value={orderNo} onChange={(event) => setOrderNo(event.target.value)} placeholder="NX-261114-ABCDE" autoCapitalize="characters" /></label><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>{error && <div className="inline-error"><CircleAlert size={14} />{error}</div>}<button className="button button-primary" disabled={busy}>{busy ? "Looking it up…" : "Find my order"}<ArrowRight size={14} /></button><small>For your privacy, both details must match the order.</small></form>
      {result && <div className="tracking-result"><span className="eyebrow">ORDER FOUND</span><strong>{String(result.orderNo)}</strong><div className={`order-status status-${String(result.status)}`}>{String(result.status).replaceAll("_", " ")}</div><dl><div><dt>Placed</dt><dd>{new Date(String(result.createdAt)).toLocaleDateString()}</dd></div><div><dt>Total{totalCurrency === COD_PAYMENT_CURRENCY ? " · cash on delivery" : ""}</dt><dd>{totalLabel}</dd></div>{result.trackingNumber && <div><dt>Tracking reference</dt><dd>{String(result.trackingNumber)}</dd></div>}</dl><p>For a change to an order or a delivery question, <Link href="/contact">talk to our team</Link>.</p></div>}
    </div>
  </div>;
}
export function CustomerAccountPage({ mode }: { mode: "account" | "login" | "register" | "orders" }) {
  const router = useRouter();
  const { orders: localOrders, notify, displayCurrency, setDisplayCurrency } = useStore();
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const authReady = supabaseAuthConfigured();

  const loadOrders = useCallback(async (supabase: NonNullable<ReturnType<typeof getBrowserSupabase>>) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    try {
      const response = await fetch("/api/account/orders", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (response.ok && Array.isArray(result.orders)) setCustomerOrders(result.orders as Order[]);
    } catch { /* Keep local order history available if the account API is offline. */ }
  }, []);

  const restoreCurrencyPreference = useCallback(async (
    supabase: NonNullable<ReturnType<typeof getBrowserSupabase>>,
    userId: string,
    metadata: Record<string, unknown>,
  ) => {
    let saved = metadata.preferred_currency;
    try {
      const { data } = await supabase.from("nexvoro_customer_profiles").select("preferred_currency").eq("id", userId).maybeSingle();
      if (data && typeof data.preferred_currency === "string" && isCurrencyCode(data.preferred_currency)) saved = data.preferred_currency;
    } catch { /* Auth metadata and local storage remain the fallback. */ }
    if (typeof saved === "string" && isCurrencyCode(saved)) setDisplayCurrency(saved);
  }, [setDisplayCurrency]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) { setLoading(false); return; }
    let disposed = false;
    const applyUser = (authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) => {
      if (disposed) return;
      if (!authUser) {
        setUser(null);
        return;
      }
      const metadata = authUser.user_metadata || {};
      setUser({ id: authUser.id, email: authUser.email, user_metadata: metadata });
      setName(String(metadata.full_name || ""));
      setEmail(authUser.email || "");
      setPhone(String(metadata.phone || ""));
      void restoreCurrencyPreference(supabase, authUser.id, metadata);
      void loadOrders(supabase);
    };
    void supabase.auth.getUser().then(({ data }) => {
      applyUser(data.user ? {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      } : null);
      if (!disposed) setLoading(false);
    }).catch(() => { if (!disposed) setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ? {
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata,
      } : null);
    });
    return () => { disposed = true; listener.subscription.unsubscribe(); };
  }, [loadOrders, restoreCurrencyPreference]);

  const authAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setAuthError("");
    setMessage("");
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setBusy(false);
      setAuthError("Secure customer accounts are not configured. Add the Supabase public URL and publishable key to enable sign in.");
      return;
    }
    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim(), phone: phone.trim(), preferred_currency: displayCurrency },
          emailRedirectTo: `${window.location.origin}/account`,
        },
      });
      setBusy(false);
      if (error) setAuthError(error.message);
      else if (data.session && data.user) {
        setUser({ id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata || {} });
        setMessage("Your account is ready. Welcome to NEXVORO.");
      } else setMessage("Check your inbox to confirm your email, then sign in.");
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setAuthError(error.message);
    else if (data.user) router.push("/account");
  };

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setAuthError("");
    const supabase = getBrowserSupabase();
    if (!supabase || !user) { setBusy(false); return; }
    const { error: profileError } = await supabase.from("nexvoro_customer_profiles").upsert({
      id: user.id,
      email: email || user.email || "",
      full_name: name.trim(),
      phone: phone.trim(),
      preferred_currency: displayCurrency,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (profileError) {
      setAuthError(profileError.message);
      setBusy(false);
      return;
    }
    const { data, error: authErrorResult } = await supabase.auth.updateUser({
      data: { full_name: name.trim(), phone: phone.trim(), preferred_currency: displayCurrency },
    });
    if (authErrorResult) {
      setAuthError(authErrorResult.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    setMessage("Your profile and currency preference have been saved.");
    notify("Profile saved.");
    if (data.user) setUser({ id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata || {} });
  };

  const signOut = async () => {
    const supabase = getBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setCustomerOrders([]);
    notify("You’ve been signed out.", "info");
    router.push("/");
  };

  const orders = customerOrders.length
    ? customerOrders
    : localOrders.filter((order) => order.customer.email.toLowerCase() === (user?.email || "").toLowerCase());
  if (loading && (mode === "account" || mode === "orders")) return <div className="account-loading"><span className="loading-orbit" /><p>Opening your account…</p></div>;

  if ((mode === "account" || mode === "orders") && user) return <div className="account-page">
    <div className="account-sidebar"><span className="eyebrow">YOUR NEXVORO</span><div className="account-avatar"><UserRound size={23} /></div><strong>{name || "Your account"}</strong><small>{user.email}</small><nav><Link className={mode === "account" ? "account-nav-active" : ""} href="/account">Profile</Link><Link className={mode === "orders" ? "account-nav-active" : ""} href="/orders">My orders</Link><Link href="/wishlist">Saved things</Link><button onClick={signOut}>Sign out</button></nav></div>
    <div className="account-main"><div className="account-main-heading"><span className="eyebrow">{mode === "orders" ? "YOUR ORDER HISTORY" : "THE DETAILS, KEPT SIMPLE"}</span><h1>{mode === "orders" ? "My orders." : `Hello, ${(name || "there").split(" ")[0]}.`}</h1><p>{mode === "orders" ? "Every order, in one considered place." : "Update your details and keep your next delivery close."}</p></div>
      {mode === "account" ? <form className="account-profile-form" onSubmit={updateProfile}><label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email address<input type="email" value={email} disabled /><small>Email changes are managed through your sign-in provider.</small></label><label>Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Add a contact number" /></label><CurrencySelector variant="account" /><small className="currency-preference-save-note">Save your profile to keep this display preference across devices. It never changes your payable checkout currency.</small>{message && <div className="form-success"><Check size={15} />{message}</div>}{authError && <div className="inline-error"><CircleAlert size={14} />{authError}</div>}<button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}<ArrowRight size={14} /></button></form> : <div className="account-orders-list">{orders.length ? orders.map((order) => <article className="account-order-card" key={order.id}><div><span className="eyebrow">{order.orderNo}</span><strong>{new Date(order.createdAt).toLocaleDateString()}</strong><small>{order.items.length} {order.items.length === 1 ? "item" : "items"} · {formatOrderTotal(order)}</small>{order.paymentTotal !== undefined && isCurrencyCode(order.paymentCurrency) && isCurrencyCode(order.currency) && order.paymentCurrency !== order.currency && <small>Base total · {order.currency}: {formatMoney(order.total, order.currency)}</small>}</div><span className={`order-status status-${order.status}`}>{order.status}</span><Link href={`/order-tracking?order=${encodeURIComponent(order.orderNo)}`} className="text-link">Track <ArrowRight size={13} /></Link></article>) : <div className="account-no-orders"><PackageCheck size={19} /><strong>No orders here yet.</strong><p>Your next good find will show up here.</p><Link href="/shop" className="text-link">Find something good <ArrowRight size={13} /></Link></div>}</div>}
    </div>
  </div>;

  if ((mode === "account" || mode === "orders") && !user) return <div className="account-gate"><div className="account-gate-copy"><span className="eyebrow">YOUR ACCOUNT, YOUR WAY</span><h1>Good to have<br /><em>you back.</em></h1><p>Sign in to see your profile and orders. Checkout also works as a guest.</p><Link href="/shop" className="text-link"><ArrowLeft size={14} />Keep browsing</Link></div><div className="account-gate-card"><span className="eyebrow">SIGN IN TO CONTINUE</span><h2>Pick up where you left off.</h2>{!authReady && <div className="account-config-note"><ShieldCheck size={16} /><span>Secure customer accounts are not configured on this deployment yet. Checkout as a guest is available.</span></div>}<AuthForm mode="login" onSubmit={authAction} email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} error={authError} message={message} /><Link href="/register" className="account-switch-link">New to NEXVORO? <strong>Create an account</strong></Link></div></div>;

  return <div className="auth-page"><div className="auth-editorial"><span className="eyebrow">{mode === "register" ? "A GOOD THING STARTS HERE" : "WELCOME BACK TO THE EDIT"}</span><h1>{mode === "register" ? <>Make it<br /><em>your NEXVORO.</em></> : <>Good to have<br /><em>you back.</em></>}</h1><p>Your account keeps your details, orders and saved things close — and keeps your password safe with Supabase Auth.</p><div className="auth-editorial-stamp"><LockKeyhole size={16} /><span>YOUR PASSWORD IS HANDLED BY SECURE AUTH<br />NEXVORO NEVER STORES PASSWORDS</span></div></div><div className="auth-form-panel"><span className="eyebrow">{mode === "register" ? "CREATE YOUR ACCOUNT" : "SIGN IN"}</span><h2>{mode === "register" ? "A few details, then you’re in." : "Let’s get you back in."}</h2>{!authReady && <div className="account-config-note"><ShieldCheck size={16} /><span>Customer account sign-in is ready when Supabase Auth is configured. You can still shop and check out as a guest.</span></div>}<AuthForm mode={mode === "register" ? "register" : "login"} onSubmit={authAction} name={name} setName={setName} phone={phone} setPhone={setPhone} email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} error={authError} message={message} /><div className="auth-switch">{mode === "register" ? <>Already have an account? <Link href="/login">Sign in</Link></> : <>New to NEXVORO? <Link href="/register">Create your account</Link></>}</div><Link href="/shop" className="auth-back-link"><ArrowLeft size={13} />Continue as a guest</Link></div></div>;
}

function formatOrderTotal(order: Order) {
  if (order.paymentTotal !== undefined && isCurrencyCode(order.paymentCurrency)) return formatMoney(order.paymentTotal, order.paymentCurrency);
  if (isCurrencyCode(order.currency)) return `${formatMoney(order.total, order.currency)} · base total`;
  return `${order.total.toLocaleString()} · currency not recorded`;
}

function AuthForm({ mode, onSubmit, name, setName, phone, setPhone, email, setEmail, password, setPassword, busy, error, message }: {
  mode: "login" | "register";
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  name?: string; setName?: (value: string) => void;
  phone?: string; setPhone?: (value: string) => void;
  email: string; setEmail: (value: string) => void;
  password: string; setPassword: (value: string) => void;
  busy: boolean; error: string; message: string;
}) {
  return <form className="auth-form" onSubmit={onSubmit}>
    {mode === "register" && <><label>Full name<input autoComplete="name" required minLength={2} maxLength={160} value={name || ""} onChange={(event) => setName?.(event.target.value)} placeholder="Your name" /></label><label>Phone number <small>Optional</small><input autoComplete="tel" value={phone || ""} onChange={(event) => setPhone?.(event.target.value)} placeholder="+92 300 0000000" /></label></>}
    <label>Email address<input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
    <label>Password<input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
    {error && <div className="inline-error"><CircleAlert size={14} />{error}</div>}{message && <div className="form-success"><Check size={15} />{message}</div>}
    <button type="submit" className="button button-primary" disabled={busy}>{busy ? "One moment…" : mode === "register" ? "Create account" : "Sign in"}<ArrowRight size={14} /></button>
    <small>Your password is stored and verified only by the configured Supabase Auth project.</small>
  </form>;
}
