import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env, razorpayEnabled } from "../config/env";
import { AppError } from "./http";

/**
 * The few Razorpay operations Aurelle uses. Kept behind an interface so tests can swap in a fake
 * (setGateway) and never call the real API. Docs: https://razorpay.com/docs/payments/payment-gateway/
 */
export type GatewayPayment = { id: string; order_id: string | null; amount: number; currency: string; status: string };
export type GatewayRefund = { id: string; status: string };

export interface PaymentGateway {
  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  capturePayment(paymentId: string, amountPaise: number): Promise<GatewayPayment>;
  refundPayment(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<GatewayRefund>;
  /** Payments made against a Razorpay order, newest first. */
  orderPayments(razorpayOrderId: string): Promise<GatewayPayment[]>;
}

/** Turns an SDK error into a safe message. Provider details are logged, never sent to the client. */
function providerError(err: unknown): AppError {
  const e = err as { statusCode?: number; error?: { code?: string; description?: string } };
  console.error("Razorpay API error:", e?.statusCode, e?.error?.code, e?.error?.description);
  return new AppError(502, "The payment provider could not be reached. Please try again in a moment.");
}

function sdkGateway(): PaymentGateway {
  const rz = new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! });
  const call = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (err) {
      throw providerError(err);
    }
  };
  const toPayment = (p: { id: string; order_id?: string | null; amount: number | string; currency: string; status: string }): GatewayPayment => ({
    id: p.id,
    order_id: p.order_id ?? null,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
  });
  return {
    createOrder: ({ amountPaise, receipt, notes }) =>
      call(async () => {
        const o = await rz.orders.create({ amount: amountPaise, currency: "INR", receipt, notes });
        return { id: o.id };
      }),
    fetchPayment: (id) => call(async () => toPayment(await rz.payments.fetch(id))),
    capturePayment: (id, amountPaise) => call(async () => toPayment(await rz.payments.capture(id, amountPaise, "INR"))),
    refundPayment: (id, amountPaise, notes) =>
      call(async () => {
        const r = await rz.payments.refund(id, { amount: amountPaise, notes });
        return { id: r.id, status: String(r.status) };
      }),
    orderPayments: (orderId) =>
      call(async () => {
        const res = await rz.orders.fetchPayments(orderId);
        return (res.items ?? []).map(toPayment);
      }),
  };
}

let gateway: PaymentGateway | null = null;

export function getGateway(): PaymentGateway {
  if (!razorpayEnabled) throw new AppError(400, "Online payment is not available right now. Choose Cash on Delivery.");
  gateway ??= sdkGateway();
  return gateway;
}

/** Test hook: replace the real gateway with a fake. */
export function setGateway(fake: PaymentGateway | null) {
  gateway = fake;
}

function safeEqualHex(expected: string, received: string) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Checkout signature: HMAC-SHA256 of "<order_id>|<payment_id>" with the key secret.
 * The order id must be the one stored on our server, never one sent by the browser.
 */
export function verifyPaymentSignature(razorpayOrderId: string, paymentId: string, signature: string) {
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET ?? "")
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256 of the RAW request body with the webhook secret. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string) {
  const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET ?? "").update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
