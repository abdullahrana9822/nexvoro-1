"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, CircleHelp, Mail, MessageCircle, Phone, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { useStore } from "@/lib/store";

export function AboutPage() {
  return <div className="content-page about-page"><div className="about-hero"><span className="eyebrow">A BETTER KIND OF TECH STORE</span><h1>More than the<br /><em>next new thing.</em></h1><p>NEXVORO is a point of view on technology: useful, beautifully considered and chosen for how it fits into real life.</p><span className="about-hero-number">N / 01</span></div><div className="about-intro-grid"><div><span className="eyebrow">WHERE INNOVATION MEETS LIFESTYLE</span><h2>Good technology<br /><em>should feel natural.</em></h2></div><div><p>Not louder. Not more complicated. Just thoughtfully selected products that help you do more of what matters — create, connect, move, play and make home feel like yours.</p><p>That’s the idea behind NEXVORO. We bring the practical and the beautiful into the same frame, then make the details easy to understand so you can choose with confidence.</p><Link href="/shop" className="text-link">Explore the NEXVORO edit <ArrowRight size={14} /></Link></div></div><div className="about-principles"><article><span>01 / CLARITY</span><h3>Less noise.<br />Better choices.</h3><p>We organize products around how you live, not just an endless list of specs.</p></article><article><span>02 / CURIOSITY</span><h3>Stay open<br />to what’s next.</h3><p>From useful everyday essentials to new ideas worth exploring, we keep the edit moving.</p></article><article><span>03 / CARE</span><h3>Details matter.<br />People more.</h3><p>Clear information, straightforward checkout and a helpful human when you need one.</p></article></div><div className="about-callout"><Sparkles size={23} /><div><span className="eyebrow">THE NEXVORO PROMISE TO OURSELVES</span><p>Buy less, choose well.<br /><em>Let the good things earn their place.</em></p></div><Link href="/contact" className="button button-outline">Say hello <ArrowRight size={14} /></Link></div></div>;
}

export function ContactPage() {
  const { settings, notify, commerceConfigured } = useStore();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, consent: true, website: "" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your message could not be sent.");
      if (result.persisted !== true) throw new Error("Your message was not saved. Please try again when the store is available.");
      setSent(true); setForm({ name: "", email: "", subject: "", message: "" });
      notify("Your note is with our team.", "success");
    } catch (e) { setError(e instanceof Error ? e.message : "Your message could not be sent."); }
    finally { setBusy(false); }
  };
  return <div className="contact-page"><div className="contact-hero"><span className="eyebrow">A HUMAN, ON THE OTHER SIDE</span><h1>We’re listening.<br /><em>Really.</em></h1><p>Questions, a product thought or just want to say hello? Send a note. We’ll get back to you as soon as we can.</p><div className="contact-hero-line"><MessageCircle size={16} />Thoughtful answers, from a real person.</div></div><div className="contact-layout"><form className="contact-form" onSubmit={submit}><div className="contact-form-heading"><span className="eyebrow">WRITE US A NOTE</span><h2>What’s on your mind?</h2></div>{sent ? <div className="contact-success"><div><Check size={23} /></div><strong>Thank you for writing.</strong><p>Your message has been recorded. We appreciate you getting in touch.</p><button type="button" className="text-link" onClick={() => setSent(false)}>Send another note <ArrowRight size={13} /></button></div> : <><div className="form-grid"><label className="form-field">Your name<input required minLength={2} maxLength={140} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="How should we call you?" /></label><label className="form-field">Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label><label className="form-field form-field-full">Subject<input required minLength={2} maxLength={160} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="A quick note about…" /></label><label className="form-field form-field-full">Your message<textarea required minLength={10} maxLength={3000} rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="We’re all ears…" /></label></div>{error && <div className="inline-error">{error}</div>}<label className="contact-consent"><input type="checkbox" required /><span>I agree to be contacted about this message. See our <Link href="/privacy">privacy policy</Link>.</span></label><button className="button button-primary" disabled={busy}>{busy ? "Sending…" : "Send your note"}<ArrowRight size={14} /></button></>}</form><aside className="contact-aside"><div className="contact-aside-card"><span className="eyebrow">THE DETAILS</span><div><Mail size={17} /><span><small>EMAIL</small>{settings.supportEmail ? <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> : <strong>Store email not configured</strong>}</span></div>{settings.contactPhone && <div><Phone size={17} /><span><small>PHONE</small><a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a></span></div>}<div><MessageCircle size={17} /><span><small>MESSAGES</small><strong>Use the note form above</strong></span></div><div><Truck size={17} /><span><small>DELIVERY</small><strong>{commerceConfigured ? "Calculated at checkout" : "Delivery terms are being prepared"}</strong></span></div><Link href="/faq" className="contact-aside-link">A question we’ve heard before? <ArrowRight size={13} /></Link></div><div className="contact-faq-note"><CircleHelp size={19} /><p>Looking for something quick? Our <Link href="/faq">frequently asked questions</Link> might have the answer.</p></div></aside></div></div>;
}

