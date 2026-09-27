// End-to-end journey through the real UI, API and database.
//   guest adds to bag → registers (bag merges) → browses & filters → checks out → sees the order
//   → admin confirms & ships it → customer sees the new status.
//
// Needs the API (seeded) and the web app running:  BASE=http://localhost:5173 npm run e2e
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:5173";
const HEADED = process.env.HEADED === "1";
const email = `e2e-${Date.now()}@example.com`;
const step = (msg) => console.log(`✓ ${msg}`);

const browser = await chromium.launch({ headless: !HEADED });
const errors = [];
const watch = (page, who) => {
  page.on("pageerror", (e) => errors.push(`[${who}] ${e.message}`));
  page.on("console", (m) => {
    // 4xx responses we trigger on purpose (e.g. /auth/me with no session) are expected noise.
    if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) errors.push(`[${who}] ${m.text()}`);
  });
};

try {
  /* ───────────────── Customer ───────────────── */
  const customer = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await customer.newPage();
  watch(page, "customer");
  if (process.env.DEBUG) page.on("request", (r) => r.url().includes("/api/") && console.log("  →", r.method(), r.url().split("/api")[1]));

  // 1. Browse and filter as a guest; filter state is reflected in the URL.
  await page.goto(`${BASE}/shop`);
  await page.getByRole("heading", { name: "All products" }).waitFor();
  const filters = page.getByRole("complementary", { name: "Filters" });
  await filters.getByRole("button", { name: /^Outerwear/ }).click();
  await page.waitForURL(/category=outerwear/);
  await page.getByRole("heading", { name: "Outerwear", level: 1 }).waitFor();
  await filters.getByRole("button", { name: "₹5,000 – ₹10,000" }).click();
  await page.waitForURL(/min=5000&max=10000|max=10000.*min=5000/);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/products?") && r.url().includes("sort=price_asc") && r.url().includes("minPrice=500000")),
    page.getByLabel("Sort by").selectOption("price_asc"),
  ]);
  await page.waitForURL(/sort=price_asc/);
  const results = page.getByRole("region", { name: "Products" });
  await page.locator('section[aria-label="Products"][aria-busy="false"]').waitFor();
  await page.getByText(/^\d+ products?$/).waitFor();
  const names = await results.locator("article h3").allTextContents();
  const prices = (await results.locator("article p.num > span:first-child").allTextContents()).map((t) => Number(t.replace(/[^\d]/g, "")));
  assert.ok(names.length > 0, "filtered results should not be empty");
  assert.ok(prices.every((p) => p >= 5000 && p <= 10000), `prices within range: ${prices}`);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b), "sorted by price ascending");
  step(`filtered to Outerwear ₹5,000–₹10,000, price ↑: ${names.join(", ")}`);

  // 2. Open a product and add it to the guest bag.
  await results.locator("article a").first().click();
  await page.waitForURL(/\/product\//);
  await page.getByRole("button", { name: "Add to bag" }).waitFor();
  const productName = (await page.getByRole("heading", { level: 1 }).textContent()).trim();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.getByRole("button", { name: "Open bag, 2 items" }).waitFor();
  step(`guest added 2 × ${productName} to the bag (localStorage)`);

  // 3. Checkout requires login → register → guest bag merges into the server cart.
  await page.getByRole("button", { name: "Open bag, 2 items" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Check out" }).click();
  await page.waitForURL(/\/login\?next=%2Fcheckout/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill("Esha Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Tester123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/checkout$/);
  await page.getByRole("button", { name: "Open bag, 2 items" }).waitFor();
  step(`registered ${email}; guest bag merged into server cart and redirected to checkout`);

  // 4. Checkout: address → delivery → payment → review → place order.
  await page.getByLabel("Full name").fill("Esha Tester");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByLabel("Address", { exact: true }).fill("22 Residency Road");
  await page.getByLabel("City").fill("Bengaluru");
  await page.getByLabel("PIN code").fill("560025");
  await page.getByLabel("State").selectOption("Karnataka");
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await page.getByText("Express", { exact: true }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByText("Cash on delivery", { exact: true }).click();
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("heading", { name: /Check everything/ }).waitFor();
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/checkout\/success\//);
  const orderNumber = (await page.getByTestId("order-number").textContent()).trim();
  assert.match(orderNumber, /^AUR-\d{6}-[A-Z0-9]{6}$/);
  await page.getByRole("button", { name: "Open bag, 0 items" }).waitFor();
  step(`placed order ${orderNumber}; bag emptied`);

  // 5. The order is visible in "My orders" as Pending.
  await page.getByRole("link", { name: "Track this order" }).click();
  await page.getByRole("heading", { name: orderNumber }).waitFor();
  await page.locator("main").getByText("Pending", { exact: true }).first().waitFor();
  const orderUrl = page.url();
  step("customer sees the order as Pending");

  /* ───────────────── Admin ───────────────── */
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminCtx.newPage();
  watch(admin, "admin");
  await admin.goto(`${BASE}/login`);
  await admin.getByLabel("Email").fill("admin@aurelle.dev");
  await admin.getByLabel("Password").fill("Admin1234");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL(/\/admin$/);
  await admin.getByRole("heading", { name: "Dashboard" }).waitFor();
  step("admin signed in and landed on the dashboard");

  await admin.goto(`${BASE}/admin/orders?q=${orderNumber}`);
  await admin.getByRole("link", { name: orderNumber }).click();
  await admin.getByRole("button", { name: "Confirm order" }).click();
  await admin.getByRole("button", { name: "Mark as shipped" }).waitFor();
  await admin.getByLabel("Note for the timeline (optional)").fill("Shipped via Blue Dart");
  await admin.getByRole("button", { name: "Mark as shipped" }).click();
  await admin.getByRole("button", { name: "Mark as delivered" }).waitFor();
  step("admin confirmed and shipped the order");

  /* ───────────────── Customer sees update ───────────────── */
  await page.goto(orderUrl);
  await page.locator("main").getByText("Shipped", { exact: true }).first().waitFor();
  const timeline = await page.getByRole("list", { name: "Order progress" }).textContent();
  assert.ok(/Confirmed/.test(timeline) && /Shipped/.test(timeline));
  step("customer sees the new status: Shipped (timeline updated)");

  // 6. Customers are blocked from the admin panel in the UI (the API also returns 403).
  await page.goto(`${BASE}/admin`);
  await page.getByRole("heading", { name: "Admins only" }).waitFor();
  const token = await page.evaluate(() => localStorage.getItem("aurelle.token"));
  const res = await page.request.get(`${BASE}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status(), 403);
  step("customer is blocked from /admin (UI) and gets 403 from /api/admin/stats");

  // 7. Forgot / reset password through the UI (development shows the link since there is no email provider).
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const g = await guest.newPage();
  watch(g, "reset");
  await g.goto(`${BASE}/forgot-password`);
  await g.getByLabel("Email").fill(email);
  await g.getByRole("button", { name: "Send reset link" }).click();
  await g.getByRole("heading", { name: "Check your email" }).waitFor();
  const devLink = g.getByTestId("dev-reset-link");
  if (await devLink.count()) {
    await devLink.click();
    await g.getByLabel("New password", { exact: true }).fill("Changed456");
    await g.getByLabel("Confirm new password").fill("Changed456");
    await g.getByRole("button", { name: "Update password" }).click();
    await g.waitForURL(/\/login$/);
    await g.getByLabel("Email").fill(email);
    await g.getByLabel("Password").fill("Changed456");
    await g.getByRole("button", { name: "Sign in" }).click();
    await g.waitForURL((u) => !u.pathname.startsWith("/login"));
    // The old session was signed out by the reset.
    const stale = await page.request.get(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(stale.status(), 401);
    step("password reset via the dev link, signed in with the new password; old session revoked (401)");
  } else {
    step("password reset request accepted (no dev link: email provider configured or production)");
  }

  if (errors.length) {
    console.error("Browser errors:\n  " + errors.join("\n  "));
    process.exitCode = 1;
  } else {
    console.log("\nE2E journey passed with no browser errors.");
  }
} catch (e) {
  console.error("E2E FAILED:", e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
