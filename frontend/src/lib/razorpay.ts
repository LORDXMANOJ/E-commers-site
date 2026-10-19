import { post } from "./api";
import type { Order, PaymentSession } from "./types";

/**
 * Razorpay Standard Checkout: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 * The browser only ever gets the public Key ID. Success in the popup is NOT trusted on its own: the
 * signature is sent to our server, which verifies it and fetches the payment from Razorpay.
 */
const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

type SuccessResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type FailureResponse = { error?: { description?: string; reason?: string } };

type RazorpayInstance = { open(): void; on(event: "payment.failed", cb: (r: FailureResponse) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type PayResult =
  | { status: "paid"; order: Order }
  | { status: "dismissed"; lastError?: string };

/** Opens Razorpay Checkout for a session and resolves once the server has verified the payment (or the shopper closed it). */
export async function payWithRazorpay(
  session: PaymentSession,
  prefill: { name?: string; email?: string; contact?: string },
): Promise<PayResult> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("The payment window is unavailable right now.");

  return new Promise<PayResult>((resolve, reject) => {
    let lastError: string | undefined;
    const rzp = new Razorpay({
      key: session.keyId,
      amount: session.amountPaise,
      currency: session.currency,
      order_id: session.razorpayOrderId,
      name: "Aurelle",
      description: session.mode === "test" ? `Order ${session.orderNumber} · TEST MODE, no real money` : `Order ${session.orderNumber}`,
      prefill,
      notes: { orderNumber: session.orderNumber },
      theme: { color: "#1b2340" },
      modal: {
        confirm_close: true,
        ondismiss: () => resolve({ status: "dismissed", lastError }),
      },
      handler: (r: SuccessResponse) => {
        post<Order>(`/orders/${session.orderId}/verify`, {
          razorpay_payment_id: r.razorpay_payment_id,
          razorpay_signature: r.razorpay_signature,
          razorpay_order_id: r.razorpay_order_id,
        })
          .then((order) => resolve({ status: "paid", order }))
          .catch(reject);
      },
    });
    // Failed attempts keep the popup open so the shopper can retry with another method.
    rzp.on("payment.failed", (r) => {
      lastError = r.error?.description ?? "The payment failed.";
    });
    rzp.open();
  });
}
