-- Size variants (stock per size) and Razorpay payment fields.
-- Safe on a database with existing data: every existing product gets one FREE_SIZE variant holding its
-- current stock, and existing cart items are pointed at that variant before the column becomes NOT NULL.

-- Enums
CREATE TYPE "Size" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE_SIZE');
ALTER TYPE "PaymentMethod" ADD VALUE 'RAZORPAY';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';

-- Variants
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" "Size" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductVariant_stock_nonnegative" CHECK ("stock" >= 0)
);
CREATE UNIQUE INDEX "ProductVariant_productId_size_key" ON "ProductVariant"("productId", "size");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one FREE_SIZE variant per existing product.
INSERT INTO "ProductVariant" ("id", "productId", "size", "stock", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'FREE_SIZE', p."stock", CURRENT_TIMESTAMP FROM "Product" p;

-- Cart items now reference a variant.
DROP INDEX "CartItem_cartId_productId_key";
ALTER TABLE "CartItem" ADD COLUMN "variantId" TEXT;
UPDATE "CartItem" ci SET "variantId" = v."id"
FROM "ProductVariant" v WHERE v."productId" = ci."productId" AND v."size" = 'FREE_SIZE';
ALTER TABLE "CartItem" ALTER COLUMN "variantId" SET NOT NULL;
CREATE UNIQUE INDEX "CartItem_cartId_variantId_key" ON "CartItem"("cartId", "variantId");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Order items keep a size snapshot; existing history has no size (NULL).
ALTER TABLE "OrderItem" ADD COLUMN "size" "Size", ADD COLUMN "variantId" TEXT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Razorpay fields on orders.
ALTER TABLE "Order"
    ADD COLUMN "paymentExpiresAt" TIMESTAMP(3),
    ADD COLUMN "razorpayOrderId" TEXT,
    ADD COLUMN "razorpayPaymentId" TEXT,
    ADD COLUMN "razorpayRefundId" TEXT;
CREATE UNIQUE INDEX "Order_razorpayOrderId_key" ON "Order"("razorpayOrderId");
CREATE UNIQUE INDEX "Order_razorpayPaymentId_key" ON "Order"("razorpayPaymentId");
CREATE UNIQUE INDEX "Order_razorpayRefundId_key" ON "Order"("razorpayRefundId");
CREATE INDEX "Order_paymentMethod_paymentStatus_paymentExpiresAt_idx"
    ON "Order"("paymentMethod", "paymentStatus", "paymentExpiresAt");

-- Webhook idempotency.
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
