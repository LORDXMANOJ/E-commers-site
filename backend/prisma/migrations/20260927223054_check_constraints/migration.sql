-- Defense in depth: the database itself refuses negative stock and invalid money/quantities,
-- even if application code has a bug. The checkout's conditional UPDATE is the primary guard.
ALTER TABLE "Product"   ADD CONSTRAINT "Product_stock_nonnegative"  CHECK ("stock" >= 0);
ALTER TABLE "Product"   ADD CONSTRAINT "Product_price_nonnegative"  CHECK ("pricePaise" >= 0);
ALTER TABLE "Product"   ADD CONSTRAINT "Product_compare_nonnegative" CHECK ("compareAtPaise" IS NULL OR "compareAtPaise" >= 0);
ALTER TABLE "CartItem"  ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Order"     ADD CONSTRAINT "Order_totals_nonnegative"   CHECK ("subtotalPaise" >= 0 AND "shippingPaise" >= 0 AND "totalPaise" >= 0);
