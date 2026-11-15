import { NextRequest, NextResponse } from "next/server";
import { isCurrencyCode } from "@/lib/currency.mjs";
import { getFxSnapshot, loadStoreFxSettings } from "@/lib/server/fx-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const settings = await loadStoreFxSettings();
    const requestedBase = request.nextUrl.searchParams.get("base");
    if (requestedBase && (!isCurrencyCode(requestedBase) || requestedBase !== settings.baseCurrency)) {
      return NextResponse.json({ error: "The requested base currency does not match the store price currency." }, {
        status: 409,
        headers: { "cache-control": "no-store" },
      });
    }
    const snapshot = await getFxSnapshot(settings);
    return NextResponse.json({
      ...snapshot,
      adjustmentBps: settings.adjustmentBps,
      cacheMinutes: settings.cacheMinutes,
      serverTime: new Date().toISOString(),
    }, {
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Exchange rates are temporarily unavailable." }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
