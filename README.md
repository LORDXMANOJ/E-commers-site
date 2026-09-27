# Aurelle: full-stack e-commerce store

Aurelle is a clothing and accessories store built as a production-style full-stack application: a React +
TypeScript storefront and admin panel, an Express 5 REST API, and a PostgreSQL database through Prisma. Prices are in
Indian rupees and stored as integer paise.

It was built for the Thiranex full-stack internship. It covers the product catalog, cart and checkout, login with
ADMIN / CUSTOMER roles, REST APIs for product and order management, and a real PostgreSQL database.

![Aurelle home page on desktop](docs/screenshots/home-1440-light.webp)

| Phone | Tablet | Dark mode |
| --- | --- | --- |
| ![Home on a phone](docs/screenshots/home-390-light.webp) | ![Catalog on a tablet](docs/screenshots/shop-820-light.webp) | ![Admin dashboard in dark mode](docs/screenshots/admin-1440-dark.webp) |

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [API overview](#api-overview)
- [Security and correctness](#security-and-correctness)
- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Seed accounts](#seed-accounts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Future improvements](#future-improvements)

## Features

**Storefront**
- Home page with an editorial hero, categories, new arrivals and best sellers
- Catalog with search (name and description), filters (category, price range, in stock), sorting (newest, price
  ↑/↓, popular) and pagination. All filter state lives in the URL, so results can be shared and survive a refresh.
- Product page with an image gallery (swipe carousel on phones), stock status ("Only 3 left"), a quantity selector,
  add to bag, and related products
- Bag as a slide-over drawer (a bottom sheet on phones) plus a full bag page, with a free-shipping progress meter
- Guest bags are kept in `localStorage` and merged into the server cart on sign-in. Signed-in bags are stored in the
  database.
- Four-step checkout (address → delivery → payment → review) with cash on delivery or a clearly labelled
  **simulated** card payment. Nothing is charged.
- Order confirmation page with the order number

**Customer account**
- Register, sign in, sign out, forgot and reset password. In development the reset link is shown on screen, since no
  email provider is configured. Setting `RESEND_API_KEY` sends real emails.
- "My orders" with a status timeline: Pending → Confirmed → Shipped → Delivered, or Cancelled
- Customers can cancel their own order while it is pending, which restores stock
- Profile: change name, change password (signs out other devices), saved address

**Admin panel** (`/admin`, ADMIN only)
- Dashboard: revenue, order count, average order value, customers, low-stock alerts, recent orders, and a 14-day
  sales chart with hover tooltips and a screen-reader table
- Products: create, edit and delete; search and filter by category or status; live image previews
- Categories: create, edit and delete (blocked while the category still has products)
- Orders: filter by status, search, view details, and move through valid status transitions only
- Customers: list with order counts and total spent

**Design**: an editorial direction for a fashion brand. Bodoni Moda (display, optical sizes) is paired with Geist
(text, tabular figures for prices). The palette is porcelain and midnight navy with one ultramarine accent. The site
is responsive at 390, 820 and 1440 px with no horizontal scroll. It has light and dark modes (remembered and applied
before first paint), skeleton loaders, empty and error states with retry, toasts, confirmation dialogs, keyboard focus
styles, and reduced-motion support.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, TypeScript 5.9, Vite, Tailwind CSS v4, React Router, TanStack Query, Axios, React Hook Form, Zod, lucide-react, sonner |
| Backend | Node 20+, Express 5, TypeScript 5.9, Zod, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit |
| Database | PostgreSQL, Prisma 6.19.3 (`prisma-client-js`) |
| Tests | Vitest and Supertest against a real PostgreSQL test database; Playwright end-to-end journey |
| Local DB | `embedded-postgres`: a real PostgreSQL server started from npm, with no Docker or system install |
| Hosting | Neon (database) → Render (API) → Vercel (frontend) |

## Architecture

```
┌──────────────────────┐   HTTPS + JSON   ┌───────────────────────────┐   Prisma   ┌──────────────┐
│  React SPA (Vercel)  │ ───────────────► │  Express 5 API (Render)   │ ─────────► │  PostgreSQL  │
│  TanStack Query      │  Bearer JWT      │  helmet · CORS allow-list │            │  (Neon)      │
│  guest bag in        │ ◄─────────────── │  rate limits · Zod        │ ◄───────── │              │
│  localStorage        │  { success,data }│  requireAuth / requireRole│            │              │
└──────────────────────┘                  └───────────────────────────┘            └──────────────┘
```

```
.
├── backend/
│   ├── prisma/            schema.prisma, migrations/ (incl. CHECK constraints), seed.ts
│   ├── scripts/local-db.ts   starts embedded PostgreSQL on :5433 (data in backend/.pgdata)
│   ├── src/
│   │   ├── app.ts         middleware stack and routers
│   │   ├── config/env.ts  environment validated with Zod at startup
│   │   ├── lib/           prisma client, tokens, money rules, shared schemas, HTTP helpers, email
│   │   ├── middleware/    auth (requireAuth, requireRole), validate (res.locals), rate limits, error handler
│   │   └── modules/       auth · account · catalog · cart · orders · admin
│   └── tests/             integration tests (auth, roles, catalog, cart, orders)
├── frontend/
│   ├── src/
│   │   ├── providers/     auth, cart (guest + server), theme
│   │   ├── components/    ui primitives, layout (header, bag drawer), product, order
│   │   ├── pages/         store/, auth/, account/, admin/  (all lazy-loaded)
│   │   └── lib/           api client, formatting (en-IN), schemas, guest cart store
│   ├── e2e/               Playwright journey (run.mjs) and screenshot tool (shoot.mjs)
│   └── vercel.json        SPA rewrites and caching headers
├── docs/                  API.md, screenshots/
└── render.yaml            Render blueprint for the API
```

**Request flow.** Each request passes through helmet, then CORS (allow-list from `CLIENT_URL`), then the rate
limiter, then JSON parsing (100 kB cap). Protected routes add `requireAuth` and, for `/api/admin`, `requireRole("ADMIN")`.
Zod validates params, query and body; the parsed values are stored on `res.locals`, because Express 5 makes
`req.query` read-only. A central error handler maps every error to `{ success: false, message, errors? }`.

## Database schema

```
User ─┬─< Order ─┬─< OrderItem >── Product (nullable: snapshot survives deletion)
      │          └─< OrderEvent          │
      ├── Cart ──< CartItem >────────────┤
      └─< PasswordResetToken             └──> Category
RevokedToken (jti, expiresAt)
```

| Model | Key fields |
| --- | --- |
| `User` | `email` (unique), `passwordHash`, `role` (`CUSTOMER`/`ADMIN`), `tokenVersion`, `address` (JSON) |
| `Category` | `name`, `slug` (unique), `description`, `imageUrl` |
| `Product` | `slug` (unique), `pricePaise`, `compareAtPaise`, `stock`, `images[]`, `active`, `featured`, `soldCount`; indexes on `categoryId`, `pricePaise`, `createdAt`, `active` |
| `Cart` / `CartItem` | one cart per user; `(cartId, productId)` unique |
| `Order` | `orderNumber` (unique, e.g. `AUR-260928-7K3QZ9`), `status`, `subtotalPaise`, `shippingPaise`, `totalPaise`, `shippingAddress` (JSON snapshot), `shippingMethod`, `paymentMethod`, `paymentStatus`, `cardLast4` |
| `OrderItem` | snapshot of `name`, `slug`, `imageUrl`, `unitPaise`, `quantity`, `lineTotalPaise` |
| `OrderEvent` | status timeline with an optional note |
| `PasswordResetToken` | SHA-256 `tokenHash`, `expiresAt`, `usedAt` |
| `RevokedToken` | logged-out JWT ids until they expire |

The database also has CHECK constraints (`stock >= 0`, non-negative prices and totals, `quantity > 0`) as a second
line of defence behind the application logic.

## API overview

All routes are under `/api`. **Full reference: [docs/API.md](docs/API.md).**

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| Account | `PATCH /me` · `PUT /me/password` · `PUT /me/address` |
| Catalog | `GET /products` · `GET /products/:slug` · `GET /products/:slug/related` · `GET /categories` · `GET /shipping-options` |
| Cart | `GET /cart` · `POST /cart/items` · `PATCH /cart/items/:productId` · `DELETE /cart/items/:productId` · `DELETE /cart` · `POST /cart/merge` |
| Orders | `POST /orders` (checkout) · `GET /orders` · `GET /orders/:id` · `POST /orders/:id/cancel` |
| Admin | `GET /admin/stats` · `GET/POST /admin/products` · `GET/PATCH/DELETE /admin/products/:id` · `GET/POST /admin/categories` · `PATCH/DELETE /admin/categories/:id` · `GET /admin/orders` · `GET /admin/orders/:id` · `PATCH /admin/orders/:id/status` · `GET /admin/customers` |

## Security and correctness

| Concern | How it's handled |
| --- | --- |
| Passwords | bcrypt with 12 rounds. Login compares against a dummy hash for unknown emails, so response timing doesn't reveal which accounts exist. |
| Sessions | JWT in the `Authorization: Bearer` header. Logout stores the token's `jti` in `RevokedToken`. A password change or reset bumps `tokenVersion`, which invalidates every other session. |
| Roles | Registration always creates a `CUSTOMER`; the body schema is `.strict()`, so a sent `role` is rejected. Admins come only from the seed or `ADMIN_EMAILS`. The role is re-read from the database on every request. |
| Admin routes | `requireAuth` and `requireRole("ADMIN")` on the whole `/api/admin` router. The UI hides admin links, but the server enforces the rule. |
| Order privacy | Order queries include `userId`, so another customer's order returns `404`, not `403`. |
| Prices | The client never sends prices. Checkout reads the server cart and current database prices, and extra fields such as `totalPaise` are ignored. |
| Overselling | One transaction: lock the cart row, run a conditional `UPDATE product SET stock = stock - qty WHERE stock >= qty` in product-id order (no deadlocks), create the order with item snapshots, and empty the cart. Tested with 8 parallel buyers competing for 3 units. |
| Cancellation | A conditional status update means stock is restored exactly once, even when two cancel requests race. |
| Validation | Zod on the client (fast feedback) and on the server (authoritative) |
| Errors | One envelope for every response. Prisma and internal errors never reach the client. |
| Headers and CORS | `helmet`; CORS allow-list from `CLIENT_URL`; JSON body limit of 100 kB |
| Rate limiting | 300 requests per minute per IP overall. Auth endpoints allow 20 failed attempts per 15 minutes. |
| Password reset | 32-byte random token, only its SHA-256 stored, 30-minute expiry, single use. The same response is returned whether or not the email exists. |
| Cards | Simulated only. Luhn and expiry checks run; only the last four digits are stored. |
| Secrets | Only `.env.example` files are committed. `.gitignore` covers `.env*`, `node_modules`, `dist`, `.pgdata`, logs and IDE files. |

## Run it locally

Requirements: **Node.js 20+** and npm. No PostgreSQL or Docker install is needed.

```bash
# 1. Install
cd backend  && npm install
cd ../frontend && npm install

# 2. Configure (then put a long random string in JWT_SECRET)
cd ../backend
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Start PostgreSQL (terminal 1, leave it running)
npm run db:local           # real PostgreSQL on :5433, data in backend/.pgdata

# 4. Create the schema and (optionally) demo data (terminal 2)
npx prisma migrate deploy
npm run db:seed            # optional: wipes and fills the database with demo data

# 5. Start the API (terminal 2)
npm run dev                # http://localhost:4000/api/health

# 6. Start the web app (terminal 3)
cd ../frontend
npm run dev                # http://localhost:5173 (proxies /api to :4000)
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

If port 5433 is already taken, set `LOCAL_PG_PORT` in `backend/.env` and change the port in both database URLs.
If port 5173 is taken, run `npx vite --port 5174`.

The app also works on an **empty database**: skip the seed, set `ADMIN_EMAILS=you@example.com` in `backend/.env`,
register with that email, and you'll be an admin who can create categories and products.

## Environment variables

**backend/.env**

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |
| `PORT` | no | `4000` | API port |
| `CLIENT_URL` | yes | `http://localhost:5173` | CORS allow-list (comma-separated) and the base URL for reset links |
| `DATABASE_URL` | yes | `postgresql://postgres:postgres@localhost:5433/aurelle` | Main database |
| `TEST_DATABASE_URL` | for tests | `postgresql://postgres:postgres@localhost:5433/aurelle_test` | Separate database used by `npm test` |
| `LOCAL_PG_PORT` | no | `5433` | Port for `npm run db:local` |
| `JWT_SECRET` | yes | 96 hex characters | Token signing key (at least 32 characters) |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime |
| `ADMIN_EMAILS` | no | `owner@example.com` | Emails promoted to ADMIN on register or login |
| `RESEND_API_KEY` | no | `re_…` | Sends real password-reset emails |
| `EMAIL_FROM` | no | `Aurelle <onboarding@resend.dev>` | Sender for reset emails |

**frontend/.env** (production only)

| Variable | Example | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `https://aurelle-api.onrender.com/api` | API base URL. Leave empty in development, where Vite proxies `/api`. |

## Seed accounts

After `npm run db:seed`:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@aurelle.dev` | `Admin1234` |
| Customer | `demo@aurelle.dev` | `Demo1234` |

The seed creates 6 categories, 36 products with Unsplash photography, two more sample customers, and 10 sample orders
across every status. The sign-in page has "Use demo account" buttons.

## Testing

```bash
# Backend integration tests (needs `npm run db:local` running; uses the aurelle_test database)
cd backend
npm test

# Production builds
npm run build                    # backend → dist/
cd ../frontend && npm run build  # frontend → dist/ (type-checks first)

# End-to-end journey through the real UI (API seeded and both dev servers running)
npx playwright install chromium  # first time only
BASE=http://localhost:5173 npm run e2e
```

**Integration tests (64)** run against a real PostgreSQL database:
- **Auth:** registration always creates a CUSTOMER (a sent `role` is rejected), password hashing, duplicate email
  `409`, identical `401` for a wrong password and an unknown email, logout revocation, password change signs out other
  sessions, single-use reset tokens, profile and address updates
- **Roles:** every admin endpoint returns `401` anonymously and `403` for customers, and the role is read from the
  database rather than the token. Also covers admin product and category CRUD and stats on an empty database.
- **Catalog:** search, category, price and stock filters, sorting, pagination, query validation, 404s, and error
  envelopes for unknown routes and malformed JSON
- **Cart:** add, update and remove, stock limits, inactive products, and guest-cart merge capped at stock
- **Orders:** server-side price recalculation (client totals ignored), shipping rules, stock decrement, item
  snapshots, full rollback when one item is short, **no oversell with 8 parallel checkouts for 3 units**, a
  double-submitted cart places one order, simulated card (approved, declined `402`, bad Luhn, expired), order
  ownership (`404` for others), cancellation restores stock exactly once, valid admin transitions only, and refunds
  when a paid order is cancelled

**End-to-end** (`frontend/e2e/run.mjs`): a guest filters the catalog (category + price + sort, checked against the
results) → adds to the bag → is sent to sign-in at checkout → registers (the guest bag merges) → checks out with
express delivery and cash on delivery → sees the order as Pending → an admin confirms and ships it → the customer sees
"Shipped" in the timeline → the customer is blocked from `/admin` in the UI and gets `403` from the API → the customer
resets the password through the dev-mode link, signs in with the new one, and the old session returns `401`. The run
fails on any browser error.

## Deployment

**1. Database on Neon**
1. Create a project at [neon.tech](https://neon.tech) and copy the connection string, with `?sslmode=require`. The
   direct (non-pooled) string is simplest for migrations.
2. Optionally load demo data from your machine:
   `DATABASE_URL="<neon url>" npx prisma migrate deploy && DATABASE_URL="<neon url>" npm run db:seed`

**2. API on Render**
1. Push this repository to GitHub, then in Render choose **New → Blueprint** and select the repo. `render.yaml`
   defines the service (root `backend/`, build `npm ci --include=dev && npm run build`, start
   `npx prisma migrate deploy && node dist/server.js`, health check `/api/health`).
2. Set `DATABASE_URL` (Neon), `CLIENT_URL` (your Vercel URL, e.g. `https://aurelle.vercel.app`) and optionally
   `ADMIN_EMAILS` and `RESEND_API_KEY`. `JWT_SECRET` is generated automatically.
3. Check `https://<service>.onrender.com/api/health` for `{"status":"ok","db":"up"}`.

**3. Frontend on Vercel**
1. Import the repo and set **Root Directory** to `frontend` (Vite is detected).
2. Add the environment variable `VITE_API_URL=https://<service>.onrender.com/api` and deploy.
3. `frontend/vercel.json` rewrites every path to `index.html` so deep links like `/product/camel-wrap-coat` work, and
   caches hashed assets for a year.

**CORS**: the API accepts browser requests only from origins listed in `CLIENT_URL`. Add every domain you use
(comma-separated), including preview URLs if you need them. On the free Render plan the first request after idling
takes a few seconds while the service wakes up.

## Screenshots

All captured from the running app with Playwright at 390 × 844, 820 × 1180 and 1440 × 900, in light and dark mode.
The full set is in [`docs/screenshots/`](docs/screenshots).

| | Light | Dark |
| --- | --- | --- |
| Catalog | ![Catalog](docs/screenshots/shop-1440-light.webp) | ![Catalog, dark](docs/screenshots/shop-1440-dark.webp) |
| Product | ![Product](docs/screenshots/product-1440-light.webp) | ![Product, dark](docs/screenshots/product-1440-dark.webp) |
| Checkout | ![Checkout](docs/screenshots/checkout-1440-light.webp) | ![Checkout, dark](docs/screenshots/checkout-1440-dark.webp) |
| Order tracking | ![Order detail](docs/screenshots/order-detail-1440-light.webp) | ![Order detail, dark](docs/screenshots/order-detail-1440-dark.webp) |
| Admin | ![Admin dashboard](docs/screenshots/admin-1440-light.webp) | ![Admin dashboard, dark](docs/screenshots/admin-1440-dark.webp) |

| Phone: product | Phone: checkout | Phone: admin |
| --- | --- | --- |
| ![Product on a phone](docs/screenshots/product-390-light.webp) | ![Checkout on a phone](docs/screenshots/checkout-390-dark.webp) | ![Admin on a phone](docs/screenshots/admin-390-light.webp) |

## Future improvements

- A real payment gateway (Razorpay or Stripe) with webhooks, replacing the simulated card
- Product variants (size and colour) with per-variant stock
- Image uploads to object storage (S3 or Cloudinary) instead of pasted URLs
- Refresh tokens in httpOnly cookies, plus email verification
- Order emails (confirmation, shipped) and an invoice PDF
- Wishlist, reviews and ratings
- Full-text search with PostgreSQL `tsvector` and trigram indexes
- A Redis-backed rate-limit store so limits hold across several API instances
- CI (GitHub Actions) running the integration and end-to-end suites on every push

## License

[MIT](LICENSE) © 2026 LORDXMANOJ
