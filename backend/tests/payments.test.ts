import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, checkoutBody, createCategory, createProduct, createUser, prisma, resetDb } from "./helpers";
import { setGateway, type GatewayPayment, type PaymentGateway } from "../src/lib/razorpay";
import { expireUnpaidOrders } from "../src/modules/orders/orders.service";

const KEY_SECRET = "unit-test-key-secret";
const WEBHOOK_SECRET = "unit-test-webhook-secret";

/** In-memory stand-in for Razorpay. Tests decide what each payment looks like. */
function fakeGateway() {
  let n = 0;
  const payments = new Map<string, GatewayPayment>();
  const refunds: { paymentId: string; amount: number }[] = [];
  const gateway: PaymentGateway = {
    async createOrder() {
      n += 1;
      return { id: `order_TEST${String(n).padStart(6, "0")}` };
    },
    async fetchPayment(id) {
      const p = payments.get(id);
      if (!p) throw new Error("unknown payment");
      return { ...p };
    },
    async capturePayment(id) {
      const p = payments.get(id)!;
      p.status = "captured";
      return { ...p };
    },
    async refundPayment(paymentId, amount) {
      refunds.push({ paymentId, amount });
      return { id: `rfnd_TEST${refunds.length}`, status: "pending" };
    },
    async orderPayments(orderId) {
      return [...payments.values()].filter((p) => p.order_id === orderId);
    },
  };
  return {
    gateway,
    refunds,
    addPayment(p: Partial<GatewayPayment> & { id: string; order_id: string; amount: number }) {
      payments.set(p.id, { currency: "INR", status: "captured", ...p });
    },
  };
}

const sign = (orderId: string, paymentId: string) =>
  crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

function webhook(body: object, eventId: string, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(body);
  const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return api()
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", signature)
    .set("X-Razorpay-Event-Id", eventId)
    .send(raw);
}

describe("sizes and stock per size", () => {
  let categoryId: string;
  beforeEach(async () => {
    await resetDb();
    categoryId = (await createCategory()).id;
  });

  it("exposes sizes on the storefront and filters by a size that is in stock", async () => {
    await createProduct(categoryId, { name: "Chikankari Kurta", sizes: [["S", 0], ["M", 3]] });
    await createProduct(categoryId, { name: "Linen Saree", sizes: [["FREE_SIZE", 2]] });
    const list = await api().get("/api/products").expect(200);
    const kurta = list.body.data.items.find((p: { name: string }) => p.name === "Chikankari Kurta");
    expect(kurta.variants.map((v: { size: string; stock: number }) => [v.size, v.stock])).toEqual([["S", 0], ["M", 3]]);
    expect(kurta.stock).toBe(3);

    const medium = await api().get("/api/products?size=M").expect(200);
    expect(medium.body.data.items.map((p: { name: string }) => p.name)).toEqual(["Chikankari Kurta"]);
    const small = await api().get("/api/products?size=S").expect(200);
    expect(small.body.data.items).toHaveLength(0);
  });

  it("keeps sizes separate in the cart and refuses more than a size has", async () => {
    const { auth } = await createUser();
    const p = await createProduct(categoryId, { name: "Anarkali Set", sizes: [["S", 1], ["M", 5]] });
    const [s, m] = await prisma.productVariant.findMany({ where: { productId: p.id }, orderBy: { size: "asc" } });

    await api().post("/api/cart/items").set("Authorization", auth).send({ variantId: s.id, quantity: 1 }).expect(200);
    const res = await api().post("/api/cart/items").set("Authorization", auth).send({ variantId: m.id, quantity: 2 }).expect(200);
    expect(res.body.data.items.map((i: { size: string; quantity: number }) => [i.size, i.quantity])).toEqual([["S", 1], ["M", 2]]);

    const tooMany = await api().post("/api/cart/items").set("Authorization", auth).send({ variantId: s.id }).expect(409);
    expect(tooMany.body.message).toBe("Only 1 of Anarkali Set (S) left in stock");
  });

  it("decrements only the bought size and keeps the product total in sync", async () => {
    const { auth } = await createUser();
    const p = await createProduct(categoryId, { sizes: [["S", 4], ["M", 6]] });
    const m = await prisma.productVariant.findFirstOrThrow({ where: { productId: p.id, size: "M" } });
    await api().post("/api/cart/items").set("Authorization", auth).send({ variantId: m.id, quantity: 2 }).expect(200);
    const order = await api().post("/api/orders").set("Authorization", auth).send(checkoutBody()).expect(201);
    expect(order.body.data.items[0]).toMatchObject({ size: "M", quantity: 2 });

    const variants = await prisma.productVariant.findMany({ where: { productId: p.id }, orderBy: { size: "asc" } });
    expect(variants.map((v) => v.stock)).toEqual([4, 4]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(8);

    await api().post(`/api/orders/${order.body.data.id}/cancel`).set("Authorization", auth).expect(200);
    const restored = await prisma.productVariant.findMany({ where: { productId: p.id }, orderBy: { size: "asc" } });
    expect(restored.map((v) => v.stock)).toEqual([4, 6]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(10);
  });

  it("never oversells one size under concurrent checkouts", async () => {
    const p = await createProduct(categoryId, { sizes: [["L", 6], ["XL", 50]] });
    const l = await prisma.productVariant.findFirstOrThrow({ where: { productId: p.id, size: "L" } });
    const buyers = await Promise.all(Array.from({ length: 6 }, () => createUser()));
    for (const b of buyers) {
      await api().post("/api/cart/items").set("Authorization", b.auth).send({ variantId: l.id, quantity: 1 }).expect(200);
    }
    await prisma.productVariant.update({ where: { id: l.id }, data: { stock: 2 } });
    await prisma.product.update({ where: { id: p.id }, data: { stock: 52 } });

    const results = await Promise.all(
      buyers.map((b) => api().post("/api/orders").set("Authorization", b.auth).send(checkoutBody())),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: l.id } })).stock).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(50);
  });

  it("lets an admin change sizes, which updates storefront stock", async () => {
    const admin = await createUser("ADMIN");
    const p = await createProduct(categoryId, { sizes: [["S", 2], ["M", 2]] });
    const bad = await api()
      .patch(`/api/admin/products/${p.id}`)
      .set("Authorization", admin.auth)
      .send({ variants: [{ size: "M", stock: 1 }, { size: "FREE_SIZE", stock: 1 }] })
      .expect(400);
    expect(JSON.stringify(bad.body)).toContain("Free Size cannot be combined");

    const res = await api()
      .patch(`/api/admin/products/${p.id}`)
      .set("Authorization", admin.auth)
      .send({ variants: [{ size: "M", stock: 9 }, { size: "XL", stock: 1 }] })
      .expect(200);
    expect(res.body.data.variants.map((v: { size: string; stock: number }) => [v.size, v.stock])).toEqual([["M", 9], ["XL", 1]]);
    expect(res.body.data.stock).toBe(10);
    const pub = await api().get(`/api/products/${p.slug}`).expect(200);
    expect(pub.body.data.stock).toBe(10);
  });
});

