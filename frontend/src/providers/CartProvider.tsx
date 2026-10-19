import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { del, errorMessage, get, patch, post } from "../lib/api";
import { guestCart } from "../lib/guestCart";
import { sizeLabel } from "../lib/format";
import type { Cart, CartLine, Product, Variant } from "../lib/types";
import { useAuth } from "./AuthProvider";

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotalPaise: number;
  isLoading: boolean;
  isError: boolean;
  isGuest: boolean;
  refetch: () => void;
  add: (product: Product, variant: Variant, quantity?: number) => Promise<boolean>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  /** Variant ids with a request in flight. */
  pendingIds: Set<string>;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const authed = status === "authenticated";
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const guestLines = useSyncExternalStore(guestCart.subscribe, guestCart.snapshot);

  const server = useQuery({
    queryKey: ["cart"],
    queryFn: () => get<Cart>("/cart"),
    enabled: authed,
    staleTime: 30_000,
  });

  const track = useCallback(async <T,>(id: string, fn: () => Promise<T>) => {
    setPendingIds((s) => new Set(s).add(id));
    try {
      return await fn();
    } finally {
      setPendingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }, []);

  const mutate = useMutation({
    mutationFn: (fn: () => Promise<Cart>) => fn(),
    onSuccess: (cart) => qc.setQueryData(["cart"], cart),
  });

  const add = useCallback(
    async (product: Product, variant: Variant, quantity = 1) => {
      if (!authed) {
        const inBag = guestCart.snapshot().find((l) => l.variantId === variant.id)?.quantity ?? 0;
        const label = `${product.name} (${sizeLabel(variant.size)})`;
        if (inBag + quantity > variant.stock) {
          toast.error(variant.stock > 0 ? `Only ${variant.stock} of ${label} available` : `${label} is sold out`);
          return false;
        }
        const { id, name, slug, pricePaise, compareAtPaise, images } = product;
        guestCart.add(
          { id, name, slug, pricePaise, compareAtPaise, images, stock: variant.stock },
          variant.id,
          variant.size,
          quantity,
        );
        return true;
      }
      try {
        await track(variant.id, () =>
          mutate.mutateAsync(() => post<Cart>("/cart/items", { variantId: variant.id, quantity })),
        );
        return true;
      } catch (e) {
        toast.error(errorMessage(e));
        return false;
      }
    },
    [authed, mutate, track],
  );

  const setQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (!authed) return guestCart.setQuantity(variantId, quantity);
      try {
        await track(variantId, () => mutate.mutateAsync(() => patch<Cart>(`/cart/items/${variantId}`, { quantity })));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [authed, mutate, track],
  );

  const remove = useCallback(
    async (variantId: string) => {
      if (!authed) return guestCart.remove(variantId);
      try {
        await track(variantId, () => mutate.mutateAsync(() => del<Cart>(`/cart/items/${variantId}`)));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [authed, mutate, track],
  );

  const value = useMemo<CartContextValue>(() => {
    const lines: CartLine[] = authed
      ? (server.data?.items ?? [])
      : guestLines.map((l) => ({
          productId: l.product.id,
          variantId: l.variantId,
          size: l.size,
          quantity: l.quantity,
          product: l.product,
          available: l.product.stock >= l.quantity,
          lineTotalPaise: l.product.pricePaise * l.quantity,
        }));
    return {
      lines,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      subtotalPaise: lines.reduce((n, l) => n + l.lineTotalPaise, 0),
      isLoading: authed && server.isPending,
      isError: authed && server.isError,
      isGuest: !authed,
      refetch: () => void server.refetch(),
      add,
      setQuantity,
      remove,
      pendingIds,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    };
  }, [authed, server, guestLines, add, setQuantity, remove, pendingIds, drawerOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
