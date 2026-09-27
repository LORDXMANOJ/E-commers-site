/** All amounts are integer paise. ₹1 = 100 paise. */
export const SHIPPING = {
  STANDARD: { label: "Standard", eta: "4–6 business days", pricePaise: 9_900 },
  EXPRESS: { label: "Express", eta: "1–2 business days", pricePaise: 24_900 },
} as const;

/** Standard shipping is free at or above this subtotal (₹2,999). */
export const FREE_SHIPPING_THRESHOLD_PAISE = 299_900;

export type ShippingMethodKey = keyof typeof SHIPPING;

export function shippingFor(method: ShippingMethodKey, subtotalPaise: number): number {
  if (method === "STANDARD" && subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE) return 0;
  return SHIPPING[method].pricePaise;
}
