import "dotenv/config";
import { defineConfig } from "vitest/config";

const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error("TEST_DATABASE_URL must be set to run tests (never point tests at your real database).");

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    // All files share one real PostgreSQL database, so they run one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDb,
      CLIENT_URL: "http://localhost:5173",
      JWT_SECRET: "test-secret-that-is-definitely-longer-than-32-chars",
      ADMIN_EMAILS: "boss@aurelle.test",
      RESEND_API_KEY: "",
      // Fake credentials: tests replace the Razorpay gateway with an in-memory fake and never call the API.
      RAZORPAY_KEY_ID: "rzp_test_unittest",
      RAZORPAY_KEY_SECRET: "unit-test-key-secret",
      RAZORPAY_WEBHOOK_SECRET: "unit-test-webhook-secret",
      RAZORPAY_ALLOW_LIVE: "false",
      CLOUDINARY_CLOUD_NAME: "demo-cloud",
      CLOUDINARY_API_KEY: "123456",
      CLOUDINARY_API_SECRET: "unit-test-cloudinary-secret",
    },
  },
});
