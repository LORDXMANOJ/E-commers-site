import { Router } from "express";
import { z } from "zod";
import { requireAuth, currentUser } from "../../middleware/auth";
import { validate, getBody, getParams } from "../../middleware/validate";
import { ok } from "../../lib/http";
import * as cart from "./cart.service";

const MAX_QTY = 20;
const productId = z.string().min(1).max(64);
const quantity = z.coerce.number().int().min(1, "Quantity must be at least 1").max(MAX_QTY, `At most ${MAX_QTY} per item`);

const addSchema = z.object({ productId, quantity: quantity.default(1) });
const qtySchema = z.object({ quantity });
const itemParam = z.object({ productId });
const mergeSchema = z.object({
  items: z.array(z.object({ productId, quantity: z.coerce.number().int().min(1).max(MAX_QTY) })).max(100),
});

export const cartRouter = Router();
cartRouter.use(requireAuth);

cartRouter.get("/", async (_req, res) => ok(res, await cart.getCart(currentUser(res).id)));

cartRouter.post("/items", validate({ body: addSchema }), async (_req, res) => {
  const { productId, quantity } = getBody(res, addSchema);
  ok(res, await cart.addItem(currentUser(res).id, productId, quantity));
});

cartRouter.patch("/items/:productId", validate({ params: itemParam, body: qtySchema }), async (_req, res) => {
  ok(
    res,
    await cart.setItemQuantity(currentUser(res).id, getParams(res, itemParam).productId, getBody(res, qtySchema).quantity),
  );
});

cartRouter.delete("/items/:productId", validate({ params: itemParam }), async (_req, res) => {
  ok(res, await cart.removeItem(currentUser(res).id, getParams(res, itemParam).productId));
});

cartRouter.delete("/", async (_req, res) => ok(res, await cart.clearCart(currentUser(res).id)));

cartRouter.post("/merge", validate({ body: mergeSchema }), async (_req, res) => {
  ok(res, await cart.mergeCart(currentUser(res).id, getBody(res, mergeSchema).items));
});
