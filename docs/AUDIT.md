# Aurelle demo: project audit

Date: 19 October 2026. Scope: preparing Aurelle as a women's-wear e-commerce **demonstration** for a prospective client. All products, customers, orders and payments are fictional. Razorpay runs in **test mode** only.

## 1. Architecture (verified against the code)

| Layer | Technology |
| --- | --- |
| Website | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router |
| API | Node 20+, Express 5, TypeScript, Zod validation, JWT auth with ADMIN and CUSTOMER roles |
| Database | PostgreSQL through Prisma 6.19 |
| Payments | Razorpay Standard Checkout (test mode), cash on delivery, and a simulated card used only when Razorpay is not configured |
| Images | Remote URLs: Pexels sample photos, plus Cloudinary for admin uploads (signed, direct from the browser) |
| Hosting (planned) | Website on Vercel, API on Render, database on Supabase or Neon |

The architecture in the README was accurate. Nothing was migrated to another framework.

## 2. What changed in this round

**Sizes and stock per size**
- New `ProductVariant` table: one row per size (XS, S, M, L, XL, XXL, Free Size) with its own stock. `Product.stock` is now the total of its sizes, recomputed in the same transaction as every change.
- The migration is safe on existing data. Each existing product received a Free Size variant holding its old stock, and existing bag items were pointed at it.
- Product page: a size picker shows sold-out sizes struck through, plus a size guide in inches. "Add to bag" asks for a size first. Free Size items skip the picker.
- Shop: a size filter that shows only items with that size in stock. Product cards list the sizes in stock.
- Bag, checkout, order pages and admin orders show the size of every line.
- Admin: products are created and edited with a size grid (tick sizes, set stock per size, or switch to Free Size). The product list shows stock per size.

**Razorpay (test mode)**
- Flow: the server validates the bag and computes the total from database prices, holds the stock, creates a pending order and a Razorpay order, and returns only the public Key ID. The browser opens Razorpay Checkout. On success the server checks the signature (HMAC-SHA256 of `order_id|payment_id` with the key secret), fetches the payment from Razorpay, checks its order id, amount and currency, captures it if needed, and only then marks the order paid.
- Webhooks at `/api/webhooks/razorpay` verify the signature on the raw body. Duplicate deliveries are ignored using `x-razorpay-event-id`. They handle `payment.authorized`, `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` and `refund.failed`.
- Unpaid online orders hold stock for 30 minutes, adjustable with `PAYMENT_HOLD_MINUTES`. A sweep runs every 5 minutes. Before cancelling an order, it asks Razorpay whether the order was actually paid.
- A payment that arrives after an order was cancelled is refunded automatically.
- Customers can retry payment from the order page with **Pay now**.
- Cancelling a paid order releases stock first, then requests a full refund. If Razorpay refuses, the order shows "Refund in progress" with a timeline note, and the admin gets a **Retry refund** button.
- Admins cannot confirm an online order until it is paid. This is enforced by the API and hidden in the UI.
- The API refuses to start with `rzp_live_` keys unless `RAZORPAY_ALLOW_LIVE=true`.

**Demo presentation**
- A "Demo store" strip on every store and admin page carries the required wording.
- The catalogue was replaced with 45 fictional women's-wear products in six categories: sarees, kurtas, lehengas, anarkalis and gowns, suit sets and dupattas, and jewellery. Prices are realistic, and stock levels include low and sold-out sizes for demonstration.
- Photos come from Pexels (free licence, no attribution required). They show models, not real products, and must be replaced before going live.
- The home page, footer, meta description and search placeholder were updated for the new catalogue.

**Other**
- Image helper: responsive sizes for Pexels and Cloudinary URLs.
- `GET /api/config` returns public feature flags. `/api/health` also reports the payment mode, webhooks and uploads, without any secrets.
- Payment endpoints have their own rate limit (30 per 15 minutes).

## 3. Bugs found and fixed during this work

| Issue | Fix |
| --- | --- |
| Refund calls ran inside the cancel transaction, so a Razorpay refusal blocked cancellation and kept stock held. Seen once against the real test API with "invalid request sent". | Cancel and release stock first, then refund. Failures are recorded and can be retried by an admin. A later real test-mode refund succeeded. |
| The checkout summary behind the Razorpay window showed an empty bag (only ₹99 shipping). | The bag is emptied only after the payment window closes. |
| The Razorpay phone prefill was ignored. | It is now sent as `+91XXXXXXXXXX`. |
| The admin orders list showed raw status text such as `Refund_pending`. | It now uses readable labels. |
| Test-mode instructions mentioned UPI test IDs, but UPI is not enabled on this Razorpay test account. | They now describe netbanking (demo bank page) and Razorpay's official test card. |

## 4. Security review

Verified in code and covered by tests:

- Passwords are hashed with bcrypt (12 rounds). Registration always creates a CUSTOMER. Admin comes only from the seed or `ADMIN_EMAILS`.
- Every `/api/admin` route requires a signed-in ADMIN on the server. Hiding links in the UI is cosmetic only.
- Customers can only read, pay, verify or cancel their own orders. Another customer's order returns 404.
- Prices, shipping and totals are always recomputed on the server. Client-sent amounts are ignored.
- Zod validates params, query and body on every route.
- Rate limits: login, register and reset (20 failed attempts per 15 minutes), payments (30 per 15 minutes), and 300 requests per minute overall.
- Secrets stay on the server. The browser only receives the Razorpay Key ID and Cloudinary signed upload parameters, and tests assert that responses contain no secret.
- CORS allows only the origins in `CLIENT_URL`.
- The production error handler returns generic messages with no stack traces or database details.
- Password reset tokens are stored hashed and are single-use. A password change or reset revokes every existing session (`tokenVersion`).
- Overselling is blocked by product row locks plus a conditional decrement per size, with a database CHECK that stock is never negative. A concurrent-checkout test proves it for sizes.

