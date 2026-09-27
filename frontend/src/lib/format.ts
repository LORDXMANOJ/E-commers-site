import type { OrderStatus, PaymentMethod, PaymentStatus, ShippingMethod } from "./types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

/** Paise (integer) → "₹12,990" (paise shown only when non-zero). */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? inr.format(rupees).replace(/\.00$/, "") : inr.format(rupees);
}

export const formatINRCompact = (paise: number) => inrCompact.format(paise / 100);

/** Rupees typed by a person → paise, avoiding float error ("129.9" → 12990). */
export function rupeesToPaise(value: string | number): number {
  const [whole, frac = ""] = String(value).trim().replace(/,/g, "").split(".");
  return Number(whole || 0) * 100 + Number((frac + "00").slice(0, 2));
}

export const paiseToRupeesInput = (paise: number | null | undefined) =>
  paise == null ? "" : paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export const discountPercent = (price: number, compareAt: number | null) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  COD: "Cash on delivery",
  CARD_SIMULATED: "Card (simulated)",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

export const SHIPPING_LABEL: Record<ShippingMethod, string> = { STANDARD: "Standard", EXPRESS: "Express" };

/** Mirrors the server's STATUS_TRANSITIONS so the admin UI only offers valid moves. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
