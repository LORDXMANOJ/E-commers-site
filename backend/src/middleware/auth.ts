import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/http";
import { verifyAccessToken } from "../lib/tokens";

const unauthorized = () => new AppError(401, "Please sign in to continue");

/**
 * Verifies the Bearer JWT, rejects revoked tokens (logout) and stale tokens (password changed),
 * then loads the user fresh from the database. The role always comes from the DB, never the token.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized());

  const payload = verifyAccessToken(header.slice(7).trim());
  if (!payload) return next(unauthorized());

  const [user, revoked] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, tokenVersion: true },
    }),
    prisma.revokedToken.findUnique({ where: { jti: payload.jti }, select: { jti: true } }),
  ]);
  if (!user || revoked || user.tokenVersion !== payload.tv) return next(unauthorized());

  res.locals.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  res.locals.token = { jti: payload.jti, exp: payload.exp };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    if (!user) return next(unauthorized());
    if (!roles.includes(user.role)) return next(new AppError(403, "You do not have access to this resource"));
    next();
  };

/** The authenticated user. Only call after requireAuth. */
export function currentUser(res: Response) {
  const user = res.locals.user;
  if (!user) throw unauthorized();
  return user;
}