Known risks, documented rather than changed:

- **The JWT is stored in `localStorage`.** Any XSS bug could steal the token. React escapes output and no raw HTML is rendered, which lowers the risk. Moving to httpOnly cookies would need CSRF protection and a change to the auth design, so it was not done for the demo.
- **The seeded admin password (`Admin1234`) is public in this repo.** Change it right after deploying a public demo, and never use the seed on a real store.
- **The Vercel deployment sends no Content-Security-Policy header.** Add one for production that allows `checkout.razorpay.com`, `api.cloudinary.com`, `res.cloudinary.com` and `images.pexels.com`.
- **Seed photos show identifiable models** from Pexels. That is fine for a demo, but use the store's own photography for production.

## 5. Test results (19 October 2026, Windows 11, Node 24.13.1)

| Check | Result |
| --- | --- |
| Backend TypeScript (`npm run typecheck`) | Passed |
| Backend build (`npm run build`) | Passed |
| Backend integration tests (`npm test`) against a real PostgreSQL | **81 passed**, 0 failed, in 6 files. New tests cover sizes, per-size overselling under concurrency, admin size edits, Razorpay signature and amount checks, idempotent verify, webhooks with bad signatures and duplicates, failed payments, refunds, refund failure and retry, payment expiry, late payments, feature flags, and upload signing. |
| Frontend TypeScript and production build | Passed |
| End-to-end browser journey (`npm run e2e`, Chrome) | **Passed with no browser errors.** Covered: filter by category, price and sort; size required and chosen; guest bag merges on registration; COD checkout; order shows size; admin confirms and ships; customer sees status; customer blocked from admin (UI and 403); admin creates a product with sizes, edits stock and removes a size, and the storefront and API agree; password reset revokes old sessions. |
| Real Razorpay test mode, manual in Chrome | **Passed:** netbanking payment succeeded and the order showed Paid. A failed payment showed Razorpay's retry screen. Retry from the order page with a test card succeeded. Cancelling a paid order requested a real test refund (processed). |
| Razorpay webhooks against the real Razorpay servers | **Not run.** They need a public URL (deployed API or tunnel). They are covered by automated tests with correctly signed payloads. |
| Cloudinary upload against the real Cloudinary | **Not run** in the browser. Signing is unit-tested and the API reports uploads as enabled. |
| Responsive screenshots at 390, 820 and 1440 px | Checked home, shop, product, and admin dashboard and products. No horizontal overflow reported. |
| Lighthouse | Not run. |
| Linting | The project has no linter configured. Not run. |

## 6. Run it locally on Windows (PowerShell)

Three terminals, from the project folder:

```powershell
# Terminal 1: local PostgreSQL (keep it open)
cd backend
npm install
npm run db:local
```

```powershell
# Terminal 2: API
cd backend
Copy-Item .env.example .env        # first time only; then fill in JWT_SECRET and optional keys
npx prisma migrate deploy
npm run db:seed                    # demo data. Wipes the local database first.
npm run dev                        # http://localhost:4000/api/health
```

```powershell
# Terminal 3: website
cd frontend
npm install
npm run dev                        # open http://localhost:5173
```

Tests: `cd backend; npm test`. Browser journey (with both servers running): `cd frontend; $env:PW_CHANNEL="chrome"; npm run e2e`.

**Reset the demo data:** `cd backend; npm run db:seed`.

**Local demo logins** (fictional, local or demo use only):

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@aurelle.dev | Admin1234 |
| Customer | demo@aurelle.dev | Demo1234 |

## 7. Readiness

| Use | Ready? | Basis |
| --- | --- | --- |
| Local development | **Yes** | Builds, 81 tests and the end-to-end journey pass on this machine. |
| Client demonstration (local or hosted) | **Yes** | Full journeys verified, including real Razorpay test payments, failure, retry and refund. |
| Public demo deployment | **Ready to deploy, not yet deployed.** | Configuration is prepared. Webhooks and Cloudinary need a live check after deploy. Change the admin password first. |
| Real commercial use | **No** | Needs the production checklist below. |

## 8. Production checklist (before real orders or money)

1. Business approval for branding. Replace the Aurelle demo name, products, prices, photos and policies with the store's own.
2. Razorpay live activation: business KYC, settlement bank account, and published refund, cancellation, shipping, privacy, terms and contact pages. Set live keys only on production, with `RAZORPAY_ALLOW_LIVE=true`, and a live webhook with its own secret.
3. Paid, non-sleeping hosting for the API, a production database plan with backups and point-in-time recovery, and a tested restore.
4. Custom domain with HTTPS on both website and API. Set `CLIENT_URL` to the real domain only.
5. Strong unique admin account(s). Remove the seeded admin. Never run the seed on production.
6. Email provider (Resend or similar) with a verified domain for password resets and order emails.
7. Security headers on the website, including a Content-Security-Policy. Consider moving auth to httpOnly cookies.
8. Monitoring: uptime checks on `/api/health`, error tracking such as Sentry, and alerts on failed webhooks and refunds.
9. GST invoices, tax display and the legal pages the business needs, reviewed by the owner or their accountant.
10. Load and concurrency test with realistic traffic, and a Lighthouse pass on mobile.
