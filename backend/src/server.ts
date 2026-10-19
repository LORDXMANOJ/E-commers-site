import { env } from "./config/env";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { razorpayEnabled, razorpayMode } from "./config/env";
import { expireUnpaidOrders } from "./modules/orders/orders.service";

const server = createApp().listen(env.PORT, () => {
  console.log(`Aurelle API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`Payments: Razorpay ${razorpayMode === "off" ? "not configured (COD and simulated card only)" : `${razorpayMode} mode`}`);
});

// Release stock held by online orders that were never paid. Runs every 5 minutes.
const sweep = razorpayEnabled
  ? setInterval(() => {
      expireUnpaidOrders()
        .then((r) => r.cancelled && console.log(`Expired ${r.cancelled} unpaid order(s)`))
        .catch((e) => console.error("Payment expiry sweep failed:", e instanceof Error ? e.message : e));
    }, 5 * 60_000)
  : null;
sweep?.unref();

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
