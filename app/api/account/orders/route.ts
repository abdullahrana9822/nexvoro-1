import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDatabase, mapDatabaseOrder } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const db = getDatabase();
  if (!token || !url || !publicKey || !db) return NextResponse.json({ error: "Customer session or order database is unavailable." }, { status: 401 });
  const authClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Please sign in to view your orders." }, { status: 401 });
  const { data: rows, error } = await db.from("nexvoro_orders").select("*").eq("customer_id", authData.user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Order history is not available." }, { status: 503 });
  const ids = (rows || []).map((row) => row.id);
  const itemsResult = ids.length ? await db.from("nexvoro_order_items").select("*").in("order_id", ids) : { data: [], error: null };
  if (itemsResult.error) return NextResponse.json({ error: "Order details are not available." }, { status: 503 });
  const itemsByOrder = new Map<string, Record<string, unknown>[]>();
  (itemsResult.data || []).forEach((item) => {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push(item as Record<string, unknown>);
    itemsByOrder.set(item.order_id, list);
  });
  return NextResponse.json({ orders: (rows || []).map((row) => mapDatabaseOrder({ ...row, items: itemsByOrder.get(row.id) || [] })) }, { headers: { "cache-control": "no-store" } });
}