const faqItems = [
  ["What is NEXVORO?", "NEXVORO is a thoughtfully curated electronics storefront. We bring everyday technology, work tools, audio, gaming and home products together in one considered edit."],
  ["How do I place an order?", "Add a product to your bag, review your order, enter a delivery address and choose cash on delivery. The checkout validates current catalog prices and available stock when the database is connected."],
  ["Which payment methods do you accept?", "Cash on delivery is currently available. Online card processing is not connected, so we never ask for card details on this site."],
  ["How much does delivery cost?", "Delivery is complimentary above the current store threshold. Below that, the delivery fee shown in the store settings is added at checkout. The final amount is shown before you place the order."],
  ["How can I track my order?", "Open Order Tracking and enter the order number and email address used at checkout. Signed-in customers can also view orders from My Account."],
  ["Can I return a product?", "Contact the store team with your order number and product details before sending anything back. Return eligibility depends on the condition of the item and the published Shipping & Returns terms."],
  ["Can I change the store’s look?", "Yes. Open Theme Studio to preview eight complete visual experiences. Your chosen theme is saved in this browser. The store may turn customer theme switching off in its settings."],
  ["Are product reviews verified?", "Reviews submitted through the product pages are held for moderation. Only approved reviews appear on the store, and we do not invent ratings or customer testimonials."],
  ["Why does the admin dashboard say preview mode?", "When the store database is not connected, cart, theme and admin changes are stored in this browser only. A Supabase connection is required for shared, production-wide records."],
  ["I need more help. How do I reach you?", "Send a note through Contact Us or email the support address shown there. Please include your order number if your question is about an existing order."],
];

export function FAQPage() {
  const { commerceConfigured } = useStore();
  const [open, setOpen] = useState(0);
  return <div className="faq-page"><div className="faq-hero"><span className="eyebrow">A FEW GOOD ANSWERS</span><h1>Good questions.<br /><em>Clear answers.</em></h1><p>We believe the details should be easy to find. If something’s missing, <Link href="/contact">we’re here</Link>.</p></div><div className="faq-content"><div className="faq-side-note"><span className="eyebrow">THE QUICK EDIT</span><strong>{String(faqItems.length).padStart(2,"0")}</strong><span>ANSWERS, ALL IN ONE PLACE</span><Link href="/contact" className="text-link">Ask us directly <ArrowRight size={13} /></Link></div><div className="faq-accordion">{faqItems.map(([question, answer], index) => <article className={`faq-item ${open === index ? "faq-item-open" : ""}`} key={question}><button onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}><span><i>{String(index + 1).padStart(2,"0")}</i>{question}</span><b>{open === index ? "−" : "+"}</b></button>{open === index && <p>{question === "How much does delivery cost?" && !commerceConfigured ? "Delivery pricing is still being configured. When available, the final fee and any free-delivery threshold will appear before you submit an order." : answer}</p>}</article>)}</div></div><div className="faq-contact-strip"><span>Still need a hand?</span><Link href="/contact" className="button button-primary">Talk to us <ArrowRight size={14} /></Link></div></div>;
}

