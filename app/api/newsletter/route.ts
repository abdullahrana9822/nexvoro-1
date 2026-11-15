import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/server/db";
import { readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email().max(180),
  consent: z.literal(true),
  company: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin signup rejected." }, { status: 403 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: body.reason === "too_large" ? "Newsletter request is too large." : "Invalid newsletter request." }, { status: body.reason === "too_large" ? 413 : 400 });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and confirm newsletter consent." }, { status: 400 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Newsletter signup is unavailable because the live store database is not connected." }, { status: 503 });
  const { error } = await db.from("nexvoro_newsletter_subscribers").upsert({ email: parsed.data.email.toLowerCase(), source: "storefront" }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "We could not save your subscription right now." }, { status: 503 });
  return NextResponse.json({ ok: true, persisted: true }, { status: 201 });
}
