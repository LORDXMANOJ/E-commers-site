import { storage } from "./storage";
import type { CartProduct, Size } from "./types";

/**
 * The guest bag lives in localStorage until sign-in, when it is merged into the server cart.
 * A tiny external store so React components (useSyncExternalStore) and the auth flow share it.
 * Each line is one size of a product; product.stock is the stock of that size.
 */
export type GuestLine = { variantId: string; size: Size; quantity: number; product: CartProduct };

// v2: lines are keyed by size. Bags saved by the old, size-less version are simply ignored.
const KEY = "aurelle.guestCart.v2";
const listeners = new Set<() => void>();
let cache: GuestLine[] = read();

function read(): GuestLine[] {
  const data = storage.getJSON<unknown>(KEY, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (l): l is GuestLine =>
      typeof l === "object" &&
      l !== null &&
      typeof l.variantId === "string" &&
      typeof l.size === "string" &&
      Number.isInteger(l.quantity) &&
      l.quantity > 0 &&
      typeof l.product === "object",
  );
}

function write(lines: GuestLine[]) {
  cache = lines;
  if (lines.length) storage.setJSON(KEY, lines);
  else storage.remove(KEY);
  listeners.forEach((l) => l());
}

// Keep tabs in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = read();
      listeners.forEach((l) => l());
    }
  });
}

export const guestCart = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  snapshot: () => cache,
  add(product: CartProduct, variantId: string, size: Size, quantity: number) {
    const existing = cache.find((l) => l.variantId === variantId);
    const next = Math.min((existing?.quantity ?? 0) + quantity, product.stock);
    write(
      existing
        ? cache.map((l) => (l.variantId === variantId ? { ...l, quantity: next, product } : l))
        : [...cache, { variantId, size, quantity: next, product }],
    );
    return next;
  },
  setQuantity(variantId: string, quantity: number) {
    write(cache.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)));
  },
  remove(variantId: string) {
    write(cache.filter((l) => l.variantId !== variantId));
  },
  clear() {
    write([]);
  },
};
