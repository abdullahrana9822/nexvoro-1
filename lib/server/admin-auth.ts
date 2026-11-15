import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { databaseConfigured, getDatabase } from "@/lib/server/db";

export const ADMIN_COOKIE = "nexvoro_admin";
const SESSION_SECONDS = 60 * 60 * 8;
const TOKEN_VERSION = 1;

type AdminToken = {
  tokenVersion: number;
  userId: string;
  role: "SUPER_ADMIN";
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
};

export type AdminSession = {
  userId: string;
  displayName: string;
  username: string;
  role: "SUPER_ADMIN";
  mustChangePassword: boolean;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
};

export function adminConfigured() {
  return databaseConfigured() && (process.env.SESSION_SECRET || "").length >= 32;
}

function safeEqual(left: string, right: string) {
  const a = createHmac("sha256", "nexvoro-constant-time-compare").update(left).digest();
  const b = createHmac("sha256", "nexvoro-constant-time-compare").update(right).digest();
  return timingSafeEqual(a, b);
}

function sign(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "").update(payload).digest("base64url");
}

export function createAdminToken(admin: Pick<AdminSession, "userId" | "role" | "sessionVersion">, now = Date.now()) {
  const token: AdminToken = {
    tokenVersion: TOKEN_VERSION,
    userId: admin.userId,
    role: admin.role,
    sessionVersion: admin.sessionVersion,
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS * 1000,
  };
  const payload = Buffer.from(JSON.stringify(token)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function isAdminToken(value: unknown): value is AdminToken {
  if (!value || typeof value !== "object") return false;
  const token = value as Partial<AdminToken>;
  return token.tokenVersion === TOKEN_VERSION &&
    typeof token.userId === "string" && token.userId.length > 0 &&
    token.role === "SUPER_ADMIN" &&
    Number.isInteger(token.sessionVersion) && Number(token.sessionVersion) > 0 &&
    Number.isFinite(token.issuedAt) && Number.isFinite(token.expiresAt);
}

export async function getAdminSession(request: NextRequest): Promise<AdminSession | null> {
  if (!adminConfigured()) return null;
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isAdminToken(claims) || claims.expiresAt <= Date.now() || claims.issuedAt > Date.now() + 60_000) return null;

  const db = getDatabase();
  if (!db) return null;
  try {
    const { data: admin, error } = await db
      .from("nexvoro_admin_users")
      .select("id,display_name,username,role,must_change_password,session_version,disabled_at")
      .eq("id", claims.userId)
      .is("disabled_at", null)
      .maybeSingle();
    if (error || !admin || admin.role !== "SUPER_ADMIN" || admin.session_version !== claims.sessionVersion) return null;
    return {
      userId: String(admin.id),
      displayName: String(admin.display_name),
      username: String(admin.username),
      role: "SUPER_ADMIN",
      mustChangePassword: admin.must_change_password === true,
      sessionVersion: Number(admin.session_version),
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt,
    };
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
