import { prisma } from "../../lib/prisma";
import { AppError, notFound } from "../../lib/http";

const cartProductSelect = {
  id: true,
  name: true,
  slug: true,
  pricePaise: true,
  compareAtPaise: true,
  stock: true,
  images: true,
  active: true,
} as const;

async function ensureCart(userId: string) {
  return prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
}

/** The user's cart with live prices. Inactive products are shown but flagged unavailable. */
export async function getCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      items: {
        orderBy: { createdAt: "asc" },
        select: { quantity: true, product: { select: cartProductSelect } },
      },
    },
  });
  const items = (cart?.items ?? []).map(({ quantity, product }) => {
    const { active, ...rest } = product;
    return {
      productId: product.id,
      quantity,
      available: active && product.stock >= quantity,
      product: rest,
      lineTotalPaise: product.pricePaise * quantity,
    };
  });
  return {
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotalPaise: items.reduce((n, i) => n + i.lineTotalPaise, 0),
  };
}

async function loadPurchasable(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, stock: true, active: true },
  });
  if (!product || !product.active) throw notFound("Product");
  return product;
}

function assertStock(product: { name: string; stock: number }, quantity: number) {
  if (product.stock <= 0) throw new AppError(409, `${product.name} is sold out`);
  if (quantity > product.stock) {
    throw new AppError(409, `Only ${product.stock} of ${product.name} left in stock`);
  }
}

export async function addItem(userId: string, productId: string, quantity: number) {
  const product = await loadPurchasable(productId);
  const cart = await ensureCart(userId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
    select: { quantity: true },
  });
  const next = (existing?.quantity ?? 0) + quantity;
  assertStock(product, next);
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: next },
  });
  return getCart(userId);
}

export async function setItemQuantity(userId: string, productId: string, quantity: number) {
  const cart = await ensureCart(userId);
  const item = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } });
  if (!item) throw notFound("Cart item");
  assertStock(await loadPurchasable(productId), quantity);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return getCart(userId);
}

export async function removeItem(userId: string, productId: string) {
  const cart = await ensureCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  return getCart(userId);
}

export async function clearCart(userId: string) {
  const cart = await ensureCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(userId);
}

/**
 * Merges a guest (localStorage) cart into the user's server cart after login.
 * Quantities are summed and capped at available stock. Unknown or inactive products are skipped.
 */
export async function mergeCart(userId: string, items: { productId: string; quantity: number }[]) {
  const cart = await ensureCart(userId);
  const ids = [...new Set(items.map((i) => i.productId))];
  const [products, existing] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, stock: true } }),
    prisma.cartItem.findMany({ where: { cartId: cart.id, productId: { in: ids } } }),
  ]);
  const stock = new Map(products.map((p) => [p.id, p.stock]));
  const current = new Map(existing.map((e) => [e.productId, e.quantity]));

  const incoming = new Map<string, number>();
  for (const i of items) incoming.set(i.productId, (incoming.get(i.productId) ?? 0) + i.quantity);

  await prisma.$transaction(
    [...incoming].flatMap(([productId, qty]) => {
      const available = stock.get(productId);
      if (!available) return [];
      const quantity = Math.min((current.get(productId) ?? 0) + qty, available);
      return [
        prisma.cartItem.upsert({
          where: { cartId_productId: { cartId: cart.id, productId } },
          create: { cartId: cart.id, productId, quantity },
          update: { quantity },
        }),
      ];
    }),
  );
  return getCart(userId);
}
