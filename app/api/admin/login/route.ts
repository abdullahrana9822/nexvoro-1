import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ADMIN_COOKIE, adminCookieOptions, adminConfigured, createAdminToken } from "@/lib/server/admin-auth";
import { getDatabase } from "@/lib/server/db";
import { readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/),
  password: z.string().min(1).max(128).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const attempts = new Map<string, { count: number; resetAt: number }>();
let dummyHashPromise: Promise<string> | null = null;

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

function registerFailure(address: string, now: number) {
  const current = attempts.get(address);
  const entry = current && current.resetAt > now ? current : { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
  attempts.set(address, { ...entry, count: entry.count + 1 });
}

async function compareUnknownAccount(password: string) {
  dummyHashPromise ??= bcrypt.hash(randomBytes(32).toString("hex"), 12);
  await bcrypt.compare(password, await dummyHashPromise);
}

function failedLogin(address: string, now: number) {
  registerFailure(address, now);
  return NextResponse.json({ error: "The username or password was not accepted." }, {
    status: 401,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Admin sign-in is not configured. The approved Supabase project, admin migration, service-role key, and SESSION_SECRET are required." }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin sign-in was rejected." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const rawBody = await readJsonBody(request, 8_000);
  if (!rawBody.ok && rawBody.reason === "too_large") {
    return NextResponse.json({ error: "Sign-in request is too large." }, { status: 413, headers: { "cache-control": "no-store" } });
  }
  const body = loginSchema.safeParse(rawBody.ok ? rawBody.value : null);
  if (!body.success) {
    return NextResponse.json({ error: "Enter a valid username and password." }, { status: 400, headers: { "cache-control": "no-store" } });
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

  const db = getDatabase();
  if (!db) {
    return NextResponse.json({ error: "Admin sign-in is not configured for this deployment." }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  try {
    const usernameKey = body.data.username.toLowerCase();
    const { data: admin, error: lookupError } = await db
      .from("nexvoro_admin_users")
      .select("id,display_name,username,username_key,password_hash,role,must_change_password,session_version,failed_login_count,locked_until,disabled_at")
      .eq("username_key", usernameKey)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: "Admin account storage is unavailable. Apply the admin-accounts migration to the approved production Supabase project." }, {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }

    const passwordMatches = admin
      ? await bcrypt.compare(body.data.password, String(admin.password_hash))
      : await compareUnknownAccount(body.data.password).then(() => false);
    const accountLocked = Boolean(admin?.locked_until && Date.parse(String(admin.locked_until)) > now);
    if (!admin || !passwordMatches || admin.disabled_at || admin.role !== "SUPER_ADMIN" || accountLocked) {
      if (admin && !admin.disabled_at) await db.rpc("nexvoro_admin_record_failed_login", { p_admin_id: admin.id });
      return failedLogin(address, now);
    }

    const sessionVersion = Number(admin.session_version);
    if (!Number.isInteger(sessionVersion) || sessionVersion < 1) return failedLogin(address, now);
    const { data: activeAdmin, error: updateError } = await db
      .from("nexvoro_admin_users")
      .update({
        last_login_at: new Date().toISOString(),
        failed_login_count: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", admin.id)
      .eq("session_version", sessionVersion)
      .is("disabled_at", null)
      .select("id,role,session_version")
      .maybeSingle();
    if (updateError) {
      return NextResponse.json({ error: "The account could not be verified in the admin database." }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    if (!activeAdmin || activeAdmin.role !== "SUPER_ADMIN") return failedLogin(address, now);

    attempts.delete(address);
    const response = NextResponse.json({
      ok: true,
      authenticated: true,
      displayName: String(admin.display_name),
      username: String(admin.username),
      role: "SUPER_ADMIN",
      mustChangePassword: admin.must_change_password === true,
    }, { headers: { "cache-control": "no-store" } });
    response.cookies.set(ADMIN_COOKIE, createAdminToken({
      userId: String(activeAdmin.id),
      role: "SUPER_ADMIN",
      sessionVersion: Number(activeAdmin.session_version),
    }), adminCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Admin sign-in could not reach the production database." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
