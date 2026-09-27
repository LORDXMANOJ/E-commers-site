import { beforeEach, describe, expect, it } from "vitest";
import { api, createCategory, createProduct, createUser, resetDb } from "./helpers";

describe("cart", () => {
  let auth: string;
  let categoryId: string;

  beforeEach(async () => {
    await resetDb();
    auth = (await createUser()).auth;
    categoryId = (await createCategory()).id;
  });

  it("requires login", async () => {
    await api().get("/api/cart").expect(401);
  });

  it("adds, updates, and removes items with live server prices", async () => {
    const p = await createProduct(categoryId, { pricePaise: 150_000, stock: 5 });
    let res = await api().post("/api/cart/items").set("Authorization", auth).send({ productId: p.id, quantity: 2 }).expect(200);
    expect(res.body.data).toMatchObject({ itemCount: 2, subtotalPaise: 300_000 });

    res = await api().post("/api/cart/items").set("Authorization", auth).send({ productId: p.id }).expect(200);
    expect(res.body.data.items[0].quantity).toBe(3);

    res = await api().patch(`/api/cart/items/${p.id}`).set("Authorization", auth).send({ quantity: 1 }).expect(200);
    expect(res.body.data.subtotalPaise).toBe(150_000);

    res = await api().delete(`/api/cart/items/${p.id}`).set("Authorization", auth).expect(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("refuses more than the available stock", async () => {
    const p = await createProduct(categoryId, { stock: 2, name: "Silk Scarf" });
    const res = await api().post("/api/cart/items").set("Authorization", auth).send({ productId: p.id, quantity: 3 }).expect(409);
    expect(res.body.message).toBe("Only 2 of Silk Scarf left in stock");

    const soldOut = await createProduct(categoryId, { stock: 0 });
    await api().post("/api/cart/items").set("Authorization", auth).send({ productId: soldOut.id }).expect(409);
  });

  it("404s for unknown or inactive products and validates quantity", async () => {
    const inactive = await createProduct(categoryId, { active: false });
    await api().post("/api/cart/items").set("Authorization", auth).send({ productId: inactive.id }).expect(404);
    await api().post("/api/cart/items").set("Authorization", auth).send({ productId: "missing" }).expect(404);
    const p = await createProduct(categoryId);
    await api().post("/api/cart/items").set("Authorization", auth).send({ productId: p.id, quantity: 0 }).expect(400);
    await api().post("/api/cart/items").set("Authorization", auth).send({ productId: p.id, quantity: 2.5 }).expect(400);
  });

  it("merges a guest cart, summing quantities capped at stock and skipping bad items", async () => {
    const a = await createProduct(categoryId, { stock: 4 });
    const b = await createProduct(categoryId, { stock: 10 });
    const inactive = await createProduct(categoryId, { active: false });
    await api().post("/api/cart/items").set("Authorization", auth).send({ productId: a.id, quantity: 3 }).expect(200);

    const res = await api()
      .post("/api/cart/merge")
      .set("Authorization", auth)
      .send({
        items: [
          { productId: a.id, quantity: 3 },
          { productId: b.id, quantity: 2 },
          { productId: inactive.id, quantity: 1 },
          { productId: "ghost", quantity: 1 },
        ],
      })
      .expect(200);

    const qty = Object.fromEntries(res.body.data.items.map((i: { productId: string; quantity: number }) => [i.productId, i.quantity]));
    expect(qty).toEqual({ [a.id]: 4, [b.id]: 2 });
  });
});
