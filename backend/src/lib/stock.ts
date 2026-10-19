import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Locks product rows in id order. Every code path that changes variant stock takes these locks first,
 * so Product.stock (the total of its variants) can never drift and concurrent checkouts cannot deadlock.
 */
export async function lockProducts(tx: Tx, productIds: string[]) {
  const ids = [...new Set(productIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
}

/** Recomputes Product.stock from its variants. Call while holding the product lock. */
export async function syncProductStock(tx: Tx, productIds: string[]) {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Product" p
       SET stock = COALESCE((SELECT SUM(v.stock) FROM "ProductVariant" v WHERE v."productId" = p.id), 0)
     WHERE p.id = ANY(${ids}::text[])`;
}

type StockLine = { productId: string | null; variantId: string | null; quantity: number };

/** Puts units back on the shelf (cancellation, expired payment). Skips items whose product or size was deleted. */
export async function releaseStock(tx: Tx, items: StockLine[]) {
  const live = items.filter((i): i is StockLine & { productId: string } => i.productId !== null);
  await lockProducts(tx, live.map((i) => i.productId));
  for (const item of live) {
    if (item.variantId) {
      await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    }
    await tx.product.updateMany({
      where: { id: item.productId, soldCount: { gte: item.quantity } },
      data: { soldCount: { decrement: item.quantity } },
    });
  }
  await syncProductStock(tx, live.map((i) => i.productId));
}