const policyContent = {
  privacy: {
    eyebrow: "YOUR INFORMATION, HANDLED WITH CARE", title: <>Privacy,<br /><em>plainly.</em></>, updated: "Last reviewed: November 2026",
    intro: "We collect only the details needed to run the store, respond to you and fulfill orders. We do not sell personal information.",
    sections: [
      ["What we collect", "When you place an order, we collect the name, email, phone number and delivery address you provide, together with the products and order status. If you create an account, Supabase Auth manages your sign-in and the store keeps a profile linked to that account. Newsletter subscribers and contact messages are stored only when those services are configured."],
      ["How we use it", "We use order and contact details to process requests, send order updates, answer questions and protect the store from abuse. Product reviews are moderated before publication. We do not store payment-card information; online card payments are not connected."],
      ["Where information is stored", "In a configured production deployment, store data is kept in the connected Supabase database. In an unconfigured preview, cart, theme choice, and demo orders may be kept in this browser’s local storage. Do not enter real customer information into a preview environment."],
      ["Your choices", "You can change your browser’s theme and clear its local storage. You can unsubscribe from marketing messages using the instructions in the email. For a request to review or correct store information, contact the store with the email address used for the request."],
      ["Security and retention", "The admin service key is server-only, admin routes use a signed HttpOnly session, and customer passwords are handled by Supabase Auth. Orders are retained as business records; products can be archived without removing order history."],
      ["Contact", "Questions about privacy can be sent through the Contact page. The store operator should confirm this notice against the jurisdictions in which NEXVORO sells before launch."],
    ],
  },
  terms: {
    eyebrow: "A CLEAR AGREEMENT", title: <>The terms,<br /><em>without the fog.</em></>, updated: "Last reviewed: November 2026",
    intro: "These terms explain the basics of using the NEXVORO storefront. By placing an order, you agree to the terms shown here and to the applicable store policies.",
    sections: [
      ["Catalog and availability", "Product descriptions, images, specifications, prices and availability are provided to help you make a considered choice. Product photographs may be editorial representations. Stock can change; a checkout request is confirmed only after it is accepted by the store. The store operator should verify product specifications and market prices before fulfillment."],
      ["Orders and payment", "The storefront currently offers cash on delivery. Online card processing is not connected and no card details are requested. An order placed in preview mode is saved only in the current browser and is not sent to a live fulfillment system."],
      ["Promotions", "Discount codes are subject to their configured dates, usage limits and eligibility. Only the total displayed at checkout applies to an order. Offers may be changed or withdrawn before an order is accepted."],
      ["Returns and support", "Return requests are handled under the current Shipping & Returns policy. Please contact the store before sending an item back and include your order reference."],
      ["Responsible use", "Do not attempt to access admin tools, interfere with store services or submit false or abusive content. Reviews are moderated and may be withheld if they do not relate to a genuine product experience."],
      ["Updates", "The store operator may update these terms to reflect changes to services or local requirements. The operator should obtain appropriate legal review before operating a live store."],
    ],
  },
  shipping: {
    eyebrow: "THE LAST MILE, MADE CLEAR", title: <>Shipping &amp;<br /><em>returns.</em></>, updated: "Store rules are configurable in Admin → Settings",
    intro: "Here’s how delivery charges and returns work on this storefront. The final delivery fee is shown before you place an order.",
    sections: [
      ["Delivery charges", "Orders at or above the current free-delivery threshold qualify for complimentary delivery. Orders below that threshold include the configured delivery fee. These values can be edited by an authorized store admin and are shown in the customer’s selected store currency."],
      ["Delivery details", "Please provide a complete address and a reachable phone number. Once an order is accepted, the store can add a tracking reference from the Orders dashboard. Delivery timing depends on the destination and carrier; the store should confirm a reliable estimate before dispatch."],
      ["Cash on delivery", "Cash on delivery is the available payment method. Please have the order total ready when your parcel arrives. Online card payments are not connected."],
      ["Returns and exchanges", "Contact the store as soon as possible if an item is damaged, incorrect or not right for you. Include your order number and clear photographs where relevant. Do not send an item back before receiving return instructions. Eligibility depends on item condition, packaging and applicable local consumer law."],
      ["Refunds", "Refunds for accepted returns are coordinated by the store team using the original payment method where available, or another method agreed with the customer. The current checkout does not process online card payments."],
      ["Need help?", "Contact the team through Contact Us or the support details displayed there. The store operator should replace any general guidance here with its confirmed carrier, delivery window and return terms before accepting live orders."],
    ],
  },
};

export function PolicyPage({ kind }: { kind: "privacy" | "terms" | "shipping" }) {
  const { settings, displayCurrency } = useStore();
  const content = policyContent[kind];
  return <div className={`policy-page policy-page-${kind}`}><div className="policy-hero"><span className="eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.intro}</p><span className="policy-updated">{content.updated}</span></div><div className="policy-content"><div className="policy-table-of-contents"><span className="eyebrow">IN THIS POLICY</span>{content.sections.map(([heading], index) => <a href={`#policy-${index}`} key={heading}><i>{String(index + 1).padStart(2,"0")}</i>{heading}</a>)}</div><div className="policy-sections">{content.sections.map(([heading, text], index) => <section id={`policy-${index}`} key={heading}><span className="eyebrow">SECTION {String(index + 1).padStart(2,"0")}</span><h2>{heading}</h2><p>{text}</p></section>)}</div></div><div className="policy-contact-note"><ShieldCheck size={17} /><span><strong>Clarity matters.</strong><small>Questions about this page? <Link href="/contact">Get in touch</Link>.</small></span><span className="policy-currency">Base: {settings.currency} · Display estimate: {displayCurrency} · COD collected in PKR</span></div></div>;
}
