import { isCurrencyCode, roundCurrencyAmount } from "./currency.mjs";

/** @param {Record<string, any>} order */
export function orderPaymentCurrency(order) {
  return isCurrencyCode(order?.paymentCurrency) ? order.paymentCurrency : null;
}

/**
 * Select one safely paired order amount and currency for a receipt or tracker.
 * Prefer a complete payment snapshot, otherwise fall back to the base total.
 * @param {Record<string, any>} order
 */
export function orderRecordedSnapshot(order) {
  if (!order) return null;
  const paymentCurrency = orderPaymentCurrency(order);
  if (paymentCurrency && Number.isFinite(order.paymentTotal) && order.paymentTotal >= 0) {
    return { amount: order.paymentTotal, currency: paymentCurrency };
  }
  if (!Number.isFinite(order.total) || order.total < 0) return null;
  return { amount: order.total, currency: isCurrencyCode(order.currency) ? order.currency : null };
}

/**
 * Return a saved amount in the requested currency without relabelling a
 * base-currency total as a different payment currency.
 * @param {Record<string, any>} order
 * @param {string} currency
 */
export function orderAmountInCurrency(order, currency) {
  if (!order || !isCurrencyCode(currency)) return null;
  if (orderPaymentCurrency(order) === currency && Number.isFinite(order.paymentTotal) && order.paymentTotal >= 0) return order.paymentTotal;
  if (order.currency === currency && Number.isFinite(order.total) && order.total >= 0) return order.total;
  return null;
}

/** @param {Record<string, any>} order @param {string} currency */
export function itemAmountInCurrency(order, item, currency) {
  if (!order || !item || !isCurrencyCode(currency) || !Number.isFinite(item.price) || !Number.isFinite(item.quantity)) return null;
  const amount = item.price * item.quantity;
  if (order.currency === currency) return amount;
  if (orderPaymentCurrency(order) === currency && Number.isFinite(order.fxRate) && order.fxRate > 0) {
    return roundCurrencyAmount(amount * order.fxRate, currency);
  }
  return null;
}

/** @param {Record<string, any>[]} orders */
export function summarizeSalesByCurrency(orders) {
  const totals = new Map();
  let unrecordedOrders = 0;
  for (const order of orders) {
    if (order?.status === "cancelled" || order?.status === "refunded") continue;
    const snapshots = new Map();
    const paymentCurrency = orderPaymentCurrency(order);
    if (paymentCurrency && Number.isFinite(order.paymentTotal) && order.paymentTotal >= 0) {
      snapshots.set(paymentCurrency, order.paymentTotal);
    }
    const baseCurrency = isCurrencyCode(order?.currency) ? order.currency : null;
    if (baseCurrency && Number.isFinite(order.total) && order.total >= 0 && !snapshots.has(baseCurrency)) {
      snapshots.set(baseCurrency, order.total);
    }
    if (!snapshots.size) {
      unrecordedOrders += 1;
      continue;
    }
    for (const [currency, amount] of snapshots) {
      const saved = totals.get(currency) || { currency, amount: 0, orders: 0 };
      saved.amount += amount;
      saved.orders += 1;
      totals.set(currency, saved);
    }
  }
  return { rows: [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)), unrecordedOrders };
}
