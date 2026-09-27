import { Router } from "express";
import { z } from "zod";
import { validate, getQuery, getParams } from "../../middleware/validate";
import { ok, notFound, paginated } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { boolQuery, pageQuery } from "../../lib/schemas";
import { SHIPPING, FREE_SHIPPING_THRESHOLD_PAISE } from "../../lib/money";
import { productOrderBy, productSelect, productWhere } from "./catalog.service";

export const productListQuery = z
  .object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    inStock: boolQuery,
    featured: boolQuery,
    sort: z.enum(["newest", "price_asc", "price_desc", "popular"]).default("newest"),
    ...pageQuery,
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: "Minimum price must not exceed maximum price",
    path: ["minPrice"],
  });

const slugParam = z.object({ slug: z.string().min(1).max(120) });

export const catalogRouter = Router();

catalogRouter.get("/products", validate({ query: productListQuery }), async (_req, res) => {
  const { sort, page, limit, ...filters } = getQuery(res, productListQuery);
  const where = productWhere(filters, { active: true });
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: productSelect,
      orderBy: productOrderBy[sort],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);
  ok(res, paginated(items, total, page, limit));
});

catalogRouter.get("/products/:slug", validate({ params: slugParam }), async (_req, res) => {
  const product = await prisma.product.findFirst({
    where: { slug: getParams(res, slugParam).slug, active: true },
    select: productSelect,
  });
  if (!product) throw notFound("Product");
  ok(res, product);
});

catalogRouter.get("/products/:slug/related", validate({ params: slugParam }), async (_req, res) => {
  const product = await prisma.product.findFirst({
    where: { slug: getParams(res, slugParam).slug, active: true },
    select: { id: true, categoryId: true },
  });
  if (!product) throw notFound("Product");
  const items = await prisma.product.findMany({
    where: { categoryId: product.categoryId, active: true, id: { not: product.id } },
    select: productSelect,
    orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
    take: 4,
  });
  ok(res, items);
});

catalogRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      _count: { select: { products: { where: { active: true } } } },
    },
  });
  ok(
    res,
    categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products })),
  );
});

/** Shipping rules so the client can show estimates; the server still recalculates at checkout. */
catalogRouter.get("/shipping-options", (_req, res) => {
  ok(res, {
    freeShippingThresholdPaise: FREE_SHIPPING_THRESHOLD_PAISE,
    methods: Object.entries(SHIPPING).map(([id, m]) => ({ id, ...m })),
  });
});
