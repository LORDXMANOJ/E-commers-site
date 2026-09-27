import { beforeEach, describe, expect, it } from "vitest";
import { api, createCategory, createProduct, createUser, prisma, resetDb } from "./helpers";

const adminEndpoints: [string, string][] = [
  ["get", "/api/admin/stats"],
  ["get", "/api/admin/products"],
  ["post", "/api/admin/products"],
  ["patch", "/api/admin/products/x"],
  ["delete", "/api/admin/products/x"],
  ["get", "/api/admin/categories"],
  ["post", "/api/admin/categories"],
  ["delete", "/api/admin/categories/x"],
  ["get", "/api/admin/orders"],
  ["patch", "/api/admin/orders/x/status"],
  ["get", "/api/admin/customers"],
];

describe("role-based access", () => {
  beforeEach(resetDb);

  it.each(adminEndpoints)("anonymous %s %s → 401", async (method, url) => {
    const res = await (api() as unknown as Record<string, (u: string) => import("supertest").Test>)[method](url).send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it.each(adminEndpoints)("customer %s %s → 403", async (method, url) => {
    const { auth } = await createUser("CUSTOMER");
    const res = await (api() as unknown as Record<string, (u: string) => import("supertest").Test>)
      [method](url)
      .set("Authorization", auth)
      .send({});
    expect(res.status).toBe(403);
  });

  it("uses the role from the database, not the token", async () => {
    const { user, auth } = await createUser("ADMIN");
    await api().get("/api/admin/stats").set("Authorization", auth).expect(200);
    await prisma.user.update({ where: { id: user.id }, data: { role: "CUSTOMER" } });
    await api().get("/api/admin/stats").set("Authorization", auth).expect(403);
  });

  it("lets an admin manage categories and products", async () => {
    const { auth } = await createUser("ADMIN");
    const cat = await api().post("/api/admin/categories").set("Authorization", auth).send({ name: "Knitwear" }).expect(201);
    expect(cat.body.data.slug).toBe("knitwear");

    const body = {
      name: "Merino Rollneck",
      description: "Fine-gauge merino with a double rollneck.",
      pricePaise: 459_000,
      compareAtPaise: 399_000,
      categoryId: cat.body.data.id,
      stock: 7,
      images: ["https://images.unsplash.com/photo-1434389677669-e08b4cac3105"],
    };
    // compare-at must be higher than price
    await api().post("/api/admin/products").set("Authorization", auth).send(body).expect(400);
    const created = await api()
      .post("/api/admin/products")
      .set("Authorization", auth)
      .send({ ...body, compareAtPaise: 520_000 })
      .expect(201);
    expect(created.body.data).toMatchObject({ slug: "merino-rollneck", pricePaise: 459_000, active: true });

    await api().post("/api/admin/products").set("Authorization", auth).send({ ...body, compareAtPaise: null }).expect(409); // same slug

    const updated = await api()
      .patch(`/api/admin/products/${created.body.data.id}`)
      .set("Authorization", auth)
      .send({ stock: 2, active: false })
      .expect(200);
    expect(updated.body.data).toMatchObject({ stock: 2, active: false });

    // Category with products cannot be deleted
    await api().delete(`/api/admin/categories/${cat.body.data.id}`).set("Authorization", auth).expect(409);
    await api().delete(`/api/admin/products/${created.body.data.id}`).set("Authorization", auth).expect(200);
    await api().delete(`/api/admin/products/${created.body.data.id}`).set("Authorization", auth).expect(404);
    await api().delete(`/api/admin/categories/${cat.body.data.id}`).set("Authorization", auth).expect(200);
  });

  it("lists customers with order counts for admins", async () => {
    const { auth } = await createUser("ADMIN");
    await createUser("CUSTOMER", { name: "Meera" });
    const res = await api().get("/api/admin/customers?role=CUSTOMER").set("Authorization", auth).expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ name: "Meera", orderCount: 0, totalSpentPaise: 0 });
  });

  it("returns dashboard stats on an empty database", async () => {
    const { auth } = await createUser("ADMIN");
    const cat = await createCategory();
    await createProduct(cat.id, { stock: 2 });
    const res = await api().get("/api/admin/stats").set("Authorization", auth).expect(200);
    expect(res.body.data).toMatchObject({ revenuePaise: 0, orderCount: 0, averageOrderPaise: 0 });
    expect(res.body.data.sales).toHaveLength(14);
    expect(res.body.data.lowStock).toHaveLength(1);
  });
});
