import { Router } from "express";
import { z } from "zod";
import { validate, getBody } from "../../middleware/validate";
import { requireAuth, currentUser } from "../../middleware/auth";
import { authLimiter } from "../../middleware/rateLimit";
import { ok } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { emailSchema, nameSchema, passwordSchema } from "../../lib/schemas";
import { env } from "../../config/env";
import * as auth from "./auth.service";

const registerSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema }).strict();
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(200) });
const forgotSchema = z.object({ email: emailSchema });
const resetSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid reset token"), password: passwordSchema });

export const authRouter = Router();

// `.strict()` above means a client-sent `role` field is rejected outright, never trusted.
authRouter.post("/register", authLimiter, validate({ body: registerSchema }), async (_req, res) => {
  ok(res, await auth.register(getBody(res, registerSchema)), 201);
});

authRouter.post("/login", authLimiter, validate({ body: loginSchema }), async (_req, res) => {
  ok(res, await auth.login(getBody(res, loginSchema)));
});

authRouter.post("/logout", requireAuth, async (_req, res) => {
  const { jti, exp } = res.locals.token!;
  await auth.logout(jti, exp);
  ok(res, { message: "Signed out" });
});

authRouter.get("/me", requireAuth, async (_req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(res).id } });
  ok(res, { user: auth.toPublicUser(user) });
});

authRouter.post("/forgot-password", authLimiter, validate({ body: forgotSchema }), async (_req, res) => {
  const { email } = getBody(res, forgotSchema);
  const { devResetUrl } = await auth.requestPasswordReset(email, env.CLIENT_URL[0]);
  ok(res, {
    message: "If an account exists for that email, a reset link is on its way.",
    ...(devResetUrl ? { devResetUrl } : {}),
  });
});

authRouter.post("/reset-password", authLimiter, validate({ body: resetSchema }), async (_req, res) => {
  const { token, password } = getBody(res, resetSchema);
  await auth.resetPassword(token, password);
  ok(res, { message: "Password updated. Sign in with your new password." });
});
