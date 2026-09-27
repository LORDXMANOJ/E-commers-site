import { execSync } from "node:child_process";

/** Applies all migrations to the test database once before the suite runs. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}
