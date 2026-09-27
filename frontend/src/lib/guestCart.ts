import { storage } from "./storage";
import type { CartProduct } from "./types";

/**
 * The guest bag lives in localStorage until sign-in, when it is merged into the server cart.
 * A tiny external store so React components (useSyncExternalStore) and the auth flow share it.
 */
export type GuestLine = { productId: string; quantity: number; product: CartProduct };

const KEY = "aurelle.guestCart";
const listeners = new Set<() => void>();
let cache: GuestLine[] = read();

function read(): GuestLine[] {
  const data = storage.getJSON<unknown>(KEY, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (l): l is GuestLine =>
      typeof l === "object" && l !== null && typeof l.productId === "string" && Number.isInteger(l.quantity) && l.quantity > 0 && typeof l.product === "object",
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
  add(product: CartProduct, quantity: number) {
    const existing = cache.find((l) => l.productId === product.id);
    const next = Math.min((existing?.quantity ?? 0) + quantity, product.stock);
    write(
      existing
        ? cache.map((l) => (l.productId === product.id ? { ...l, quantity: next, product } : l))
        : [...cache, { productId: product.id, quantity: next, product }],
    );
    return next;
  },
  setQuantity(productId: string, quantity: number) {
    write(cache.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
  },
  remove(productId: string) {
    write(cache.filter((l) => l.productId !== productId));
  },
  clear() {
    write([]);
  },
};
