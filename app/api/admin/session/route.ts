import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, adminConfigured, getAdminSession } from "@/lib/server/admin-auth";
import { databaseConfigured, getDatabase } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  let configured = adminConfigured();
  const db = configured ? getDatabase() : null;
  if (db) {
    try {
      const { error } = await db.from("nexvoro_admin_users").select("id").limit(1);
      configured = !error;
    } catch {
      configured = false;
    }
  }
  return NextResponse.json({
    authenticated: Boolean(session),
    configured,
    database: databaseConfigured(),
    role: session?.role || null,
    displayName: session?.displayName || null,
    username: session?.username || null,
    mustChangePassword: session?.mustChangePassword || false,
  }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  return response;
}