describe("Razorpay payments (fake gateway)", () => {
  let categoryId: string;
  let fake: ReturnType<typeof fakeGateway>;

  beforeEach(async () => {
    await resetDb();
    categoryId = (await createCategory()).id;
    fake = fakeGateway();
    setGateway(fake.gateway);
  });
  afterEach(() => setGateway(null));

  async function placeRazorpayOrder(qty = 2) {
    const customer = await createUser();
    const p = await createProduct(categoryId, { pricePaise: 150_000, sizes: [["M", 5]] });
    await api().post("/api/cart/items").set("Authorization", customer.auth).send({ variantId: p.variantId, quantity: qty }).expect(200);
    const res = await api()
      .post("/api/orders")
      .set("Authorization", customer.auth)
      .send(checkoutBody({ paymentMethod: "RAZORPAY" }))
      .expect(201);
    return { customer, product: p, order: res.body.data };
  }

  it("creates a pending order that holds stock and returns a checkout session without secrets", async () => {
    const { order, product } = await placeRazorpayOrder();
    expect(order).toMatchObject({ paymentMethod: "RAZORPAY", paymentStatus: "UNPAID", status: "PENDING", totalPaise: 300_000 });
    expect(order.payment).toMatchObject({ keyId: "rzp_test_unittest", mode: "test", amountPaise: 300_000, currency: "INR" });
    expect(order.payment.razorpayOrderId).toMatch(/^order_TEST/);
    expect(JSON.stringify(order)).not.toContain(KEY_SECRET);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variantId } })).stock).toBe(3);
  });

  it("marks the order paid only after a valid signature and a matching captured payment", async () => {
    const { order, customer } = await placeRazorpayOrder();
    const rzOrderId = order.payment.razorpayOrderId;
    fake.addPayment({ id: "pay_GOOD000001", order_id: rzOrderId, amount: 300_000, status: "authorized" });

    // Wrong signature
    await api()
      .post(`/api/orders/${order.id}/verify`)
      .set("Authorization", customer.auth)
      .send({ razorpay_payment_id: "pay_GOOD000001", razorpay_signature: "0".repeat(64) })
      .expect(400);

    // Signature computed for a different Razorpay order id (browser cannot choose the order id)
    await api()
      .post(`/api/orders/${order.id}/verify`)
      .set("Authorization", customer.auth)
      .send({ razorpay_payment_id: "pay_GOOD000001", razorpay_signature: sign("order_OTHER", "pay_GOOD000001"), razorpay_order_id: "order_OTHER" })
      .expect(400);

    const ok = await api()
      .post(`/api/orders/${order.id}/verify`)
      .set("Authorization", customer.auth)
      .send({ razorpay_payment_id: "pay_GOOD000001", razorpay_signature: sign(rzOrderId, "pay_GOOD000001") })
      .expect(200);
    expect(ok.body.data).toMatchObject({ paymentStatus: "PAID", status: "PENDING", razorpayPaymentId: "pay_GOOD000001" });

    // Verifying again is harmless and adds no second timeline entry.
    await api()
      .post(`/api/orders/${order.id}/verify`)
      .set("Authorization", customer.auth)
      .send({ razorpay_payment_id: "pay_GOOD000001", razorpay_signature: sign(rzOrderId, "pay_GOOD000001") })
      .expect(200);
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id, note: { contains: "Payment received" } } });
    expect(events).toHaveLength(1);
  });

  it("rejects a payment whose amount does not match the order", async () => {
    const { order, customer } = await placeRazorpayOrder();
    const rzOrderId = order.payment.razorpayOrderId;
    fake.addPayment({ id: "pay_CHEAP00001", order_id: rzOrderId, amount: 100 });
    await api()
      .post(`/api/orders/${order.id}/verify`)
      .set("Authorization", customer.auth)
      .send({ razorpay_payment_id: "pay_CHEAP00001", razorpay_signature: sign(rzOrderId, "pay_CHEAP00001") })
      .expect(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");
  });

  it("does not let another customer verify or pay someone else's order", async () => {
    const { order } = await placeRazorpayOrder();
    const stranger = await createUser();
    await api().post(`/api/orders/${order.id}/pay`).set("Authorization", stranger.auth).expect(404);
    await api()
      .post(`/api/orders/${order.id}/verify`)
      .set("Authorization", stranger.auth)
      .send({ razorpay_payment_id: "pay_X0000001", razorpay_signature: "a".repeat(64) })
      .expect(404);
  });

  it("blocks confirming an unpaid online order, and refunds a paid one on cancel", async () => {
    const { order, customer } = await placeRazorpayOrder();
    const admin = await createUser("ADMIN");
    await api().patch(`/api/admin/orders/${order.id}/status`).set("Authorization", admin.auth).send({ status: "CONFIRMED" }).expect(409);

    const rzOrderId = order.payment.razorpayOrderId;
    fake.addPayment({ id: "pay_PAID000001", order_id: rzOrderId, amount: 300_000 });
    await api()
      .post(`/api/orders/${order.id}/verify`)
      .set("Authorization", customer.auth)
      .send({ razorpay_payment_id: "pay_PAID000001", razorpay_signature: sign(rzOrderId, "pay_PAID000001") })
      .expect(200);

    const cancelled = await api().post(`/api/orders/${order.id}/cancel`).set("Authorization", customer.auth).expect(200);
    expect(cancelled.body.data).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUND_PENDING", razorpayRefundId: "rfnd_TEST1" });
    expect(fake.refunds).toEqual([{ paymentId: "pay_PAID000001", amount: 300_000 }]);
  });

  it("still cancels and releases stock when the refund call fails, and lets an admin retry it", async () => {
    const { order, customer, product } = await placeRazorpayOrder();
    const admin = await createUser("ADMIN");
    const rzOrderId = order.payment.razorpayOrderId;
    fake.addPayment({ id: "pay_RFAIL00001", order_id: rzOrderId, amount: 300_000 });
    await api()
      .post(`/api/orders/${order.id}/verify`)
      .set("Authorization", customer.auth)
      .send({ razorpay_payment_id: "pay_RFAIL00001", razorpay_signature: sign(rzOrderId, "pay_RFAIL00001") })
      .expect(200);

    const realRefund = fake.gateway.refundPayment;
    fake.gateway.refundPayment = async () => {
      throw new Error("provider down");
    };
    const cancelled = await api().post(`/api/orders/${order.id}/cancel`).set("Authorization", customer.auth).expect(200);
    expect(cancelled.body.data).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUND_PENDING", razorpayRefundId: null });
    expect(cancelled.body.data.events.some((e: { note: string | null }) => e.note?.includes("could not be started"))).toBe(true);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variantId } })).stock).toBe(5);

    fake.gateway.refundPayment = realRefund;
    await api().post(`/api/admin/orders/${order.id}/refund`).set("Authorization", customer.auth).expect(403);
    const retried = await api().post(`/api/admin/orders/${order.id}/refund`).set("Authorization", admin.auth).expect(200);
    expect(retried.body.data).toMatchObject({ paymentStatus: "REFUND_PENDING", razorpayRefundId: "rfnd_TEST1" });
    // A second retry does not create a second refund.
    await api().post(`/api/admin/orders/${order.id}/refund`).set("Authorization", admin.auth).expect(200);
    expect(fake.refunds).toHaveLength(1);
  });

  it("handles webhooks: rejects bad signatures, applies payment.captured once, ignores duplicates", async () => {
    const { order } = await placeRazorpayOrder();
    const rzOrderId = order.payment.razorpayOrderId;
    fake.addPayment({ id: "pay_HOOK000001", order_id: rzOrderId, amount: 300_000 });
    const body = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_HOOK000001", order_id: rzOrderId, status: "captured", amount: 300_000 } } },
    };

    await webhook(body, "evt_1", "wrong-secret").expect(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");

    await webhook(body, "evt_1").expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("PAID");

    const dup = await webhook(body, "evt_1").expect(200);
    expect(dup.body.data).toEqual({ duplicate: true });
    expect(await prisma.webhookEvent.count()).toBe(1);
  });

  it("records failed attempts without cancelling, and completes refunds from refund.processed", async () => {
    const { order, customer } = await placeRazorpayOrder();
    const rzOrderId = order.payment.razorpayOrderId;
    await webhook(
      { event: "payment.failed", payload: { payment: { entity: { id: "pay_FAIL000001", order_id: rzOrderId, status: "failed", error_description: "Card declined by bank" } } } },
      "evt_fail",
    ).expect(200);
    const afterFail = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { events: true } });
    expect(afterFail.status).toBe("PENDING");
    expect(afterFail.events.some((e) => e.note?.includes("Card declined by bank"))).toBe(true);

    // Retry works while the window is open.
    await api().post(`/api/orders/${order.id}/pay`).set("Authorization", customer.auth).expect(200);

    fake.addPayment({ id: "pay_OK00000001", order_id: rzOrderId, amount: 300_000 });
    await webhook({ event: "order.paid", payload: { payment: { entity: { id: "pay_OK00000001", order_id: rzOrderId, status: "captured" } } } }, "evt_paid").expect(200);
    await api().post(`/api/orders/${order.id}/cancel`).set("Authorization", customer.auth).expect(200);

    await webhook(
      { event: "refund.processed", payload: { refund: { entity: { id: "rfnd_TEST1", payment_id: "pay_OK00000001", status: "processed" } } } },
      "evt_refund",
    ).expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("REFUNDED");
  });

  it("expires unpaid orders after the hold window and returns their stock", async () => {
    const { order, product } = await placeRazorpayOrder(2);
    await prisma.order.update({ where: { id: order.id }, data: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    const result = await expireUnpaidOrders();
    expect(result).toEqual({ checked: 1, cancelled: 1 });
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after).toMatchObject({ status: "CANCELLED", paymentStatus: "UNPAID" });
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variantId } })).stock).toBe(5);
  });

  it("does not cancel an expired order if Razorpay shows it was actually paid", async () => {
    const { order } = await placeRazorpayOrder();
    fake.addPayment({ id: "pay_LATE000001", order_id: order.payment.razorpayOrderId, amount: 300_000 });
    await prisma.order.update({ where: { id: order.id }, data: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expireUnpaidOrders()).toEqual({ checked: 1, cancelled: 0 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("PAID");
  });

  it("publishes feature flags without secrets", async () => {
    const res = await api().get("/api/config").expect(200);
    expect(res.body.data.payments).toMatchObject({ razorpay: true, mode: "test", cod: true });
    expect(JSON.stringify(res.body)).not.toMatch(/secret/i);
  });
});

describe("admin image upload signature", () => {
  beforeEach(resetDb);

  it("is admin-only and signs the upload parameters with the Cloudinary secret", async () => {
    const customer = await createUser();
    await api().post("/api/admin/uploads/signature").set("Authorization", customer.auth).expect(403);
    const admin = await createUser("ADMIN");
    const res = await api().post("/api/admin/uploads/signature").set("Authorization", admin.auth).expect(200);
    const d = res.body.data;
    const expected = crypto
      .createHash("sha1")
      .update(`allowed_formats=${d.allowed_formats}&folder=${d.folder}&timestamp=${d.timestamp}unit-test-cloudinary-secret`)
      .digest("hex");
    expect(d.signature).toBe(expected);
    expect(d.uploadUrl).toBe("https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
    expect(JSON.stringify(d)).not.toContain("unit-test-cloudinary-secret");
  });
});
