import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/db";
import { orderRecordedSnapshot } from "@/lib/order-currency.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderNo = (request.nextUrl.searchParams.get("order") || "").trim().toUpperCase();
  const email = (request.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (orderNo.length < 8 || email.length < 5 || !email.includes("@")) return NextResponse.json({ error: "Enter the order number and email used at checkout." }, { status: 400 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Order tracking is available in the browser preview only until the store database is connected." }, { status: 503 });
  const { data, error } = await db.from("nexvoro_orders").select("order_no,email,status,tracking_number,created_at,total,currency_code,payment_currency,payment_total").eq("order_no", orderNo).eq("email", email).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "We could not find an order matching those details." }, { status: 404 });
  const recorded = orderRecordedSnapshot({
    total: data.total == null ? undefined : Number(data.total),
    currency: data.currency_code,
    paymentTotal: data.payment_total == null ? undefined : Number(data.payment_total),
    paymentCurrency: data.payment_currency,
  });
  return NextResponse.json({ order: {
    orderNo: data.order_no,
    status: data.status,
    trackingNumber: data.tracking_number,
    createdAt: data.created_at,
    total: recorded?.amount ?? null,
    currency: recorded?.currency ?? null,
  } }, { headers: { "cache-control": "no-store" } });
}
