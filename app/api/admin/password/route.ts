import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ADMIN_COOKIE, adminCookieOptions, createAdminToken, getAdminSession } from "@/lib/server/admin-auth";
import { getDatabase } from "@/lib/server/db";
import { readJsonBody } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  newPassword: z.string().min(12).max(128).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin password change was rejected." }, { status: 403, headers: { "cache-control": "no-store" } });
  }

  const session = await getAdminSession(request);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super Admin sign-in required." }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const rawBody = await readJsonBody(request, 8_000);
  if (!rawBody.ok) {
    return NextResponse.json({ error: rawBody.reason === "too_large" ? "Password request is too large." : "Invalid password request." }, {
      status: rawBody.reason === "too_large" ? 413 : 400,
      headers: { "cache-control": "no-store" },
    });
  }
  const body = passwordSchema.safeParse(rawBody.value);
  if (!body.success) {
    return NextResponse.json({ error: "New passwords must be at least 12 characters and no more than 72 UTF-8 bytes." }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Admin database is not configured." }, { status: 503, headers: { "cache-control": "no-store" } });

  try {
    const { data: admin, error: readError } = await db
      .from("nexvoro_admin_users")
      .select("id,password_hash,role,session_version,disabled_at")
      .eq("id", session.userId)
      .is("disabled_at", null)
      .maybeSingle();
    if (readError || !admin || admin.role !== "SUPER_ADMIN" || Number(admin.session_version) !== session.sessionVersion) {
      return NextResponse.json({ error: "Admin account could not be verified." }, { status: 401, headers: { "cache-control": "no-store" } });
    }

    const currentMatches = await bcrypt.compare(body.data.currentPassword, String(admin.password_hash));
    if (!currentMatches) {
      return NextResponse.json({ error: "Current password was not accepted." }, { status: 401, headers: { "cache-control": "no-store" } });
    }
    if (await bcrypt.compare(body.data.newPassword, String(admin.password_hash))) {
      return NextResponse.json({ error: "Choose a different new password." }, { status: 400, headers: { "cache-control": "no-store" } });
    }

    const nextSessionVersion = Number(admin.session_version) + 1;
    const nextPasswordHash = await bcrypt.hash(body.data.newPassword, 12);
    const now = new Date().toISOString();
    const { data: updatedAdmin, error: updateError } = await db
      .from("nexvoro_admin_users")
      .update({
        password_hash: nextPasswordHash,
        must_change_password: false,
        session_version: nextSessionVersion,
        password_changed_at: now,
        updated_at: now,
      })
      .eq("id", session.userId)
      .eq("session_version", session.sessionVersion)
      .is("disabled_at", null)
      .select("id,role,session_version")
      .maybeSingle();
    if (updateError || !updatedAdmin || updatedAdmin.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Password could not be changed. Sign in again and retry." }, { status: 409, headers: { "cache-control": "no-store" } });
    }

    const response = NextResponse.json({ ok: true, mustChangePassword: false }, { headers: { "cache-control": "no-store" } });
    response.cookies.set(ADMIN_COOKIE, createAdminToken({
      userId: String(updatedAdmin.id),
      role: "SUPER_ADMIN",
      sessionVersion: Number(updatedAdmin.session_version),
    }), adminCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Password change could not reach the production database." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
