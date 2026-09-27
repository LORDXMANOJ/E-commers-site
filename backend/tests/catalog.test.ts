import { beforeAll, describe, expect, it } from "vitest";
import { api, createCategory, createProduct, resetDb } from "./helpers";

describe("catalog", () => {
  let tops: Awaited<ReturnType<typeof createCategory>>;

  beforeAll(async () => {
    await resetDb();
    tops = await createCategory("Tops");
    const shoes = await createCategory("Shoes");
    const day = 24 * 60 * 60 * 1000;
    await createProduct(tops.id, { name: "Linen Shirt", pricePaise: 250_000, stock: 5, soldCount: 3, createdAt: new Date(Date.now() - 3 * day) });
    await createProduct(tops.id, { name: "Cotton Tee", pricePaise: 90_000, stock: 0, soldCount: 10, createdAt: new Date(Date.now() - 2 * day) });
    await createProduct(shoes.id, { name: "Leather Derby", pricePaise: 800_000, stock: 2, description: "Goodyear welted linen-lined shoe", createdAt: new Date(Date.now() - day) });
    await createProduct(shoes.id, { name: "Hidden Boot", active: false });
  });

  const list = (qs = "") => api().get(`/api/products${qs}`).expect(200).then((r) => r.body.data);

  it("lists only active products, newest first, with pagination metadata", async () => {
    const data = await list();
    expect(data.items.map((p: { name: string }) => p.name)).toEqual(["Leather Derby", "Cotton Tee", "Linen Shirt"]);
    expect(data).toMatchObject({ total: 3, page: 1, totalPages: 1 });
  });

  it("searches name and description case-insensitively", async () => {
    const data = await list("?q=LINEN");
    expect(data.items.map((p: { name: string }) => p.name).sort()).toEqual(["Leather Derby", "Linen Shirt"]);
  });

  it("filters by category, price range and stock", async () => {
    expect((await list(`?category=${tops.slug}`)).total).toBe(2);
    expect((await list("?minPrice=100000&maxPrice=300000")).items.map((p: { name: string }) => p.name)).toEqual(["Linen Shirt"]);
    expect((await list("?inStock=true")).total).toBe(2);
  });

  it("sorts by price and popularity", async () => {
    const asc = await list("?sort=price_asc");
    expect(asc.items.map((p: { pricePaise: number }) => p.pricePaise)).toEqual([90_000, 250_000, 800_000]);
    const popular = await list("?sort=popular");
    expect(popular.items[0].name).toBe("Cotton Tee");
  });

  it("paginates", async () => {
    const page2 = await list("?limit=2&page=2");
    expect(page2).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(page2.items).toHaveLength(1);
  });

  it("validates query parameters", async () => {
    const res = await api().get("/api/products?minPrice=500&maxPrice=100").expect(400);
    expect(res.body.errors[0].path).toBe("minPrice");
    await api().get("/api/products?sort=random").expect(400);
    await api().get("/api/products?limit=1000").expect(400);
  });

  it("returns a product by slug, related products, and 404s", async () => {
    const { items } = await list("?q=Linen Shirt");
    const slug = items[0].slug;
    const res = await api().get(`/api/products/${slug}`).expect(200);
    expect(res.body.data).toMatchObject({ name: "Linen Shirt", category: { name: "Tops" } });

    const related = await api().get(`/api/products/${slug}/related`).expect(200);
    expect(related.body.data.map((p: { name: string }) => p.name)).toEqual(["Cotton Tee"]);

    await api().get("/api/products/does-not-exist").expect(404);
    const hidden = await api().get("/api/products?q=Hidden").expect(200);
    expect(hidden.body.data.total).toBe(0);
  });

  it("lists categories with active product counts", async () => {
    const res = await api().get("/api/categories").expect(200);
    const shoes = res.body.data.find((c: { name: string }) => c.name === "Shoes");
    expect(shoes.productCount).toBe(1);
  });

  it("returns a JSON 404 for unknown routes and 400 for malformed JSON", async () => {
    const r = await api().get("/api/nope").expect(404);
    expect(r.body).toMatchObject({ success: false });
    const bad = await api().post("/api/auth/login").set("Content-Type", "application/json").send('{"email":').expect(400);
    expect(bad.body).toEqual({ success: false, message: "Malformed request body" });
  });
});
