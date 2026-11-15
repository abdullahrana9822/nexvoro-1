import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "nexvoro_admin";
const SESSION_SECONDS = 60 * 60 * 8;

type AdminSession = { role: "admin"; issuedAt: number; expiresAt: number };

export function adminConfigured() {
  return Boolean(
    (process.env.ADMIN_ACCESS_KEY || "").length >= 16 &&
    (process.env.SESSION_SECRET || "").length >= 32,
  );
}

function safeEqual(left: string, right: string) {
  const a = createHmac("sha256", "nexvoro-compare").update(left).digest();
  const b = createHmac("sha256", "nexvoro-compare").update(right).digest();
  return timingSafeEqual(a, b);
}

export function validateAdminKey(value: unknown) {
  if (!adminConfigured() || typeof value !== "string") return false;
  return safeEqual(value, process.env.ADMIN_ACCESS_KEY || "");
}

function sign(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "").update(payload).digest("base64url");
}

export function createAdminToken(now = Date.now()) {
  const session: AdminSession = {
    role: "admin",
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS * 1000,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function getAdminSession(request: NextRequest): AdminSession | null {
  if (!adminConfigured()) return null;
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (session.role !== "admin" || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}
