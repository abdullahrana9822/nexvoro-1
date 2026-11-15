import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/server/admin-auth";
import { getDatabase } from "@/lib/server/db";
import { makeId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 5 * 1024 * 1024;
const bucket = "nexvoro-product-images";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Cross-origin admin upload rejected." }, { status: 403 });
  const admin = await getAdminSession(request);
  if (!admin || admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super Admin sign-in required." }, { status: 401, headers: { "cache-control": "no-store" } });
  if (admin.mustChangePassword) return NextResponse.json({ error: "Change the initial password before accessing admin tools." }, { status: 403, headers: { "cache-control": "no-store" } });
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_BYTES + 128_000) return NextResponse.json({ error: "Upload request is too large." }, { status: 413 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 413 });
  const contentType = file.type.toLowerCase();
  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "";
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 415 });
  const folder = String(form?.get("folder") || "products").replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "products";
  const objectPath = `${folder}/${Date.now()}-${makeId("img")}.${ext}`;
  const { error } = await db.storage.from(bucket).upload(objectPath, Buffer.from(await file.arrayBuffer()), { contentType, upsert: false, cacheControl: "31536000" });
  if (error) return NextResponse.json({ error: "Image upload failed. Check that the NEXVORO image bucket is available." }, { status: 400 });
  const { data } = db.storage.from(bucket).getPublicUrl(objectPath);
  return NextResponse.json({ ok: true, url: data.publicUrl, path: objectPath }, { status: 201 });
}
