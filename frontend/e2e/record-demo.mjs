// Records a captioned walkthrough of the demo store: sign in → browse → choose a size → bag → checkout → order.
// Every frame carries a "DEMO ONLY" label. Uses Chrome's own screencast (CDP) and ffmpeg to build an MP4,
// which is more reliable on Windows than Playwright's recordVideo.
//
//   BASE=http://localhost:5173 PW_CHANNEL=chrome FFMPEG=<path to ffmpeg> node e2e/record-demo.mjs <out.mp4>
//
// Needs the API (freshly seeded) and the web app running. Uses cash on delivery so no payment window is needed.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const outFile = path.resolve(process.argv[2] ?? "aurelle-demo.mp4");
const BASE = process.env.BASE ?? "http://localhost:5173";
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const SIZE = { width: 1280, height: 720 };
const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), "aurelle-frames-"));

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined, slowMo: 120 });
const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, colorScheme: "light" });

// A fixed label and caption bar drawn on top of the site in every frame.
await ctx.addInitScript(() => {
  const mount = () => {
    if (document.getElementById("__demo_overlay")) return;
    const wrap = document.createElement("div");
    wrap.id = "__demo_overlay";
    wrap.innerHTML = `
      <div style="position:fixed;top:12px;right:12px;z-index:2147483647;background:#b42318;color:#fff;font:700 13px/1 system-ui,sans-serif;letter-spacing:.08em;padding:8px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.25)">DEMO ONLY · NO REAL PAYMENT</div>
      <div id="__demo_caption" style="position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;max-width:90vw;background:rgba(17,22,40,.92);color:#fff;font:500 17px/1.35 system-ui,sans-serif;padding:10px 18px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.3);text-align:center"></div>`;
    document.documentElement.appendChild(wrap);
    const saved = sessionStorage.getItem("__demo_caption");
    if (saved) document.getElementById("__demo_caption").textContent = saved;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
});

const page = await ctx.newPage();

// Chrome sends a frame whenever the page changes, with a timestamp; each frame is shown until the next one.
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = path.join(framesDir, `f${String(frames.length).padStart(6, "0")}.jpg`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: SIZE.width, maxHeight: SIZE.height, everyNthFrame: 1 });

const caption = async (text, hold = 1800) => {
  await page.evaluate((t) => {
    sessionStorage.setItem("__demo_caption", t);
    const el = document.getElementById("__demo_caption");
    if (el) el.textContent = t;
  }, text);
  await page.waitForTimeout(hold);
};
const scrollBy = async (y, steps = 8) => {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, y / steps);
    await page.waitForTimeout(140);
  }
};

let failed = false;
try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await caption("Aurelle demo store: fictional products, customers and orders. No real money is charged.", 3500);
  await scrollBy(900);
  await caption("Shop by category: sarees, kurtas, lehengas, anarkalis, suit sets and jewellery", 2500);
  await scrollBy(-900, 4);

  // 1. Sign in
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await caption("1. Sign in with the demo customer account", 1200);
  await page.getByLabel("Email").pressSequentially("demo@aurelle.dev", { delay: 40 });
  await page.getByLabel("Password").pressSequentially("Demo1234", { delay: 40 });
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await caption("Signed in", 1000);

  // 2. Browse and filter
  await page.goto(`${BASE}/shop?category=kurtas`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Kurtas & Kurtis", level: 1 }).waitFor();
  await caption("2. Browse the catalogue. Filter by category, price and size.", 2400);
  await page.getByRole("complementary", { name: "Filters" }).getByRole("button", { name: "M", exact: true }).click();
  await page.waitForURL(/size=M/);
  await page.waitForLoadState("networkidle");
  await caption("Showing kurtas with size M in stock", 2200);

  // 3. Product + size
  await page.getByRole("link", { name: /Rose Chikankari Kurta/ }).first().click();
  await page.getByRole("button", { name: "Select a size" }).waitFor();
  await page.waitForLoadState("networkidle");
  await caption("3. Each size shows its own stock. Sold-out sizes are struck through.", 2800);
  await page.locator("summary", { hasText: "Size guide" }).click();
  await caption("A size guide in inches", 2000);
  await page.locator("summary", { hasText: "Size guide" }).click();
  await page.locator('label:has(input[name="size"]:not([disabled]))', { hasText: /^M$/ }).click();
  await caption("Choose size M", 1300);
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await caption("Added 2 × Rose Chikankari Kurta (size M) to the bag", 2000);

  // A Free Size saree too
  await page.goto(`${BASE}/product/saffron-organza-saree`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add to bag" }).waitFor();
  await caption("Sarees are Free Size, so no size choice is needed", 2000);
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.waitForTimeout(900);

  // 4. Bag
  await page.getByRole("button", { name: /Open bag/ }).click();
  await caption("4. The bag lists each item with its size", 2800);
  await page.getByRole("dialog").getByRole("button", { name: "Check out" }).click();
  await page.waitForURL(/\/checkout/);

  // 5. Checkout
  await caption("5. Checkout, step 1: the saved address is filled in", 2000);
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await caption("Step 2: standard or express delivery", 1800);
  await page.getByText("Express", { exact: true }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await caption("Step 3: payment", 1000);
  await page.getByText("UPI, cards and netbanking").click();
  await caption("Online payment runs in Razorpay TEST MODE on this demo. No real money moves.", 3000);
  await page.getByText("Cash on delivery", { exact: true }).click();
  await caption("For this recording we choose cash on delivery", 1800);
  await page.getByRole("button", { name: "Review order" }).click();
  await caption("Step 4: review. Prices and stock are re-checked by the server.", 2800);
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/checkout\/success\//);
  await page.waitForLoadState("networkidle");
  await caption("6. Order placed. This is a demo order: nothing is delivered or charged.", 3200);
  await scrollBy(500);
  await page.waitForTimeout(800);
  await page.getByRole("link", { name: "Track this order" }).click();
  await page.waitForURL(/\/account\/orders\//);
  await page.waitForLoadState("networkidle");
  await caption("The order appears in My orders, with sizes and a status timeline", 3200);
  await caption("End of demo. Aurelle is a demonstration store only.", 2800);
} catch (e) {
  failed = true;
  console.error("Recording failed:", e.message);
} finally {
  await cdp.send("Page.stopScreencast").catch(() => {});
  await browser.close();
}

if (frames.length < 2) {
  console.error(`Only ${frames.length} frame(s) captured; nothing to encode.`);
  process.exit(1);
}

// Build an ffmpeg concat list where each frame lasts until the next one (variable frame rate).
const end = frames.at(-1).t + 1.5;
const list = frames
  .map((f, i) => `file '${f.file.replace(/\\/g, "/")}'\nduration ${Math.max(0.04, (frames[i + 1]?.t ?? end) - f.t).toFixed(3)}`)
  .join("\n");
const listFile = path.join(framesDir, "frames.txt");
fs.writeFileSync(listFile, `${list}\nfile '${frames.at(-1).file.replace(/\\/g, "/")}'\n`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
execFileSync(
  FFMPEG,
  ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", "fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-movflags", "+faststart", outFile],
  { stdio: "inherit" },
);
fs.rmSync(framesDir, { recursive: true, force: true });
console.log(`Saved ${outFile} from ${frames.length} frames${failed ? " (recording stopped early)" : ""}`);
if (failed) process.exitCode = 1;
