import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate, getBody, getParams, getQuery } from "../../middleware/validate";
import { AppError, notFound, ok, paginated } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { idParam, pageQuery, slugSchema, slugify } from "../../lib/schemas";
import { productWhere } from "../catalog/catalog.service";
import { changeStatus, orderDetailInclude } from "../orders/orders.service";

export const adminRouter = Router();
// Every admin route requires a signed-in ADMIN. The UI hiding admin links is only cosmetic.
adminRouter.use(requireAuth, requireRole("ADMIN"));

/* ─────────────────────────── Dashboard ─────────────────────────── */

const LOW_STOCK = 5;

adminRouter.get("/stats", async (_req, res) => {
  const counted = { status: { not: "CANCELLED" as const } };
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [totals, orderCount, pendingCount, customerCount, lowStock, recentOrders, daily] = await Promise.all([
    prisma.order.aggregate({ where: counted, _sum: { totalPaise: true }, _count: true }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.findMany({
      where: { active: true, stock: { lte: LOW_STOCK } },
      orderBy: { stock: "asc" },
      take: 8,
      select: { id: true, name: true, slug: true, stock: true, images: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaise: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.$queryRaw<{ day: Date; revenue: bigint; orders: bigint }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day,
             COALESCE(SUM("totalPaise"), 0) AS revenue,
             COUNT(*) AS orders
      FROM "Order"
      WHERE status <> 'CANCELLED' AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
  ]);

  // Fill in days without sales so the chart has a continuous 14-day axis.
  const byDay = new Map(daily.map((d) => [d.day.toISOString().slice(0, 10), d]));
  const sales = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(since.getTime() + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    return { date: key, revenuePaise: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) };
  });

  const revenuePaise = totals._sum.totalPaise ?? 0;
  const paidOrders = totals._count;
  ok(res, {
    revenuePaise,
    orderCount,
    pendingCount,
    customerCount,
    averageOrderPaise: paidOrders ? Math.round(revenuePaise / paidOrders) : 0,
    lowStockThreshold: LOW_STOCK,
    lowStock,
    recentOrders,
    sales,
  });
});

/* ─────────────────────────── Products ─────────────────────────── */

const imageUrl = z.url("Enter a full image URL (https://…)").max(1000).refine((u) => /^https?:\/\//.test(u), "Use an http(s) URL");

const productFields = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().min(10, "Write at least a sentence").max(5000),
  pricePaise: z.number().int().min(100, "Price must be at least ₹1").max(100_000_000),
  compareAtPaise: z.number().int().min(0).max(100_000_000).nullable().optional(),
  categoryId: z.string().min(1, "Choose a category"),
  stock: z.number().int().min(0).max(1_000_000),
  images: z.array(imageUrl).min(1, "Add at least one image").max(8),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});
const createProduct = productFields;
const updateProduct = productFields.partial().extend({ active: z.boolean().optional(), featured: z.boolean().optional() });

const adminProductQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive", "low"]).default("all"),
  ...pageQuery,
});

function assertCompareAt(price: number, compareAt: number | null | undefined) {
  if (compareAt != null && compareAt <= price) {
    throw new AppError(400, "Compare-at price must be higher than the price", [
      { path: "compareAtPaise", message: "Must be higher than the price" },
    ]);
  }
}

adminRouter.get("/products", validate({ query: adminProductQuery }), async (_req, res) => {
  const { q, category, status, page, limit } = getQuery(res, adminProductQuery);
  const extra: Prisma.ProductWhereInput =
    status === "active" ? { active: true } : status === "inactive" ? { active: false } : status === "low" ? { stock: { lte: LOW_STOCK } } : {};
  const where = productWhere({ q, category }, extra);
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.product.count({ where }),
  ]);
  ok(res, paginated(items, total, page, limit));
});

adminRouter.get("/products/:id", validate({ params: idParam }), async (_req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: getParams(res, idParam).id },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!product) throw notFound("Product");
  ok(res, product);
});

async function assertCategory(categoryId: string) {
  const exists = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!exists) throw new AppError(400, "Category does not exist", [{ path: "categoryId", message: "Choose a category" }]);
}

