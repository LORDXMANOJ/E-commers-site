import express, { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http";
import { verifyWebhookSignature } from "../../lib/razorpay";
import { razorpayWebhookEnabled } from "../../config/env";
import { confirmRazorpayPayment } from "../orders/orders.service";

/**
 * Razorpay webhooks: https://razorpay.com/docs/webhooks/
 *
 * - Mounted BEFORE express.json(): the signature is an HMAC of the raw body, so the body must not be parsed first.
 * - Duplicate deliveries are expected. Each event id (x-razorpay-event-id) is recorded after it is handled,
 *   and every state change below is a conditional update, so replaying an event changes nothing.
 * - Responds 2xx quickly for events it does not handle, so Razorpay does not keep retrying them.
 */
export const webhookRouter = Router();

type PaymentEntity = { id: string; order_id: string | null; status: string; error_description?: string | null };
type RefundEntity = { id: string; payment_id: string; status: string };
type WebhookBody = {
  event: string;
  payload: { payment?: { entity: PaymentEntity }; refund?: { entity: RefundEntity } };
};

webhookRouter.post("/razorpay", express.raw({ type: "application/json", limit: "1mb" }), async (req, res): Promise<void> => {
  if (!razorpayWebhookEnabled) {
    res.status(503).json({ success: false, message: "Webhooks are not configured" });
    return;
  }

  const signature = req.header("x-razorpay-signature");
  const eventId = req.header("x-razorpay-event-id");
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!signature || !verifyWebhookSignature(raw, signature)) {
    res.status(400).json({ success: false, message: "Invalid signature" });
    return;
  }
  if (!eventId) {
    res.status(400).json({ success: false, message: "Missing event id" });
    return;
  }

  if (await prisma.webhookEvent.findUnique({ where: { id: eventId } })) {
    res.json({ success: true, data: { duplicate: true } });
    return;
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw.toString("utf8")) as WebhookBody;
  } catch {
    res.status(400).json({ success: false, message: "Invalid JSON" });
    return;
  }

  try {
    await handleEvent(body);
  } catch (err) {
    // Business-rule rejections (amount mismatch, not captured yet) are logged and acknowledged; anything else
    // returns 500 so Razorpay retries the delivery later.
    if (!(err instanceof AppError) || err.status >= 500) throw err;
    console.warn(`Webhook ${body.event} (${eventId}) not applied: ${err.message}`);
  }

  try {
    await prisma.webhookEvent.create({ data: { id: eventId, event: body.event } });
  } catch (err) {
    // A concurrent delivery of the same event recorded it first. Handling was idempotent, so this is fine.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }
  res.json({ success: true, data: { received: true } });
});

async function handleEvent({ event, payload }: WebhookBody) {
  const payment = payload.payment?.entity;
  const refund = payload.refund?.entity;

  if ((event === "payment.authorized" || event === "payment.captured" || event === "order.paid") && payment?.order_id) {
    const order = await prisma.order.findUnique({ where: { razorpayOrderId: payment.order_id }, select: { id: true } });
    if (order) await confirmRazorpayPayment(order.id, payment.id);
    return;
  }

  if (event === "payment.failed" && payment?.order_id) {
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: payment.order_id },
      select: { id: true, paymentStatus: true, status: true },
    });
    // The customer can retry until the payment window closes, so a failed attempt does not cancel the order.
    if (order && order.paymentStatus === "UNPAID" && order.status === "PENDING") {
      const reason = (payment.error_description ?? "").slice(0, 200);
      await prisma.orderEvent.create({
        data: { orderId: order.id, status: "PENDING", note: `Payment attempt failed${reason ? `: ${reason}` : ""}` },
      });
    }
    return;
  }

  if ((event === "refund.processed" || event === "refund.failed") && refund) {
    const order = await prisma.order.findFirst({
      where: { OR: [{ razorpayRefundId: refund.id }, { razorpayPaymentId: refund.payment_id }] },
      select: { id: true, status: true },
    });
    if (!order) return;
    if (event === "refund.processed") {
      const updated = await prisma.order.updateMany({
        where: { id: order.id, paymentStatus: "REFUND_PENDING" },
        data: { paymentStatus: "REFUNDED", razorpayRefundId: refund.id },
      });
      if (updated.count) {
        await prisma.orderEvent.create({ data: { orderId: order.id, status: order.status, note: "Refund completed" } });
      }
    } else {
      await prisma.orderEvent.create({
        data: { orderId: order.id, status: order.status, note: "Refund failed at Razorpay. Retry it from the Razorpay Dashboard." },
      });
    }
  }
}
