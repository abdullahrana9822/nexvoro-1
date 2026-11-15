import "server-only";
import { CURRENCY_CODES, COD_PAYMENT_CURRENCY, applyRateAdjustment, isCurrencyCode, sanitizeRates } from "@/lib/currency.mjs";
import { getDatabase } from "@/lib/server/db";

type FxSource = "live" | "fallback" | "stale" | "identity";
type CachedProviderRates = {
  rates: Record<string, number>;
  provider: string;
  providerUpdatedAt: string;
  fetchedAt: string;
};
type StoreFxSettings = {
  baseCurrency: string;
  fallbackRates: Record<string, number>;
  adjustmentBps: number;
  cacheMinutes: number;
  settingsUpdatedAt?: string;
};
type FxSnapshot = {
  base: string;
  rates: Record<string, number>;
  rateSources: Record<string, FxSource>;
  rateUpdatedAt: Record<string, string>;
  fetchedAt: string | null;
  provider: string;
  source: "live" | "fallback" | "mixed" | "stale" | "unavailable";
  stale: boolean;
};

type ServerCache = { providerRates: Map<string, CachedProviderRates> };
const globalForFx = globalThis as typeof globalThis & { __nexvoroFxCache?: ServerCache };
const cache = globalForFx.__nexvoroFxCache ??= { providerRates: new Map() };
const DEFAULT_BASE_CURRENCY = "PKR";
const DEFAULT_CACHE_MINUTES = 60;
const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;

function normalizedSettings(payload: unknown, updatedAt?: string): StoreFxSettings {
  const data = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const currency = typeof data.currency === "string" && isCurrencyCode(data.currency) ? data.currency : DEFAULT_BASE_CURRENCY;
  const fallbackRates = sanitizeRates(data.fxFallbackRates);
  const adjustment = Number(data.fxAdjustmentBps ?? 0);
  const cacheMinutes = Number(data.fxCacheTtlMinutes ?? DEFAULT_CACHE_MINUTES);
  return {
    baseCurrency: currency,
    fallbackRates,
    adjustmentBps: Number.isInteger(adjustment) && adjustment >= -5000 && adjustment <= 50000 ? adjustment : 0,
    cacheMinutes: Number.isInteger(cacheMinutes) && cacheMinutes >= 1 && cacheMinutes <= 1440 ? cacheMinutes : DEFAULT_CACHE_MINUTES,
    settingsUpdatedAt: updatedAt,
  };
}

export async function loadStoreFxSettings(): Promise<StoreFxSettings> {
  const db = getDatabase();
  if (!db) return normalizedSettings({ currency: DEFAULT_BASE_CURRENCY });
  const { data, error } = await db.from("nexvoro_store_settings").select("payload,updated_at").eq("id", "store").maybeSingle();
  if (error) throw new Error("Store FX settings are unavailable.");
  return normalizedSettings(data?.payload, data?.updated_at || undefined);
}

function rateUrl(base: string) {
  const template = process.env.NEXVORO_FX_API_URL;
  if (!template) return `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
  const raw = template.replaceAll("{base}", base).replaceAll("{BASE}", base);
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("The configured exchange-rate endpoint must use HTTPS.");
  return url.toString();
}

function providerTimestamp(data: Record<string, unknown>, fetchedAt: string) {
  const unix = Number(data.time_last_update_unix);
  if (Number.isFinite(unix) && unix > 0) return new Date(unix * 1000).toISOString();
  if (typeof data.time_last_update_utc === "string") {
    const parsed = new Date(data.time_last_update_utc);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  if (typeof data.date === "string") {
    const parsed = new Date(`${data.date}T00:00:00Z`);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return fetchedAt;
}

async function fetchProviderRates(base: string): Promise<CachedProviderRates> {
  const url = rateUrl(base);
  const headers = new Headers({ accept: "application/json" });
  const apiKey = process.env.NEXVORO_FX_API_KEY;
  if (apiKey) headers.set("authorization", `Bearer ${apiKey}`);
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Exchange-rate provider returned ${response.status}.`);
  const data = await response.json() as Record<string, unknown>;
  if (data.result !== undefined && data.result !== "success") throw new Error("Exchange-rate provider did not return a successful result.");
  const responseBase = typeof data.base_code === "string" ? data.base_code : typeof data.base === "string" ? data.base : base;
  if (responseBase !== base) throw new Error("Exchange-rate provider returned an unexpected base currency.");
  const rates = sanitizeRates(data.rates);
  if (Object.keys(rates).length < 2) throw new Error("Exchange-rate provider returned no usable rate table.");
  const fetchedAt = new Date().toISOString();
  return {
    rates,
    provider: new URL(url).hostname,
    providerUpdatedAt: providerTimestamp(data, fetchedAt),
    fetchedAt,
  };
}

