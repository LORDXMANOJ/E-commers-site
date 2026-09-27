import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { ok } from "./lib/http";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { authRouter } from "./modules/auth/auth.routes";
import { accountRouter } from "./modules/account/account.routes";
import { catalogRouter } from "./modules/catalog/catalog.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { adminRouter } from "./modules/admin/admin.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Render / Vercel proxies: use the real client IP for rate limits
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Non-browser clients (curl, health checks) send no Origin header.
        if (!origin || env.CLIENT_URL.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", async (_req, res) => {
    let db = "up";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    res.status(db === "up" ? 200 : 503).json({ success: db === "up", data: { status: "ok", db } });
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth", authRouter);
  app.use("/api/me", accountRouter);
  app.use("/api", catalogRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/admin", adminRouter);

  app.get("/", (_req, res) => ok(res, { name: "Aurelle API", docs: "/api/health" }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
