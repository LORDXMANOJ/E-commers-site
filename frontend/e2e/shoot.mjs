// Quick visual check: node e2e/shoot.mjs <outDir> <path> [path...]
// Env: BASE (default http://localhost:5174), THEME=light|dark, SIZES="390x844,820x1180,1440x900", LOGIN=email:password
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [outDir, ...paths] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:5174";
const THEME = process.env.THEME ?? "light";
const SIZES = (process.env.SIZES ?? "390x844,820x1180,1440x900").split(",").map((s) => s.split("x").map(Number));
const FULL = process.env.FULL !== "0";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: THEME });
  await ctx.addInitScript((t) => localStorage.setItem("aurelle.theme", t), THEME);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  if (process.env.LOGIN) {
    const [email, password] = process.env.LOGIN.split(":");
    const res = await page.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
    const { data } = await res.json();
    await ctx.addInitScript((t) => localStorage.setItem("aurelle.token", t), data.token);
  }
  for (const p of paths) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    // Scroll through the page so lazy images load before a full-page capture.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const name = `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${w}-${THEME}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage: FULL });
    console.log(`${name}${overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : ""}`);
  }
  if (errors.length) console.log(`  console errors @${w}:`, [...new Set(errors)].slice(0, 5));
  await ctx.close();
}
await browser.close();
