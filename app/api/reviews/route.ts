import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/server/db";
import { makeId } from "@/lib/utils";
import { readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  productId: z.string().min(1).max(120),
  name: z.string().trim().min(2).max(100),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(10).max(1200),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin review request rejected." }, { status: 403 });
  const body = await readJsonBody(request, 16_000);
  if (!body.ok) return NextResponse.json({ error: body.reason === "too_large" ? "Review is too large." : "Invalid review request." }, { status: body.reason === "too_large" ? 413 : 400 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Review storage is not configured." }, { status: 503 });
  const parsed = reviewSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check your review." }, { status: 400 });
  const product = await db.from("nexvoro_products").select("id").eq("id", parsed.data.productId).eq("is_active", true).maybeSingle();
  if (product.error || !product.data) return NextResponse.json({ error: "This product is not available for review." }, { status: 404 });
  const review = { id: makeId("review"), product_id: parsed.data.productId, reviewer_name: parsed.data.name, rating: parsed.data.rating, title: parsed.data.title, body: parsed.data.body, is_approved: false };
  const result = await db.from("nexvoro_reviews").insert(review).select("*").single();
  if (result.error) return NextResponse.json({ error: "Review could not be saved." }, { status: 400 });
  return NextResponse.json({ ok: true, review: result.data }, { status: 201 });
}