function combineSnapshot(settings: StoreFxSettings, providerEntry: CachedProviderRates | undefined, sourceIsStale: boolean): FxSnapshot {
  const base = settings.baseCurrency;
  const rates: Record<string, number> = { [base]: 1 };
  const rateSources: Record<string, FxSource> = { [base]: "identity" };
  const rateUpdatedAt: Record<string, string> = {};
  const providerUpdatedAt = providerEntry?.providerUpdatedAt || "";
  const fetchedAt = providerEntry?.fetchedAt || null;

  for (const code of CURRENCY_CODES) {
    if (code === base) continue;
    const liveRate = providerEntry?.rates[code];
    const configuredFallback = settings.fallbackRates[code];
    let rawRate: number | undefined;
    let rateSource: FxSource | undefined;
    let updatedAt = "";

    if (!sourceIsStale && Number.isFinite(liveRate) && liveRate! > 0) {
      rawRate = liveRate;
      rateSource = "live";
      updatedAt = providerUpdatedAt;
    } else if (Number.isFinite(configuredFallback) && configuredFallback! > 0) {
      rawRate = configuredFallback;
      rateSource = "fallback";
      updatedAt = settings.settingsUpdatedAt || "";
    } else if (Number.isFinite(liveRate) && liveRate! > 0 && providerEntry) {
      const age = Date.now() - new Date(providerEntry.providerUpdatedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age <= MAX_RATE_AGE_MS) {
        rawRate = liveRate;
        rateSource = "stale";
        updatedAt = providerUpdatedAt;
      }
    }

    if (rawRate === undefined || !rateSource) continue;
    const adjusted = applyRateAdjustment(rawRate, settings.adjustmentBps);
    if (adjusted === null) continue;
    rates[code] = adjusted;
    rateSources[code] = rateSource;
    if (updatedAt) rateUpdatedAt[code] = updatedAt;
  }

  const sources = Object.values(rateSources).filter((source) => source !== "identity");
  let source: FxSnapshot["source"] = "unavailable";
  if (sources.includes("stale")) source = "stale";
  else if (sources.includes("fallback") && sources.includes("live")) source = "mixed";
  else if (sources.includes("fallback")) source = "fallback";
  else if (sources.includes("live")) source = "live";
  return {
    base,
    rates,
    rateSources,
    rateUpdatedAt,
    fetchedAt,
    provider: providerEntry?.provider || "",
    source,
    stale: source === "stale",
  };
}

export async function getFxSnapshot(settings: StoreFxSettings, options: { forceRefresh?: boolean } = {}): Promise<FxSnapshot> {
  const base = settings.baseCurrency;
  const existing = cache.providerRates.get(base);
  const ttlMs = settings.cacheMinutes * 60_000;
  const existingFetchedAt = existing ? new Date(existing.fetchedAt).getTime() : 0;
  const fresh = Boolean(existing && Date.now() - existingFetchedAt < ttlMs);
  let entry = existing;
  let isStale = !fresh;

  if (!fresh || options.forceRefresh) {
    try {
      entry = await fetchProviderRates(base);
      cache.providerRates.set(base, entry);
      isStale = false;
    } catch {
      entry = existing;
      isStale = Boolean(existing);
    }
  }

  return combineSnapshot(settings, entry, isStale);
}

export async function getCheckoutFxQuote(settings: StoreFxSettings) {
  const snapshot = await getFxSnapshot(settings);
  const rate = settings.baseCurrency === COD_PAYMENT_CURRENCY ? 1 : snapshot.rates[COD_PAYMENT_CURRENCY];
  const source: FxSource | undefined = settings.baseCurrency === COD_PAYMENT_CURRENCY
    ? "identity"
    : snapshot.rateSources[COD_PAYMENT_CURRENCY];
  if (!Number.isFinite(rate) || rate! <= 0 || !source || source === "stale") return null;
  return {
    baseCurrency: settings.baseCurrency,
    paymentCurrency: COD_PAYMENT_CURRENCY,
    rate: rate!,
    source,
    updatedAt: settings.baseCurrency === COD_PAYMENT_CURRENCY
      ? new Date().toISOString()
      : snapshot.rateUpdatedAt[COD_PAYMENT_CURRENCY] || null,
    provider: source === "live" ? snapshot.provider : source,
  };
}
