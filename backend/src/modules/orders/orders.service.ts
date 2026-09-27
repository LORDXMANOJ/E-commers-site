import { Prisma, type OrderStatus, type PaymentMethod, type ShippingMethod } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError, notFound } from "../../lib/http";
import { generateOrderNumber } from "../../lib/tokens";
import { shippingFor } from "../../lib/money";
import type { Address } from "../../lib/schemas";

/** Allowed status changes. Anything not listed here is rejected. */
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const orderDetailInclude = {
  items: { orderBy: { name: "asc" } },
  events: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export type CardInput = { number: string; expiry: string; cvc: string; name: string };

export type CheckoutInput = {
  shippingAddress: Address;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  card?: CardInput;
  saveAddress?: boolean;
};

/** Test card that always declines, so the failure path can be demonstrated. */
export const DECLINED_TEST_CARD = "4000000000000002";

/**
 * Simulated card authorisation. No real payment provider is contacted and no card data is stored:
 * only the last four digits are kept on the order.
 */
function authoriseSimulatedCard(card: CardInput): { last4: string } {
  const digits = card.number.replace(/\D/g, "");
  if (digits === DECLINED_TEST_CARD) {
    throw new AppError(402, "Your card was declined (simulated). Try another card or choose Cash on Delivery.");
  }
  return { last4: digits.slice(-4) };
}

/**
 * Places an order from the user's server-side cart in ONE transaction:
 *   1. lock the cart row, so a double-submitted checkout cannot place two orders
 *   2. read current prices from the database (client prices are never used)
 *   3. decrement stock with a conditional UPDATE (stock >= qty), so concurrent orders cannot oversell
 *   4. create the order + item snapshots + first timeline event
 *   5. empty the cart
 * Any failure rolls everything back.
 */
export async function checkout(userId: string, input: CheckoutInput) {
  const payment =
    input.paymentMethod === "CARD_SIMULATED" && input.card ? authoriseSimulatedCard(input.card) : null;

  const order = await prisma.$transaction(
    async (tx) => {
      const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
      if (!cart) throw new AppError(400, "Your cart is empty");
      await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id} FOR UPDATE`;

      const items = await tx.cartItem.findMany({
        where: { cartId: cart.id },
        // Sorted so concurrent checkouts lock product rows in the same order (no deadlocks).
        orderBy: { productId: "asc" },
        select: {
          quantity: true,
          product: {
            select: { id: true, name: true, slug: true, pricePaise: true, images: true, active: true, stock: true },
          },
        },
      });
      if (items.length === 0) throw new AppError(400, "Your cart is empty");

      for (const { product, quantity } of items) {
        if (!product.active) throw new AppError(409, `${product.name} is no longer available`);
        const updated = await tx.product.updateMany({
          where: { id: product.id, active: true, stock: { gte: quantity } },
          data: { stock: { decrement: quantity }, soldCount: { increment: quantity } },
        });
        if (updated.count === 0) {
          const fresh = await tx.product.findUnique({ where: { id: product.id }, select: { stock: true } });
          const left = fresh?.stock ?? 0;
          throw new AppError(
            409,
            left > 0 ? `Only ${left} of ${product.name} left in stock` : `${product.name} just sold out`,
          );
        }
      }

      const subtotalPaise = items.reduce((sum, i) => sum + i.product.pricePaise * i.quantity, 0);
      const shippingPaise = shippingFor(input.shippingMethod, subtotalPaise);

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          subtotalPaise,
          shippingPaise,
          totalPaise: subtotalPaise + shippingPaise,
          shippingAddress: input.shippingAddress,
          shippingMethod: input.shippingMethod,
          paymentMethod: input.paymentMethod,
          paymentStatus: payment ? "PAID" : "UNPAID",
          cardLast4: payment?.last4,
          items: {
            create: items.map(({ product, quantity }) => ({
              productId: product.id,
              name: product.name,
              slug: product.slug,
              imageUrl: product.images[0] ?? null,
              unitPaise: product.pricePaise,
              quantity,
              lineTotalPaise: product.pricePaise * quantity,
            })),
          },
          events: { create: { status: "PENDING", note: "Order placed" } },
        },
        include: orderDetailInclude,
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (input.saveAddress) {
        await tx.user.update({ where: { id: userId }, data: { address: input.shippingAddress } });
      }
      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000, maxWait: 10_000 },
  );

  return order;
}

/**
 * Moves an order to a new status, enforcing STATUS_TRANSITIONS. Cancelling restores stock.
 * The conditional update on the current status makes concurrent changes safe: only one wins.
 */
export async function changeStatus(orderId: string, to: OrderStatus, note?: string, ownerId?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, ...(ownerId ? { userId: ownerId } : {}) },
      include: { items: true },
    });
    if (!order) throw notFound("Order");
    if (!STATUS_TRANSITIONS[order.status].includes(to)) {
      throw new AppError(409, `An order that is ${order.status.toLowerCase()} cannot be moved to ${to.toLowerCase()}`);
    }

    const paymentStatus =
      to === "CANCELLED" && order.paymentStatus === "PAID"
        ? "REFUNDED"
        : to === "DELIVERED" && order.paymentMethod === "COD"
          ? "PAID"
          : order.paymentStatus;

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: to, paymentStatus },
    });
    if (updated.count === 0) throw new AppError(409, "This order was just updated. Refresh and try again.");

    if (to === "CANCELLED") {
      for (const item of order.items) {
        if (!item.productId) continue; // product deleted since purchase
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, soldCount: { decrement: item.quantity } },
        });
      }
    }
    await tx.orderEvent.create({ data: { orderId: order.id, status: to, note } });
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderDetailInclude });
  });
}
