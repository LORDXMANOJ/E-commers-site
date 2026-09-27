import rateLimit from "express-rate-limit";
import { isTest } from "../config/env";

const message = { success: false, message: "Too many attempts. Please wait a few minutes and try again." };

/** Strict limiter for credential endpoints (login, register, password reset). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message,
});

/** Generous global limiter so a single client cannot hammer the API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  message,
});
