import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRateAdjustment,
  convertBetweenCurrencies,
  formatDisplayMoney,
  isCurrencyCode,
  roundCurrencyAmount,
  sanitizeRates,
} from "../lib/currency.mjs";
import {
  itemAmountInCurrency,
  orderAmountInCurrency,
  orderRecordedSnapshot,
  summarizeSalesByCurrency,
} from "../lib/order-currency.mjs";

test("only supported currency codes and positive finite rates are accepted", () => {
  assert.equal(isCurrencyCode("PKR"), true);
  assert.equal(isCurrencyCode("XYZ"), false);
  assert.deepEqual(sanitizeRates({ PKR: 280, EUR: 0.92, XYZ: 5, USD: Infinity, GBP: -2 }), {
    PKR: 280,
    EUR: 0.92,
  });
});

test("conversions use the store base rate table and refuse missing pairs", () => {
  const rates = { PKR: 280, EUR: 0.92, JPY: 150 };
  assert.equal(convertBetweenCurrencies(100, "USD", "EUR", "USD", rates), 92);
  assert.equal(convertBetweenCurrencies(100, "USD", "PKR", "USD", rates), 28000);
  assert.equal(convertBetweenCurrencies(10, "EUR", "PKR", "USD", rates), 10 / 0.92 * 280);
  assert.equal(convertBetweenCurrencies(10, "USD", "GBP", "USD", rates), null);
  assert.equal(convertBetweenCurrencies(-1, "USD", "PKR", "USD", rates), null);
});

test("rate adjustments and currency precision are bounded", () => {
  assert.equal(applyRateAdjustment(2, 100), 2.02);
  assert.equal(applyRateAdjustment(2, 50_001), null);
  assert.equal(roundCurrencyAmount(123.7, "JPY"), 124);
  assert.equal(roundCurrencyAmount(1.005, "PKR"), 1.01);
});

test("display fallback stays labelled in the base currency when a rate is missing", () => {
  const basePrice = formatDisplayMoney(1200, "PKR", "EUR", {});
  assert.equal(basePrice.currency, "PKR");
  assert.equal(basePrice.amount, 1200);
  assert.equal(basePrice.converted, false);
  assert.match(basePrice.text, /PKR|Rs/i);

  const converted = formatDisplayMoney(100, "USD", "EUR", { EUR: 0.9 });
  assert.equal(converted.currency, "EUR");
  assert.equal(converted.amount, 90);
  assert.equal(converted.converted, true);
});

test("saved order and item totals are only returned in their recorded currency", () => {
  const order = {
    total: 100,
    currency: "USD",
    paymentTotal: 28000,
    paymentCurrency: "PKR",
    fxRate: 280,
  };
  assert.equal(orderAmountInCurrency(order, "PKR"), 28000);
  assert.equal(orderAmountInCurrency(order, "USD"), 100);
  assert.equal(itemAmountInCurrency(order, { price: 2.5, quantity: 2 }, "USD"), 5);
  assert.equal(itemAmountInCurrency(order, { price: 2.5, quantity: 2 }, "PKR"), 1400);
  assert.equal(itemAmountInCurrency(order, { price: 2.5, quantity: 2 }, "EUR"), null);
  assert.equal(orderAmountInCurrency({ total: 75, currency: "EUR" }, "EUR"), 75);
  assert.equal(orderAmountInCurrency({ total: 75 }, "EUR"), null);
});

test("tracking pairs each amount with the currency from its own complete snapshot", () => {
  assert.deepEqual(orderRecordedSnapshot({
    total: 100,
    currency: "USD",
    paymentTotal: 28000,
    paymentCurrency: "PKR",
  }), { amount: 28000, currency: "PKR" });
  assert.deepEqual(orderRecordedSnapshot({
    total: 100,
    currency: "USD",
    paymentCurrency: "PKR",
  }), { amount: 100, currency: "USD" });
  assert.deepEqual(orderRecordedSnapshot({ total: 100 }), { amount: 100, currency: null });
  assert.equal(orderRecordedSnapshot({}), null);
});

test("sales summaries keep currencies separate and exclude cancelled, refunded, and unrecorded amounts", () => {
  const summary = summarizeSalesByCurrency([
    { status: "pending", total: 100, currency: "USD", paymentTotal: 28000, paymentCurrency: "PKR" },
    { status: "completed", total: 50, currency: "EUR", paymentTotal: 14000, paymentCurrency: "PKR" },
    { status: "processing", total: 18, currency: "USD", paymentTotal: 20, paymentCurrency: "USD" },
    { status: "pending", total: 9 },
    { status: "cancelled", total: 500, currency: "USD", paymentTotal: 500, paymentCurrency: "PKR" },
    { status: "refunded", total: 400, currency: "USD", paymentTotal: 400, paymentCurrency: "PKR" },
    { status: "pending", total: 10, currency: "USD", paymentCurrency: "PKR" },
  ]);
  assert.deepEqual(summary.rows, [
    { currency: "EUR", amount: 50, orders: 1 },
    { currency: "PKR", amount: 42000, orders: 2 },
    { currency: "USD", amount: 130, orders: 3 },
  ]);
  assert.equal(summary.unrecordedOrders, 1);
});
