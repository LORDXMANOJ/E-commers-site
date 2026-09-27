import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { del, errorMessage, get, patch, post } from "../lib/api";
import { guestCart } from "../lib/guestCart";
import type { Cart, CartLine, CartProduct } from "../lib/types";
import { useAuth } from "./AuthProvider";

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotalPaise: number;
  isLoading: boolean;
  isError: boolean;
  isGuest: boolean;
  refetch: () => void;
  add: (product: CartProduct, quantity?: number) => Promise<boolean>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
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
    async (product: CartProduct, quantity = 1) => {
      if (!authed) {
        const inBag = guestCart.snapshot().find((l) => l.productId === product.id)?.quantity ?? 0;
        if (inBag + quantity > product.stock) {
          toast.error(product.stock > 0 ? `Only ${product.stock} of ${product.name} available` : `${product.name} is sold out`);
          return false;
        }
        guestCart.add(product, quantity);
        return true;
      }
      try {
        await track(product.id, () =>
          mutate.mutateAsync(() => post<Cart>("/cart/items", { productId: product.id, quantity })),
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
    async (productId: string, quantity: number) => {
      if (!authed) return guestCart.setQuantity(productId, quantity);
      try {
        await track(productId, () => mutate.mutateAsync(() => patch<Cart>(`/cart/items/${productId}`, { quantity })));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [authed, mutate, track],
  );

  const remove = useCallback(
    async (productId: string) => {
      if (!authed) return guestCart.remove(productId);
      try {
        await track(productId, () => mutate.mutateAsync(() => del<Cart>(`/cart/items/${productId}`)));
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
          productId: l.productId,
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
