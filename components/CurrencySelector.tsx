"use client";

import { CURRENCIES } from "@/lib/currency.mjs";
import { useStore } from "@/lib/store";

type SelectorVariant = "header" | "mobile" | "footer" | "account";

function readableTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "";
}

function rateText(rate: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 6 }).format(rate) + ` ${currency}`;
  } catch {
    return `${rate.toPrecision(5)} ${currency}`;
  }
}

export default function CurrencySelector({ variant = "footer" }: { variant?: SelectorVariant }) {
  const {
    settings,
    displayCurrency,
    exchangeRates,
    exchangeRateSources,
    exchangeRateUpdatedAt,
    exchangeRateStatus,
    setDisplayCurrency,
  } = useStore();
  const isBaseCurrency = displayCurrency === settings.currency;
  const source = exchangeRateSources[displayCurrency];
  const rate = exchangeRates[displayCurrency];
  const updated = readableTime(exchangeRateUpdatedAt[displayCurrency]);
  let note = "Display estimate only. Cash on delivery is payable in PKR; online card payments are not connected.";
  if (!isBaseCurrency && typeof rate !== "number") {
    note = `Rates are unavailable. Prices remain in the store base currency (${settings.currency}). ${note}`;
  } else if (!isBaseCurrency) {
    const status = source === "fallback" ? "admin fallback" : source === "stale" ? "cached rate (may be stale)" : "live reference rate";
    note = `1 ${settings.currency} ≈ ${rateText(rate, displayCurrency)} · ${status}${updated ? ` · updated ${updated}` : ""}. ${note}`;
  } else if (exchangeRateStatus === "unavailable") {
    note = `Prices are in the store base currency (${settings.currency}). ${note}`;
  }

  const selector = (
    <select
      aria-label="Display currency"
      title="Choose a display currency. This does not change the currency collected at checkout."
      value={displayCurrency}
      onChange={(event) => setDisplayCurrency(event.target.value)}
    >
      {CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} — {currency.name}</option>)}
    </select>
  );

  return (
    <div className={`currency-selector currency-selector-${variant}`}>
      <label>
        <span>{variant === "header" ? "Currency" : "Display currency"}</span>
        {selector}
      </label>
      {variant !== "header" && <small className="currency-selector-note">{note}</small>}
    </div>
  );
}
