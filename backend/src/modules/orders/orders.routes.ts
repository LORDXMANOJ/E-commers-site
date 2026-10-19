import { Router } from "express";
import { z } from "zod";
import { requireAuth, currentUser } from "../../middleware/auth";
import { validate, getBody, getParams, getQuery } from "../../middleware/validate";
import { AppError, ok, notFound, paginated } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { addressSchema, idParam, pageQuery } from "../../lib/schemas";
import { verifyPaymentSignature } from "../../lib/razorpay";
import { paymentLimiter } from "../../middleware/rateLimit";
import {
  assertPayable,
  changeStatus,
  checkout,
  checkoutSession,
  confirmRazorpayPayment,
  orderDetailInclude,
} from "./orders.service";

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const cardSchema = z.object({
  name: z.string().trim().min(2, "Enter the name on the card").max(80),
  number: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{13,19}$/, "Enter a valid card number").refine(luhn, "Enter a valid card number")),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY")
    .refine((v) => {
      const [mm, yy] = v.split("/").map(Number);
      return new Date(2000 + yy, mm, 1) > new Date(); // valid through the end of that month
    }, "This card has expired"),
  cvc: z.string().trim().regex(/^\d{3,4}$/, "Enter the 3 or 4 digit code"),
});

const checkoutSchema = z
  .object({
    shippingAddress: addressSchema,
    shippingMethod: z.enum(["STANDARD", "EXPRESS"]),
    paymentMethod: z.enum(["COD", "CARD_SIMULATED", "RAZORPAY"]),
    card: cardSchema.optional(),
    saveAddress: z.boolean().optional().default(false),
  })
  .refine((v) => v.paymentMethod !== "CARD_SIMULATED" || v.card, {
    message: "Card details are required for card payment",
    path: ["card"],
  });

const listQuery = z.object({ ...pageQuery, limit: z.coerce.number().int().min(1).max(50).default(10) });

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.post("/", validate({ body: checkoutSchema }), async (_req, res) => {
  const { card, ...rest } = getBody(res, checkoutSchema);
  const order = await checkout(currentUser(res).id, {
    ...rest,
    card: rest.paymentMethod === "CARD_SIMULATED" ? card : undefined,
  });
  ok(res, order.paymentMethod === "RAZORPAY" ? { ...order, payment: checkoutSession(order) } : order, 201);
});

ordersRouter.get("/", validate({ query: listQuery }), async (_req, res) => {
  const { page, limit } = getQuery(res, listQuery);
  const where = { userId: currentUser(res).id };
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { items: { select: { name: true, imageUrl: true, quantity: true, size: true }, take: 4 }, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  ok(res, paginated(items, total, page, limit));
});

// Ownership is part of the query: someone else's order is indistinguishable from a missing one (404).
ordersRouter.get("/:id", validate({ params: idParam }), async (_req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: getParams(res, idParam).id, userId: currentUser(res).id },
    include: orderDetailInclude,
  });
  if (!order) throw notFound("Order");
  ok(res, order);
});

ordersRouter.post("/:id/cancel", validate({ params: idParam }), async (_req, res) => {
  const user = currentUser(res);
  const id = getParams(res, idParam).id;
  const order = await prisma.order.findFirst({ where: { id, userId: user.id }, select: { status: true } });
  if (!order) throw notFound("Order");
  if (order.status !== "PENDING") {
    throw new AppError(409, "Only pending orders can be cancelled. Contact support for help with this order.");
  }
  ok(res, await changeStatus(id, "CANCELLED", "Cancelled by customer", user.id));
});

/** Re-opens Razorpay Checkout for an unpaid online order (the customer closed the popup or the payment failed). */
ordersRouter.post("/:id/pay", paymentLimiter, validate({ params: idParam }), async (_req, res) => {
  const order = await prisma.order.findFirst({ where: { id: getParams(res, idParam).id, userId: currentUser(res).id } });
  if (!order) throw notFound("Order");
  assertPayable(order);
  ok(res, checkoutSession(order));
});

const verifySchema = z.object({
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/, "Invalid payment id"),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/, "Invalid signature"),
  // Sent by Checkout but deliberately ignored: the order id stored on the server is used instead.
  razorpay_order_id: z.string().max(64).optional(),
});

/**
 * Called by the browser after Razorpay Checkout succeeds. The signature proves the payment id belongs to
 * our Razorpay order; the payment is then fetched from Razorpay and checked before the order is marked paid.
 * Reaching this endpoint, or any redirect, is never treated as proof of payment on its own.
 */
ordersRouter.post("/:id/verify", paymentLimiter, validate({ params: idParam, body: verifySchema }), async (_req, res) => {
  const { razorpay_payment_id, razorpay_signature } = getBody(res, verifySchema);
  const order = await prisma.order.findFirst({ where: { id: getParams(res, idParam).id, userId: currentUser(res).id } });
  if (!order) throw notFound("Order");
  if (order.paymentMethod !== "RAZORPAY" || !order.razorpayOrderId) throw new AppError(400, "This order is not paid online");
  if (!verifyPaymentSignature(order.razorpayOrderId, razorpay_payment_id, razorpay_signature)) {
    throw new AppError(400, "Payment verification failed. If money was deducted it will be refunded automatically.");
  }
  await confirmRazorpayPayment(order.id, razorpay_payment_id);
  ok(res, await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderDetailInclude }));
});
