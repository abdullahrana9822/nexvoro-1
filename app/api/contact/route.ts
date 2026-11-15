import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/server/db";
import { readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(140),
  email: z.string().trim().email().max(180),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(10).max(3000),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin message rejected." }, { status: 403 });
  const body = await readJsonBody(request, 16_000);
  if (!body.ok) return NextResponse.json({ error: body.reason === "too_large" ? "Contact request is too large." : "Invalid contact request." }, { status: body.reason === "too_large" ? 413 : 400 });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Please complete the contact form with a valid email and message." }, { status: 400 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Contact messages are unavailable because the live store database is not connected." }, { status: 503 });
  const { error } = await db.from("nexvoro_contact_messages").insert({
    name: parsed.data.name, email: parsed.data.email.toLowerCase(), subject: parsed.data.subject, message: parsed.data.message,
  });
  if (error) return NextResponse.json({ error: "Your message could not be saved right now." }, { status: 503 });
  return NextResponse.json({ ok: true, persisted: true }, { status: 201 });
}
