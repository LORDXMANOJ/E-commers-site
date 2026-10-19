import { prisma } from "../../lib/prisma";
import { AppError, notFound } from "../../lib/http";
import { sizeLabel } from "../../lib/sizes";

const cartProductSelect = {
  id: true,
  name: true,
  slug: true,
  pricePaise: true,
  compareAtPaise: true,
  images: true,
  active: true,
} as const;

async function ensureCart(userId: string) {
  return prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
}

/** The user's cart with live prices. Inactive products or short sizes are shown but flagged unavailable. */
export async function getCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          quantity: true,
          variant: { select: { id: true, size: true, stock: true } },
          product: { select: cartProductSelect },
        },
      },
    },
  });
  const items = (cart?.items ?? []).map(({ quantity, product, variant }) => {
    const { active, ...rest } = product;
    return {
      productId: product.id,
      variantId: variant.id,
      size: variant.size,
      quantity,
      available: active && variant.stock >= quantity,
      product: { ...rest, stock: variant.stock },
      lineTotalPaise: product.pricePaise * quantity,
    };
  });
  return {
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotalPaise: items.reduce((n, i) => n + i.lineTotalPaise, 0),
  };
}

async function loadPurchasable(variantId: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, size: true, stock: true, product: { select: { id: true, name: true, active: true } } },
  });
  if (!variant || !variant.product.active) throw notFound("Product");
  return variant;
}

function assertStock(v: Awaited<ReturnType<typeof loadPurchasable>>, quantity: number) {
  const label = `${v.product.name} (${sizeLabel(v.size)})`;
  if (v.stock <= 0) throw new AppError(409, `${label} is sold out`);
  if (quantity > v.stock) throw new AppError(409, `Only ${v.stock} of ${label} left in stock`);
}

export async function addItem(userId: string, variantId: string, quantity: number) {
  const variant = await loadPurchasable(variantId);
  const cart = await ensureCart(userId);
  const key = { cartId_variantId: { cartId: cart.id, variantId } };
  const existing = await prisma.cartItem.findUnique({ where: key, select: { quantity: true } });
  const next = (existing?.quantity ?? 0) + quantity;
  assertStock(variant, next);
  await prisma.cartItem.upsert({
    where: key,
    create: { cartId: cart.id, productId: variant.product.id, variantId, quantity },
    update: { quantity: next },
  });
  return getCart(userId);
}

export async function setItemQuantity(userId: string, variantId: string, quantity: number) {
  const cart = await ensureCart(userId);
  const item = await prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
  if (!item) throw notFound("Cart item");
  assertStock(await loadPurchasable(variantId), quantity);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return getCart(userId);
}

export async function removeItem(userId: string, variantId: string) {
  const cart = await ensureCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
  return getCart(userId);
}

export async function clearCart(userId: string) {
  const cart = await ensureCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(userId);
}

/**
 * Merges a guest (localStorage) cart into the user's server cart after login.
 * Quantities are summed and capped at available stock. Unknown, inactive or sold-out sizes are skipped.
 */
export async function mergeCart(userId: string, items: { variantId: string; quantity: number }[]) {
  const cart = await ensureCart(userId);
  const ids = [...new Set(items.map((i) => i.variantId))];
  const [variants, existing] = await Promise.all([
    prisma.productVariant.findMany({
      where: { id: { in: ids }, product: { active: true } },
      select: { id: true, stock: true, productId: true },
    }),
    prisma.cartItem.findMany({ where: { cartId: cart.id, variantId: { in: ids } } }),
  ]);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const current = new Map(existing.map((e) => [e.variantId, e.quantity]));

  const incoming = new Map<string, number>();
  for (const i of items) incoming.set(i.variantId, (incoming.get(i.variantId) ?? 0) + i.quantity);

  await prisma.$transaction(
    [...incoming].flatMap(([variantId, qty]) => {
      const v = byId.get(variantId);
      if (!v || v.stock <= 0) return [];
      const quantity = Math.min((current.get(variantId) ?? 0) + qty, v.stock);
      return [
        prisma.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId } },
          create: { cartId: cart.id, productId: v.productId, variantId, quantity },
          update: { quantity },
        }),
      ];
    }),
  );
  return getCart(userId);
}
