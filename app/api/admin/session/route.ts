import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, getAdminSession } from "@/lib/server/admin-auth";
import { databaseConfigured } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authenticated = Boolean(getAdminSession(request));
  return NextResponse.json({ authenticated, database: databaseConfigured() }, {
    status: authenticated ? 200 : 401,
    headers: { "cache-control": "no-store" },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  return response;
}
