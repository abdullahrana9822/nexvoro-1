import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDatabase, mapDatabaseOrder } from "@/lib/server/db";
import { getCheckoutFxQuote, loadStoreFxSettings } from "@/lib/server/fx-rates";
import { CURRENCY_CODES } from "@/lib/currency.mjs";
import { makeId } from "@/lib/utils";
import { readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  customer: z.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(180), phone: z.string().trim().min(5).max(60) }),
  address: z.object({
    line1: z.string().trim().min(4).max(180), line2: z.string().trim().max(180).optional(),
    city: z.string().trim().min(2).max(100), region: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().min(2).max(20), country: z.string().trim().min(2).max(80),
  }),
  items: z.array(z.object({ productId: z.string().min(1).max(120), quantity: z.number().int().min(1).max(20), variant: z.string().max(120).optional() })).min(1).max(40),
  coupon: z.string().max(40).optional(),
  expectedBaseCurrency: z.string().regex(/^[A-Z]{3}$/),
  expectedFxRate: z.number().finite().positive().max(1_000_000_000),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin order request rejected." }, { status: 403 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Store order database is not configured." }, { status: 503 });
  const body = await readJsonBody(request, 80_000);
  if (!body.ok) return NextResponse.json({ error: body.reason === "too_large" ? "Order request is too large." : "Invalid order request." }, { status: body.reason === "too_large" ? 413 : 400 });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check your delivery details." }, { status: 400 });
  let fxQuote: Awaited<ReturnType<typeof getCheckoutFxQuote>> = null;
  try {
    const fxSettings = await loadStoreFxSettings();
    if (!CURRENCY_CODES.includes(parsed.data.expectedBaseCurrency) || parsed.data.expectedBaseCurrency !== fxSettings.baseCurrency) {
      return NextResponse.json({ error: "The store price currency changed. Review the updated checkout totals and try again." }, { status: 409 });
    }
    fxQuote = await getCheckoutFxQuote(fxSettings);
  } catch {
    return NextResponse.json({ error: "The checkout currency rate could not be verified. Please try again." }, { status: 503 });
  }
  if (!fxQuote) return NextResponse.json({ error: "A current or explicitly configured PKR rate is required for cash-on-delivery checkout." }, { status: 503 });
  const rateDifference = Math.abs(parsed.data.expectedFxRate - fxQuote.rate) / fxQuote.rate;
  if (!Number.isFinite(rateDifference) || rateDifference > 0.005) {
    return NextResponse.json({ error: "The exchange-rate estimate changed. Please review the refreshed PKR amount before placing your order." }, { status: 409 });
  }
  let customerId: string | null = null;
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (accessToken) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !publicKey) return NextResponse.json({ error: "Customer sign-in is not configured." }, { status: 401 });
    const authClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !authData.user || authData.user.email?.toLowerCase() !== parsed.data.customer.email.toLowerCase()) {
      return NextResponse.json({ error: "Sign in with the email address used for this order." }, { status: 401 });
    }
    customerId = authData.user.id;
  }
  const normalizedItems = parsed.data.items.reduce<typeof parsed.data.items>((all, item) => {
    const previous = all.find((line) => line.productId === item.productId && line.variant === item.variant);
    if (previous) previous.quantity += item.quantity;
    else all.push({ ...item });
    return all;
  }, []);
  if (normalizedItems.some((item) => item.quantity > 20)) return NextResponse.json({ error: "Maximum quantity for an item is 20." }, { status: 400 });

  const { data, error } = await db.rpc("nexvoro_place_order", {
    p_payload: {
      id: makeId("order"),
      customer: parsed.data.customer,
      customerId,
      address: parsed.data.address,
      items: normalizedItems,
      coupon: parsed.data.coupon?.trim().toUpperCase() || null,
      paymentCurrency: fxQuote.paymentCurrency,
      fxRate: fxQuote.rate,
      fxRateAt: fxQuote.updatedAt || new Date().toISOString(),
      fxRateSource: fxQuote.source,
    },
  });
  if (error) {
    const message = /not available|not enough stock|empty|address|valid name|quantity|delivery terms/i.test(error.message)
      ? error.message
      : "We could not place this order. Please check your bag and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, order: mapDatabaseOrder(data as Record<string, unknown>) }, { status: 201, headers: { "cache-control": "no-store" } });
}
