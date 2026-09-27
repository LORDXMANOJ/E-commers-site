import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth, currentUser } from "../../middleware/auth";
import { validate, getBody } from "../../middleware/validate";
import { ok } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { addressSchema, nameSchema, passwordSchema } from "../../lib/schemas";
import { changePassword, toPublicUser } from "../auth/auth.service";

const profileSchema = z.object({ name: nameSchema });
const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema });
const addressBody = z.object({ address: addressSchema.nullable() });

export const accountRouter = Router();
accountRouter.use(requireAuth);

accountRouter.patch("/", validate({ body: profileSchema }), async (_req, res) => {
  const user = await prisma.user.update({
    where: { id: currentUser(res).id },
    data: { name: getBody(res, profileSchema).name },
  });
  ok(res, { user: toPublicUser(user) });
});

accountRouter.put("/password", validate({ body: passwordChangeSchema }), async (_req, res) => {
  const { currentPassword, newPassword } = getBody(res, passwordChangeSchema);
  ok(res, await changePassword(currentUser(res).id, currentPassword, newPassword));
});

accountRouter.put("/address", validate({ body: addressBody }), async (_req, res) => {
  const { address } = getBody(res, addressBody);
  const user = await prisma.user.update({
    where: { id: currentUser(res).id },
    data: { address: address ?? Prisma.DbNull },
  });
  ok(res, { user: toPublicUser(user) });
});
