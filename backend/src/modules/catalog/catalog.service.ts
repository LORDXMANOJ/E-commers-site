import { Prisma } from "@prisma/client";

/** Fields exposed for a product on the storefront. */
export const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  pricePaise: true,
  compareAtPaise: true,
  stock: true,
  images: true,
  featured: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

export type ProductSort = "newest" | "price_asc" | "price_desc" | "popular";

export const productOrderBy: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  price_asc: [{ pricePaise: "asc" }, { id: "asc" }],
  price_desc: [{ pricePaise: "desc" }, { id: "asc" }],
  popular: [{ soldCount: "desc" }, { createdAt: "desc" }, { id: "asc" }],
};

export type ProductFilters = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
};

export function productWhere(f: ProductFilters, extra: Prisma.ProductWhereInput = {}): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ...extra };
  if (f.q) {
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      { description: { contains: f.q, mode: "insensitive" } },
    ];
  }
  if (f.category) where.category = { slug: f.category };
  if (f.minPrice !== undefined || f.maxPrice !== undefined) {
    where.pricePaise = { gte: f.minPrice, lte: f.maxPrice };
  }
  if (f.inStock) where.stock = { gt: 0 };
  if (f.featured !== undefined) where.featured = f.featured;
  return where;
}
