import request from "supertest";
import bcrypt from "bcryptjs";
import type { Role, Size } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/lib/tokens";

export const app = createApp();
export const api = () => request(app);
export { prisma };

export async function resetDb() {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to wipe a non-test database");
  await prisma.$executeRawUnsafe(
    `TRUNCATE "WebhookEvent","OrderEvent","OrderItem","Order","CartItem","Cart","PasswordResetToken","RevokedToken","ProductVariant","Product","Category","User" CASCADE`,
  );
}

// A low bcrypt cost keeps the suite fast; production uses 12 rounds.
const fastHash = bcrypt.hashSync("Password1", 4);
let seq = 0;

export async function createUser(role: Role = "CUSTOMER", overrides: { email?: string; name?: string } = {}) {
  seq += 1;
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `user${seq}-${Date.now()}@aurelle.test`,
      name: overrides.name ?? `User ${seq}`,
      passwordHash: fastHash,
      role,
    },
  });
  const token = signAccessToken(user.id, user.tokenVersion);
  return { user, token, auth: `Bearer ${token}` };
}

export async function createCategory(name = `Category ${++seq}`) {
  return prisma.category.create({ data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") } });
}

export async function createProduct(
  categoryId: string,
  overrides: Partial<{
    name: string;
    pricePaise: number;
    stock: number;
    sizes: [Size, number][];
    active: boolean;
    description: string;
    soldCount: number;
    createdAt: Date;
  }> = {},
) {
  seq += 1;
  const name = overrides.name ?? `Product ${seq}`;
  const stock = overrides.stock ?? 10;
  const product = await prisma.product.create({
    data: {
      name,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${seq}`,
      description: overrides.description ?? "A well-made test product.",
      pricePaise: overrides.pricePaise ?? 100_000,
      stock,
      variants: { create: (overrides.sizes ?? [["FREE_SIZE", stock]]).map(([size, n]) => ({ size, stock: n })) },
      active: overrides.active ?? true,
      soldCount: overrides.soldCount ?? 0,
      images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab"],
      categoryId,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
    include: { variants: { orderBy: { size: "asc" } } },
  });
  // Products made with sizes get the total of their sizes as stock, like the real API.
  if (overrides.sizes) await prisma.product.update({ where: { id: product.id }, data: { stock: product.variants.reduce((n, v) => n + v.stock, 0) } });
  return { ...product, variantId: product.variants[0].id };
}

/** Sets the stock of a product's first (or only) size and keeps the product total in sync. */
export async function setStock(p: { id: string; variantId: string }, stock: number) {
  await prisma.productVariant.update({ where: { id: p.variantId }, data: { stock } });
  const sum = await prisma.productVariant.aggregate({ where: { productId: p.id }, _sum: { stock: true } });
  await prisma.product.update({ where: { id: p.id }, data: { stock: sum._sum.stock ?? 0 } });
}

export const address = {
  fullName: "Test Buyer",
  phone: "9876543210",
  line1: "12 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560001",
};

export const checkoutBody = (extra: Record<string, unknown> = {}) => ({
  shippingAddress: address,
  shippingMethod: "STANDARD",
  paymentMethod: "COD",
  ...extra,
});