adminRouter.post("/products", validate({ body: createProduct }), async (_req, res) => {
  const data = getBody(res, createProduct);
  assertCompareAt(data.pricePaise, data.compareAtPaise);
  await assertCategory(data.categoryId);
  const product = await prisma.product.create({ data: { ...data, slug: data.slug ?? slugify(data.name) } });
  ok(res, product, 201);
});

adminRouter.patch("/products/:id", validate({ params: idParam, body: updateProduct }), async (_req, res) => {
  const { id } = getParams(res, idParam);
  const data = getBody(res, updateProduct);
  const current = await prisma.product.findUnique({ where: { id }, select: { pricePaise: true, compareAtPaise: true } });
  if (!current) throw notFound("Product");
  assertCompareAt(
    data.pricePaise ?? current.pricePaise,
    data.compareAtPaise === undefined ? current.compareAtPaise : data.compareAtPaise,
  );
  if (data.categoryId) await assertCategory(data.categoryId);
  ok(res, await prisma.product.update({ where: { id }, data }));
});

// Order history keeps its snapshot (name, price, image) even after a product is deleted.
adminRouter.delete("/products/:id", validate({ params: idParam }), async (_req, res) => {
  await prisma.product.delete({ where: { id: getParams(res, idParam).id } });
  ok(res, { message: "Product deleted" });
});

/* ─────────────────────────── Categories ─────────────────────────── */

const categoryFields = z.object({
  name: z.string().trim().min(2).max(60),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  imageUrl: imageUrl.nullable().optional(),
});

adminRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  ok(res, categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products })));
});

adminRouter.post("/categories", validate({ body: categoryFields }), async (_req, res) => {
  const data = getBody(res, categoryFields);
  ok(res, await prisma.category.create({ data: { ...data, slug: data.slug ?? slugify(data.name) } }), 201);
});

adminRouter.patch("/categories/:id", validate({ params: idParam, body: categoryFields.partial() }), async (_req, res) => {
  ok(res, await prisma.category.update({ where: { id: getParams(res, idParam).id }, data: getBody(res, categoryFields.partial()) }));
});

adminRouter.delete("/categories/:id", validate({ params: idParam }), async (_req, res) => {
  const { id } = getParams(res, idParam);
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) throw new AppError(409, `Move or delete this category's ${count} product(s) first`);
  await prisma.category.delete({ where: { id } });
  ok(res, { message: "Category deleted" });
});

/* ─────────────────────────── Orders ─────────────────────────── */

const orderStatus = z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]);
const adminOrderQuery = z.object({ status: orderStatus.optional(), q: z.string().trim().max(100).optional(), ...pageQuery });
const statusBody = z.object({ status: orderStatus, note: z.string().trim().max(300).optional() });

adminRouter.get("/orders", validate({ query: adminOrderQuery }), async (_req, res) => {
  const { status, q, page, limit } = getQuery(res, adminOrderQuery);
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  ok(res, paginated(items, total, page, limit));
});

adminRouter.get("/orders/:id", validate({ params: idParam }), async (_req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: getParams(res, idParam).id },
    include: { ...orderDetailInclude, user: { select: { id: true, name: true, email: true } } },
  });
  if (!order) throw notFound("Order");
  ok(res, order);
});

adminRouter.patch("/orders/:id/status", validate({ params: idParam, body: statusBody }), async (_req, res) => {
  const { status, note } = getBody(res, statusBody);
  ok(res, await changeStatus(getParams(res, idParam).id, status, note));
});

/* ─────────────────────────── Customers ─────────────────────────── */

const customerQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
  ...pageQuery,
});

adminRouter.get("/customers", validate({ query: customerQuery }), async (_req, res) => {
  const { q, role, page, limit } = getQuery(res, customerQuery);
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(q
      ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }
      : {}),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { orders: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  const spend = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) }, status: { not: "CANCELLED" } },
    _sum: { totalPaise: true },
  });
  const spent = new Map(spend.map((s) => [s.userId, s._sum.totalPaise ?? 0]));
  const items = users.map(({ _count, ...u }) => ({ ...u, orderCount: _count.orders, totalSpentPaise: spent.get(u.id) ?? 0 }));
  ok(res, paginated(items, total, page, limit));
});

