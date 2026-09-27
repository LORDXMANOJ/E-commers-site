import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { get } from "../lib/api";
import type { Category, Paginated, Product, ShippingOptions } from "../lib/types";

export type ProductQuery = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
  page?: number;
  limit?: number;
};

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => get<Category[]>("/categories"), staleTime: 5 * 60_000 });

export const useProducts = (params: ProductQuery) =>
  useQuery({
    queryKey: ["products", params],
    queryFn: () => get<Paginated<Product>>("/products", params),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

export const useProduct = (slug: string) =>
  useQuery({ queryKey: ["products", "detail", slug], queryFn: () => get<Product>(`/products/${slug}`), staleTime: 60_000 });

export const useRelated = (slug: string) =>
  useQuery({ queryKey: ["products", "related", slug], queryFn: () => get<Product[]>(`/products/${slug}/related`), staleTime: 60_000 });

const FALLBACK_SHIPPING: ShippingOptions = {
  freeShippingThresholdPaise: 299_900,
  methods: [
    { id: "STANDARD", label: "Standard", eta: "4–6 business days", pricePaise: 9_900 },
    { id: "EXPRESS", label: "Express", eta: "1–2 business days", pricePaise: 24_900 },
  ],
};

export function useShippingOptions() {
  const q = useQuery({ queryKey: ["shipping"], queryFn: () => get<ShippingOptions>("/shipping-options"), staleTime: Infinity });
  return q.data ?? FALLBACK_SHIPPING;
}

/** Estimated shipping for display; the server recalculates the real amount at checkout. */
export function estimateShipping(opts: ShippingOptions, method: "STANDARD" | "EXPRESS", subtotalPaise: number) {
  const m = opts.methods.find((x) => x.id === method)!;
  if (method === "STANDARD" && subtotalPaise >= opts.freeShippingThresholdPaise) return 0;
  return m.pricePaise;
}
