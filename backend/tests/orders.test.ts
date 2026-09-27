import { beforeEach, describe, expect, it } from "vitest";
import { api, checkoutBody, createCategory, createProduct, createUser, prisma, resetDb } from "./helpers";

async function addToCart(auth: string, productId: string, quantity = 1) {
  await api().post("/api/cart/items").set("Authorization", auth).send({ productId, quantity }).expect(200);
}

describe("checkout & orders", () => {
  let categoryId: string;

  beforeEach(async () => {
    await resetDb();
    categoryId = (await createCategory()).id;
  });

  it("requires login and a non-empty cart", async () => {
    await api().post("/api/orders").send(checkoutBody()).expect(401);
    const { auth } = await createUser();
    const res = await api().post("/api/orders").set("Authorization", auth).send(checkoutBody()).expect(400);
    expect(res.body.message).toBe("Your cart is empty");
  });

  it("validates the shipping address", async () => {
    const { auth } = await createUser();
    const res = await api()
      .post("/api/orders")
      .set("Authorization", auth)
      .send(checkoutBody({ shippingAddress: { fullName: "X" } }))
      .expect(400);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(
      expect.arrayContaining(["shippingAddress.phone", "shippingAddress.postalCode"]),
    );
  });

  it("recalculates prices on the server and ignores client-sent amounts", async () => {
    const { auth } = await createUser();
    const p = await createProduct(categoryId, { pricePaise: 120_000, stock: 5 });
    await addToCart(auth, p.id, 2);
    // Price changes after the item was added: the order must use the current DB price.
    await prisma.product.update({ where: { id: p.id }, data: { pricePaise: 130_000 } });

    const res = await api()
      .post("/api/orders")
      .set("Authorization", auth)
      .send(checkoutBody({ totalPaise: 1, subtotalPaise: 1, items: [{ productId: p.id, pricePaise: 1 }] }))
      .expect(201);

    expect(res.body.data).toMatchObject({
      subtotalPaise: 260_000,
      shippingPaise: 9_900, // below the ₹2,999 free-shipping threshold
      totalPaise: 269_900,
      status: "PENDING",
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
    });
    expect(res.body.data.orderNumber).toMatch(/^AUR-\d{6}-[A-Z0-9]{6}$/);
    expect(res.body.data.items[0]).toMatchObject({ unitPaise: 130_000, quantity: 2, lineTotalPaise: 260_000 });
    expect(res.body.data.events.map((e: { status: string }) => e.status)).toEqual(["PENDING"]);
  });

  it("applies free standard shipping over the threshold and charges express", async () => {
    const { auth } = await createUser();
    const p = await createProduct(categoryId, { pricePaise: 300_000, stock: 5 });
    await addToCart(auth, p.id);
    const free = await api().post("/api/orders").set("Authorization", auth).send(checkoutBody()).expect(201);
    expect(free.body.data.shippingPaise).toBe(0);

    await addToCart(auth, p.id);
    const express = await api().post("/api/orders").set("Authorization", auth).send(checkoutBody({ shippingMethod: "EXPRESS" })).expect(201);
    expect(express.body.data.shippingPaise).toBe(24_900);
  });

  it("decrements stock, snapshots items and clears the cart", async () => {
    const { auth } = await createUser();
    const p = await createProduct(categoryId, { stock: 5, name: "Wool Scarf" });
    await addToCart(auth, p.id, 3);
    const res = await api().post("/api/orders").set("Authorization", auth).send(checkoutBody({ saveAddress: true })).expect(201);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock).toBe(2);
    expect(after.soldCount).toBe(3);

    const cart = await api().get("/api/cart").set("Authorization", auth).expect(200);
    expect(cart.body.data.items).toHaveLength(0);

    // Snapshot survives product edits
    await prisma.product.update({ where: { id: p.id }, data: { name: "Renamed", pricePaise: 1 } });
    const detail = await api().get(`/api/orders/${res.body.data.id}`).set("Authorization", auth).expect(200);
    expect(detail.body.data.items[0]).toMatchObject({ name: "Wool Scarf", unitPaise: 100_000 });

    const me = await api().get("/api/auth/me").set("Authorization", auth).expect(200);
    expect(me.body.data.user.address).toMatchObject({ city: "Bengaluru" });
  });

  it("rolls back everything when any item is short on stock", async () => {
    const { auth } = await createUser();
    const a = await createProduct(categoryId, { stock: 5 });
    const b = await createProduct(categoryId, { stock: 5, name: "Rare Ring" });
    await addToCart(auth, a.id, 2);
    await addToCart(auth, b.id, 2);
    await prisma.product.update({ where: { id: b.id }, data: { stock: 1 } }); // someone else bought it

    const res = await api().post("/api/orders").set("Authorization", auth).send(checkoutBody()).expect(409);
    expect(res.body.message).toBe("Only 1 of Rare Ring left in stock");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(5);
    expect(await prisma.order.count()).toBe(0);
    const cart = await api().get("/api/cart").set("Authorization", auth).expect(200);
    expect(cart.body.data.items).toHaveLength(2);
  });

  it("never oversells under parallel checkouts", async () => {
    const STOCK = 3;
    const BUYERS = 8;
    const p = await createProduct(categoryId, { stock: BUYERS }); // allow everyone to add to cart
    const buyers = await Promise.all(Array.from({ length: BUYERS }, () => createUser()));
    for (const b of buyers) await addToCart(b.auth, p.id, 1);
    await prisma.product.update({ where: { id: p.id }, data: { stock: STOCK } });

    const results = await Promise.all(
      buyers.map((b) => api().post("/api/orders").set("Authorization", b.auth).send(checkoutBody())),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(STOCK);
    expect(statuses.filter((s) => s === 409)).toHaveLength(BUYERS - STOCK);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock).toBe(0);
    expect(await prisma.order.count()).toBe(STOCK);
  });

  it("places only one order when the same cart is submitted twice at once", async () => {
    const { auth } = await createUser();
    const p = await createProduct(categoryId, { stock: 10 });
    await addToCart(auth, p.id, 2);
    const [a, b] = await Promise.all([
      api().post("/api/orders").set("Authorization", auth).send(checkoutBody()),
      api().post("/api/orders").set("Authorization", auth).send(checkoutBody()),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(8);
  });

  it("handles the simulated card: approved, declined and invalid", async () => {
    const { auth } = await createUser();
    const p = await createProduct(categoryId, { stock: 5 });
    await addToCart(auth, p.id);
    const card = { name: "Test Buyer", number: "4242 4242 4242 4242", expiry: "12/39", cvc: "123" };

    await api().post("/api/orders").set("Authorization", auth).send(checkoutBody({ paymentMethod: "CARD_SIMULATED" })).expect(400);
    await api()
      .post("/api/orders")
      .set("Authorization", auth)
      .send(checkoutBody({ paymentMethod: "CARD_SIMULATED", card: { ...card, number: "4242 4242 4242 4241" } }))
      .expect(400); // fails Luhn
    await api()
      .post("/api/orders")
      .set("Authorization", auth)
      .send(checkoutBody({ paymentMethod: "CARD_SIMULATED", card: { ...card, expiry: "01/20" } }))
      .expect(400);
    const declined = await api()
      .post("/api/orders")
      .set("Authorization", auth)
      .send(checkoutBody({ paymentMethod: "CARD_SIMULATED", card: { ...card, number: "4000 0000 0000 0002" } }))
      .expect(402);
    expect(declined.body.message).toMatch(/declined/);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(5);

    const paid = await api()
      .post("/api/orders")
      .set("Authorization", auth)
      .send(checkoutBody({ paymentMethod: "CARD_SIMULATED", card }))
      .expect(201);
    expect(paid.body.data).toMatchObject({ paymentStatus: "PAID", cardLast4: "4242" });
    expect(JSON.stringify(paid.body)).not.toContain("4242 4242 4242 4242");
  });

  it("only lets customers see and cancel their own orders (404 otherwise)", async () => {
    const owner = await createUser();
    const other = await createUser();
    const p = await createProduct(categoryId, { stock: 5 });
    await addToCart(owner.auth, p.id);
    const order = (await api().post("/api/orders").set("Authorization", owner.auth).send(checkoutBody()).expect(201)).body.data;

    await api().get(`/api/orders/${order.id}`).set("Authorization", other.auth).expect(404);
    await api().post(`/api/orders/${order.id}/cancel`).set("Authorization", other.auth).expect(404);
    const list = await api().get("/api/orders").set("Authorization", other.auth).expect(200);
    expect(list.body.data.total).toBe(0);

    const mine = await api().get("/api/orders").set("Authorization", owner.auth).expect(200);
    expect(mine.body.data.items.map((o: { id: string }) => o.id)).toEqual([order.id]);
    await api().get("/api/orders/nonexistent").set("Authorization", owner.auth).expect(404);
  });

  it("restores stock when a pending order is cancelled, and only once", async () => {
    const { auth } = await createUser();
    const p = await createProduct(categoryId, { stock: 5 });
    await addToCart(auth, p.id, 2);
    const order = (await api().post("/api/orders").set("Authorization", auth).send(checkoutBody()).expect(201)).body.data;
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(3);

    const [a, b] = await Promise.all([
      api().post(`/api/orders/${order.id}/cancel`).set("Authorization", auth),
      api().post(`/api/orders/${order.id}/cancel`).set("Authorization", auth),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.stock).toBe(5);
    expect(after.soldCount).toBe(0);

    const detail = await api().get(`/api/orders/${order.id}`).set("Authorization", auth).expect(200);
    expect(detail.body.data.status).toBe("CANCELLED");
    expect(detail.body.data.events.map((e: { status: string }) => e.status)).toEqual(["PENDING", "CANCELLED"]);
  });

  it("lets admins move orders through valid transitions only; customers cannot cancel after confirmation", async () => {
    const customer = await createUser();
    const admin = await createUser("ADMIN");
    const p = await createProduct(categoryId, { stock: 5 });
    await addToCart(customer.auth, p.id);
    const order = (await api().post("/api/orders").set("Authorization", customer.auth).send(checkoutBody()).expect(201)).body.data;
    const setStatus = (status: string) =>
      api().patch(`/api/admin/orders/${order.id}/status`).set("Authorization", admin.auth).send({ status });

    expect((await setStatus("DELIVERED")).status).toBe(409); // cannot skip steps
    expect((await setStatus("CONFIRMED")).status).toBe(200);
    await api().post(`/api/orders/${order.id}/cancel`).set("Authorization", customer.auth).expect(409);
    expect((await setStatus("SHIPPED")).status).toBe(200);
    expect((await setStatus("CANCELLED")).status).toBe(409); // too late
    const delivered = await setStatus("DELIVERED");
    expect(delivered.status).toBe(200);
    expect(delivered.body.data).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID" }); // COD collected
    expect((await setStatus("PENDING")).status).toBe(409);
    expect((await setStatus("BOGUS")).status).toBe(400);

    const seen = await api().get(`/api/orders/${order.id}`).set("Authorization", customer.auth).expect(200);
    expect(seen.body.data.events.map((e: { status: string }) => e.status)).toEqual(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"]);

    const stats = await api().get("/api/admin/stats").set("Authorization", admin.auth).expect(200);
    expect(stats.body.data).toMatchObject({ orderCount: 1, revenuePaise: order.totalPaise });
  });

  it("restores stock when an admin cancels a confirmed card order and marks it refunded", async () => {
    const customer = await createUser();
    const admin = await createUser("ADMIN");
    const p = await createProduct(categoryId, { stock: 4 });
    await addToCart(customer.auth, p.id, 4);
    const card = { name: "T", number: "4242424242424242", expiry: "12/39", cvc: "123" };
    const order = (
      await api().post("/api/orders").set("Authorization", customer.auth).send(checkoutBody({ paymentMethod: "CARD_SIMULATED", card: { ...card, name: "Test" } })).expect(201)
    ).body.data;
    await api().patch(`/api/admin/orders/${order.id}/status`).set("Authorization", admin.auth).send({ status: "CONFIRMED" }).expect(200);
    const res = await api().patch(`/api/admin/orders/${order.id}/status`).set("Authorization", admin.auth).send({ status: "CANCELLED" }).expect(200);
    expect(res.body.data.paymentStatus).toBe("REFUNDED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(4);
  });
});
