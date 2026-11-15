export const CURRENCIES = Object.freeze([
  { code: "USD", name: "US Dollar", locale: "en-US" },
  { code: "PKR", name: "Pakistani Rupee", locale: "en-PK" },
  { code: "GBP", name: "British Pound", locale: "en-GB" },
  { code: "EUR", name: "Euro", locale: "en-IE" },
  { code: "AED", name: "UAE Dirham", locale: "en-AE" },
  { code: "SAR", name: "Saudi Riyal", locale: "en-SA" },
  { code: "CAD", name: "Canadian Dollar", locale: "en-CA" },
  { code: "AUD", name: "Australian Dollar", locale: "en-AU" },
  { code: "INR", name: "Indian Rupee", locale: "en-IN" },
  { code: "TRY", name: "Turkish Lira", locale: "en-TR" },
  { code: "CNY", name: "Chinese Yuan", locale: "en-CN" },
  { code: "JPY", name: "Japanese Yen", locale: "en-JP" },
  { code: "MYR", name: "Malaysian Ringgit", locale: "en-MY" },
  { code: "SGD", name: "Singapore Dollar", locale: "en-SG" },
  { code: "BDT", name: "Bangladeshi Taka", locale: "en-BD" },
]);

export const CURRENCY_CODES = Object.freeze(CURRENCIES.map(({ code }) => code));
export const COD_PAYMENT_CURRENCY = "PKR";

const supportedCodes = new Set(CURRENCY_CODES);
const zeroDecimalCurrencies = new Set(["JPY"]);

/** @param {unknown} value */
export function isCurrencyCode(value) {
  return typeof value === "string" && supportedCodes.has(value);
}

/** @param {unknown} rates */
export function sanitizeRates(rates) {
  if (!rates || typeof rates !== "object" || Array.isArray(rates)) return {};
  return Object.fromEntries(Object.entries(rates)
    .filter(([code, value]) => isCurrencyCode(code) && typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1e12));
}

/** @param {number} amount @param {string} from @param {string} to @param {string} base @param {Record<string, number>} rates */
export function convertBetweenCurrencies(amount, from, to, base, rates) {
  if (!Number.isFinite(amount) || amount < 0 || !isCurrencyCode(from) || !isCurrencyCode(to) || !isCurrencyCode(base)) return null;
  if (from === to) return amount;
  const cleanRates = sanitizeRates(rates);
  const fromRate = from === base ? 1 : cleanRates[from];
  const toRate = to === base ? 1 : cleanRates[to];
  if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) return null;
  return amount / fromRate * toRate;
}

/** @param {number} rate @param {number} basisPoints */
export function applyRateAdjustment(rate, basisPoints = 0) {
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(basisPoints) || basisPoints < -5000 || basisPoints > 50000) return null;
  const adjusted = rate * (1 + basisPoints / 10000);
  return Number.isFinite(adjusted) && adjusted > 0 ? adjusted : null;
}

/** @param {number} value @param {string} currency */
export function roundCurrencyAmount(value, currency) {
  if (!Number.isFinite(value)) return 0;
  const digits = zeroDecimalCurrencies.has(currency) ? 0 : 2;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** @param {number} value @param {string} currency */
export function formatMoney(value, currency = "PKR") {
  const option = CURRENCIES.find((item) => item.code === currency);
  try {
    return new Intl.NumberFormat(option?.locale || "en-US", {
      style: "currency",
      currency: isCurrencyCode(currency) ? currency : "PKR",
      maximumFractionDigits: zeroDecimalCurrencies.has(currency) ? 0 : 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency} ${Math.round(Number.isFinite(value) ? value : 0).toLocaleString()}`;
  }
}

/**
 * Return a safely formatted store price. When a quote is missing, keep the base
 * currency label rather than presenting an unconverted amount as the preference.
 * @param {number} amount
 * @param {string} baseCurrency
 * @param {string} displayCurrency
 * @param {Record<string, number>} rates
 */
export function formatDisplayMoney(amount, baseCurrency, displayCurrency, rates) {
  const converted = convertBetweenCurrencies(amount, baseCurrency, displayCurrency, baseCurrency, rates);
  return converted === null
    ? { text: formatMoney(amount, baseCurrency), amount, currency: baseCurrency, converted: false }
    : { text: formatMoney(roundCurrencyAmount(converted, displayCurrency), displayCurrency), amount: roundCurrencyAmount(converted, displayCurrency), currency: displayCurrency, converted: displayCurrency !== baseCurrency };
}
