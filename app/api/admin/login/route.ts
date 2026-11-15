import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, adminCookieOptions, adminConfigured, createAdminToken, validateAdminKey } from "@/lib/server/admin-auth";
import { readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const loginSchema = z.object({ key: z.string().min(1).max(512) });
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientAddress(request: NextRequest) {
  const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return address?.slice(0, 128) || "unknown";
}

function pruneAttempts(now: number) {
  for (const [address, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(address);
  }
  while (attempts.size > 1000) attempts.delete(attempts.keys().next().value as string);
}

export async function POST(request: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Protected admin sign-in is not configured. Set ADMIN_ACCESS_KEY and SESSION_SECRET on the server." }, { status: 503 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin sign-in was rejected." }, { status: 403 });
  }
  const rawBody = await readJsonBody(request, 8_000);
  if (!rawBody.ok && rawBody.reason === "too_large") {
    return NextResponse.json({ error: "Sign-in request is too large." }, { status: 413, headers: { "cache-control": "no-store" } });
  }

  const now = Date.now();
  pruneAttempts(now);
  const address = clientAddress(request);
  const current = attempts.get(address);
  if (current && current.count >= MAX_ATTEMPTS && current.resetAt > now) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait before trying again." }, {
      status: 429,
      headers: { "retry-after": String(retryAfter), "cache-control": "no-store" },
    });
  }

  const body = loginSchema.safeParse(rawBody.ok ? rawBody.value : null);
  if (!body.success || !validateAdminKey(body.data?.key)) {
    const entry = current && current.resetAt > now ? current : { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
    attempts.set(address, { ...entry, count: entry.count + 1 });
    return NextResponse.json({ error: "The admin key was not accepted." }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  attempts.delete(address);
  const response = NextResponse.json({ ok: true, authenticated: true });
  response.cookies.set(ADMIN_COOKIE, createAdminToken(), adminCookieOptions());
  return response;
}
