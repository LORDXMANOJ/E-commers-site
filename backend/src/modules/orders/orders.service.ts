import { Prisma, type Order, type OrderStatus, type PaymentMethod, type ShippingMethod } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError, notFound } from "../../lib/http";
import { generateOrderNumber } from "../../lib/tokens";
import { shippingFor } from "../../lib/money";
import { lockProducts, releaseStock, syncProductStock } from "../../lib/stock";
import { getGateway, type GatewayPayment } from "../../lib/razorpay";
import { sizeLabel } from "../../lib/sizes";
import { env, razorpayMode } from "../../config/env";
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

const TX_OPTIONS = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000, maxWait: 10_000 };

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
 *   3. lock the products, then decrement each size with a conditional UPDATE (stock >= qty),
 *      so concurrent orders cannot oversell
 *   4. create the order + item snapshots + first timeline event
 *   5. empty the cart
 * Any failure rolls everything back.
 *
 * For RAZORPAY the stock is held for PAYMENT_HOLD_MINUTES while the customer pays. A Razorpay order is
 * then created server-side; if that fails the order is cancelled and its stock released.
 */
export async function checkout(userId: string, input: CheckoutInput) {
  const isRazorpay = input.paymentMethod === "RAZORPAY";
  if (isRazorpay) getGateway(); // throws 400 when Razorpay is not configured
  const payment =
    input.paymentMethod === "CARD_SIMULATED" && input.card ? authoriseSimulatedCard(input.card) : null;

  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
    if (!cart) throw new AppError(400, "Your cart is empty");
    await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cart.id} FOR UPDATE`;

    const items = await tx.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: [{ productId: "asc" }, { variantId: "asc" }],
      select: {
        quantity: true,
        variant: { select: { id: true, size: true } },
        product: { select: { id: true, name: true, slug: true, pricePaise: true, images: true, active: true } },
      },
    });
    if (items.length === 0) throw new AppError(400, "Your cart is empty");

    await lockProducts(tx, items.map((i) => i.product.id));
    for (const { product, variant, quantity } of items) {
      if (!product.active) throw new AppError(409, `${product.name} is no longer available`);
      const updated = await tx.productVariant.updateMany({
        where: { id: variant.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (updated.count === 0) {
        const fresh = await tx.productVariant.findUnique({ where: { id: variant.id }, select: { stock: true } });
        const left = fresh?.stock ?? 0;
        const label = `${product.name} (${sizeLabel(variant.size)})`;
        throw new AppError(409, left > 0 ? `Only ${left} of ${label} left in stock` : `${label} just sold out`);
      }
      await tx.product.update({ where: { id: product.id }, data: { soldCount: { increment: quantity } } });
    }
    await syncProductStock(tx, items.map((i) => i.product.id));

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
        paymentExpiresAt: isRazorpay ? new Date(Date.now() + env.PAYMENT_HOLD_MINUTES * 60_000) : null,
        items: {
          create: items.map(({ product, variant, quantity }) => ({
            productId: product.id,
            variantId: variant.id,
            size: variant.size,
            name: product.name,
            slug: product.slug,
            imageUrl: product.images[0] ?? null,
            unitPaise: product.pricePaise,
            quantity,
            lineTotalPaise: product.pricePaise * quantity,
          })),
        },
        events: {
          create: { status: "PENDING", note: isRazorpay ? "Order placed, awaiting online payment" : "Order placed" },
        },
      },
      include: orderDetailInclude,
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    if (input.saveAddress) {
      await tx.user.update({ where: { id: userId }, data: { address: input.shippingAddress } });
    }
    return created;
  }, TX_OPTIONS);

  if (!isRazorpay) return order;

  try {
    const rzOrder = await getGateway().createOrder({
      amountPaise: order.totalPaise,
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber },
    });
    return await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rzOrder.id },
      include: orderDetailInclude,
    });
  } catch (err) {
    await changeStatus(order.id, "CANCELLED", "Payment could not be started").catch(() => undefined);
    throw err;
  }
}

/** What the browser needs to open Razorpay Checkout for an order. Contains no secrets. */
export function checkoutSession(
  order: Pick<Order, "id" | "orderNumber" | "totalPaise" | "razorpayOrderId" | "paymentExpiresAt">,
) {
  return {
    keyId: env.RAZORPAY_KEY_ID!,
    mode: razorpayMode,
    razorpayOrderId: order.razorpayOrderId!,
    amountPaise: order.totalPaise,
    currency: "INR",
    orderId: order.id,
    orderNumber: order.orderNumber,
    expiresAt: order.paymentExpiresAt,
  };
}

/** Throws unless the order is an unpaid Razorpay order the customer can still pay for. */
export function assertPayable(order: Order) {
  if (order.paymentMethod !== "RAZORPAY") throw new AppError(400, "This order is not paid online");
  if (order.paymentStatus === "PAID") throw new AppError(409, "This order is already paid");
  if (order.status !== "PENDING" || !order.razorpayOrderId) throw new AppError(409, "This order can no longer be paid");
  if (order.paymentExpiresAt && order.paymentExpiresAt < new Date()) {
    throw new AppError(409, "The payment window for this order has closed. Please place a new order.");
  }
}

/**
 * Confirms a Razorpay payment for an order after fetching it from Razorpay (never trusting the browser):
 * it must belong to this order's Razorpay order, match the amount and be authorised or captured.
 * Authorised payments are captured. Idempotent: calling it twice for the same payment is harmless.
 */
export async function confirmRazorpayPayment(orderId: string, paymentId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentMethod !== "RAZORPAY" || !order.razorpayOrderId) throw notFound("Order");
  if (order.razorpayPaymentId === paymentId && order.paymentStatus !== "UNPAID") return order; // already handled

  const gateway = getGateway();
  let payment: GatewayPayment = await gateway.fetchPayment(paymentId);
  if (payment.order_id !== order.razorpayOrderId || payment.amount !== order.totalPaise || payment.currency !== "INR") {
    console.error(`Razorpay payment ${paymentId} does not match order ${order.orderNumber}`);
    throw new AppError(400, "This payment does not match the order");
  }
  if (payment.status === "authorized") payment = await gateway.capturePayment(paymentId, order.totalPaise);
  if (payment.status !== "captured") {
    throw new AppError(402, "The payment has not completed yet. If money was deducted it will be refunded automatically.");
  }

  // Paid after the order was cancelled (for example, the payment window expired): refund it.
  if (order.status === "CANCELLED") {
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, status: "CANCELLED", paymentStatus: "UNPAID", razorpayPaymentId: null },
      data: { razorpayPaymentId: paymentId, paymentStatus: "REFUND_PENDING" },
    });
    if (claimed.count === 0) return order; // another delivery already handled it
    await prisma.orderEvent.create({
      data: { orderId: order.id, status: "CANCELLED", note: "Payment arrived after the order was cancelled, so it is being refunded" },
    });
    return requestRefund(order.id);
  }

  const updated = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "UNPAID", status: "PENDING" },
    data: { paymentStatus: "PAID", razorpayPaymentId: paymentId, paymentExpiresAt: null },
  });
  if (updated.count === 1) {
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        status: "PENDING",
        note:
          razorpayMode === "test"
            ? "Payment received via Razorpay (test mode, no real money)"
            : "Payment received via Razorpay",
      },
    });
  }
  return prisma.order.findUniqueOrThrow({ where: { id: order.id } });
}

/**
 * Moves an order to a new status, enforcing STATUS_TRANSITIONS. Cancelling restores stock and refunds
 * a paid order. The conditional update on the current status makes concurrent changes safe: only one wins.
 *
 * Refund policy: the cancellation and stock release commit first, then the refund is requested from Razorpay.
 * A provider outage therefore never blocks a cancellation; the order stays "refund in progress" with a
 * timeline note, and an admin can retry with requestRefund().
 */
export async function changeStatus(orderId: string, to: OrderStatus, note?: string, ownerId?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, ...(ownerId ? { userId: ownerId } : {}) },
      include: { items: true },
    });
    if (!order) throw notFound("Order");
    if (!STATUS_TRANSITIONS[order.status].includes(to)) {
      throw new AppError(409, `An order that is ${order.status.toLowerCase()} cannot be moved to ${to.toLowerCase()}`);
    }
    if (to === "CONFIRMED" && order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "PAID") {
      throw new AppError(409, "This order is waiting for online payment and cannot be confirmed yet");
    }

    let paymentStatus = order.paymentStatus;
    if (to === "CANCELLED" && order.paymentStatus === "PAID") {
      paymentStatus = order.paymentMethod === "RAZORPAY" ? "REFUND_PENDING" : "REFUNDED";
    } else if (to === "DELIVERED" && order.paymentMethod === "COD") {
      paymentStatus = "PAID";
    }

    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: to, paymentStatus, ...(to === "CANCELLED" ? { paymentExpiresAt: null } : {}) },
    });
    if (updated.count === 0) throw new AppError(409, "This order was just updated. Refresh and try again.");

    if (to === "CANCELLED") {
      await releaseStock(tx, order.items);
    }
    await tx.orderEvent.create({ data: { orderId: order.id, status: to, note } });
    const needsRefund = to === "CANCELLED" && order.paymentMethod === "RAZORPAY" && order.paymentStatus === "PAID";
    return { needsRefund, order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderDetailInclude }) };
  }, TX_OPTIONS);

  if (!result.needsRefund) return result.order;
  return requestRefund(result.order.id);
}

/**
 * Requests a full refund from Razorpay for a cancelled, paid online order. Safe to call again: it does nothing
 * once a refund id is recorded, and Razorpay itself refuses to refund more than was captured.
 * On failure the order keeps REFUND_PENDING and gets a timeline note instead of throwing.
 */
export async function requestRefund(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order");
  if (order.paymentMethod !== "RAZORPAY" || order.status !== "CANCELLED" || order.paymentStatus !== "REFUND_PENDING") {
    throw new AppError(409, "This order has no refund waiting");
  }
  if (!order.razorpayRefundId && order.razorpayPaymentId) {
    try {
      const refund = await getGateway().refundPayment(order.razorpayPaymentId, order.totalPaise, {
        orderNumber: order.orderNumber,
      });
      await prisma.order.updateMany({
        where: { id: order.id, razorpayRefundId: null },
        data: { razorpayRefundId: refund.id, ...(refund.status === "processed" ? { paymentStatus: "REFUNDED" } : {}) },
      });
      await prisma.orderEvent.create({
        data: { orderId: order.id, status: "CANCELLED", note: "Full refund requested from Razorpay" },
      });
    } catch {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: "CANCELLED",
          note: "Automatic refund could not be started. An admin will retry it or refund from the Razorpay Dashboard.",
        },
      });
    }
  }
  return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderDetailInclude });
}

/**
 * Cancels Razorpay orders whose payment window has passed and releases their stock. Before cancelling,
 * it asks Razorpay whether a payment actually went through, so a late webhook never loses a paid order.
 */
export async function expireUnpaidOrders(now = new Date()) {
  const stale = await prisma.order.findMany({
    where: { paymentMethod: "RAZORPAY", paymentStatus: "UNPAID", status: "PENDING", paymentExpiresAt: { lt: now } },
    select: { id: true, razorpayOrderId: true },
    take: 50,
  });
  let cancelled = 0;
  for (const o of stale) {
    try {
      if (o.razorpayOrderId) {
        const payments = await getGateway().orderPayments(o.razorpayOrderId);
        const paid = payments.find((p) => p.status === "captured" || p.status === "authorized");
        if (paid) {
          await confirmRazorpayPayment(o.id, paid.id);
          continue;
        }
      }
      await changeStatus(o.id, "CANCELLED", "Payment not completed in time. Items returned to stock.");
      cancelled += 1;
    } catch (err) {
      console.error("Could not expire order", o.id, err instanceof Error ? err.message : err);
    }
  }
  return { checked: stale.length, cancelled };
}
