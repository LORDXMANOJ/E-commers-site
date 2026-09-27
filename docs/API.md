# Aurelle REST API

Base URL: `http://localhost:4000/api` locally, or your Render URL + `/api` in production.

## Conventions

**Envelope.** Every response is JSON in one of two shapes:

```json
{ "success": true, "data": { } }
```

```json
{ "success": false, "message": "Some fields are invalid", "errors": [{ "path": "email", "message": "Enter a valid email address" }] }
```

`errors` is present only for validation failures. Internal and database errors are never exposed; they return
`500` with a generic message and are logged on the server.

**Money** is always an integer number of **paise** (₹1 = 100 paise). `pricePaise: 1299000` is ₹12,990.

**Authentication** uses a JWT in the `Authorization: Bearer <token>` header. Tokens are returned by register,
login and password change. They expire after `JWT_EXPIRES_IN` (default 7 days) and are invalidated by:

- `POST /auth/logout`: the token's `jti` is added to a revocation list
- a password change or reset: the user's `tokenVersion` is bumped, which invalidates every older token

The server reloads the user from the database on every authenticated request. The role is read from the database,
never trusted from the token or the request body.

**Pagination.** List endpoints accept `page` (default 1) and `limit` and return:

```json
{ "items": [], "page": 1, "limit": 12, "total": 36, "totalPages": 3 }
```

**Status codes.** `200` OK · `201` created · `400` validation failed or invalid request · `401` not signed in or
token invalid · `402` simulated card declined · `403` signed in without the required role · `404` not found (also
used for other customers' orders) · `409` conflict (duplicate, out of stock, invalid status change) · `429` rate
limited · `500` unexpected error.

**Rate limits.** 300 requests per minute per IP across `/api`. Credential endpoints (register, login, forgot and reset
password) allow 20 **failed** attempts per 15 minutes per IP. Limits are reported in the standard `RateLimit` headers.

---

## Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | none | `{ status: "ok", db: "up" }`, or `503` with `db: "down"` if the database is unreachable |

## Auth: `/auth`

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | none | `{ name, email, password }` | `201 { token, user }`. Always creates a `CUSTOMER`; any extra field such as `role` is rejected with `400`. |
| POST | `/auth/login` | none | `{ email, password }` | `{ token, user }`, or `401` with the same message for an unknown email and a wrong password |
| POST | `/auth/logout` | bearer | none | Revokes the current token |
| GET | `/auth/me` | bearer | none | `{ user }` |
| POST | `/auth/forgot-password` | none | `{ email }` | Always the same message. Emails a 30-minute single-use link through Resend when `RESEND_API_KEY` is set. Otherwise, outside production, the response includes `devResetUrl`. |
| POST | `/auth/reset-password` | none | `{ token, password }` | Sets the password and signs out all sessions; `400` if the token is invalid, used or expired |

Password rules: 8–72 characters with at least one letter and one number. Emails are trimmed and lower-cased.

`user` shape: `{ id, email, name, role: "CUSTOMER" | "ADMIN", address | null, createdAt }`.

## Account: `/me` (bearer)

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| PATCH | `/me` | `{ name }` | `{ user }` |
| PUT | `/me/password` | `{ currentPassword, newPassword }` | `{ token, user }`: a fresh token for this session; all other sessions are signed out |
| PUT | `/me/address` | `{ address }` or `{ address: null }` | `{ user }` |

`address`: `{ fullName, phone (Indian mobile), line1, line2?, city, state, postalCode (6-digit PIN), country: "India" }`.

## Catalog (public)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/products` | Active products. Query: `q` (name/description, case-insensitive), `category` (slug), `minPrice`, `maxPrice` (paise), `inStock=true`, `featured=true`, `sort=newest\|price_asc\|price_desc\|popular`, `page`, `limit` (≤ 48) |
| GET | `/products/:slug` | One active product, or `404` |
| GET | `/products/:slug/related` | Up to 4 active products from the same category |
| GET | `/categories` | All categories with `productCount` (active products only) |
| GET | `/shipping-options` | `{ freeShippingThresholdPaise, methods: [{ id, label, eta, pricePaise }] }` |

Product shape: `{ id, name, slug, description, pricePaise, compareAtPaise | null, stock, images[], featured, createdAt, category: { id, name, slug } }`.

## Cart: `/cart` (bearer)

The server-side cart for signed-in users. Guests keep a cart in `localStorage`, and the web app merges it on login.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| GET | `/cart` | none | `{ items: [{ productId, quantity, available, product, lineTotalPaise }], itemCount, subtotalPaise }`, priced live from the database |
| POST | `/cart/items` | `{ productId, quantity? = 1 }` | Adds to the existing quantity; `409` if that exceeds stock; `404` for unknown or inactive products |
| PATCH | `/cart/items/:productId` | `{ quantity }` (1–20) | Sets the quantity; `409` if over stock |
| DELETE | `/cart/items/:productId` | none | Removes one line |
| DELETE | `/cart` | none | Empties the cart |
| POST | `/cart/merge` | `{ items: [{ productId, quantity }] }` | Merges a guest cart: quantities are summed and capped at stock, and unknown or inactive products are skipped |

## Orders: `/orders` (bearer)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/orders` | Checkout from the caller's server cart (see below). `201` with the full order |
| GET | `/orders` | The caller's orders, newest first (paginated, `limit` ≤ 50) |
| GET | `/orders/:id` | One of the caller's orders with `items` and `events`. **Another customer's order returns `404`** |
| POST | `/orders/:id/cancel` | Cancels the caller's own order while it is `PENDING`, restoring stock. `409` otherwise |

### Checkout body

```json
{
  "shippingAddress": { "fullName": "Asha Rao", "phone": "9876543210", "line1": "12 MG Road", "city": "Bengaluru", "state": "Karnataka", "postalCode": "560001" },
  "shippingMethod": "STANDARD",
  "paymentMethod": "COD",
  "card": { "name": "Asha Rao", "number": "4242 4242 4242 4242", "expiry": "12/30", "cvc": "123" },
  "saveAddress": true
}
```

- `card` is required only when `paymentMethod` is `CARD_SIMULATED`. The number must pass a Luhn check and the
  expiry must be in the future. `4000 0000 0000 0002` is always declined (`402`). No payment provider is contacted.
  Only the last four digits are stored.
- **The client never sends prices or totals.** Items come from the server cart, and the server calculates the
  subtotal from current database prices. Standard shipping is ₹99, or free from a ₹2,999 subtotal; Express is ₹249.
  Extra fields such as `totalPaise` are ignored.
- **Everything runs in one database transaction:** lock the cart row (so a double-submitted checkout cannot place two
  orders), decrement each product with a conditional
  `UPDATE … SET stock = stock - qty WHERE stock >= qty` (so concurrent orders can never oversell), create the order with
  item snapshots (name, slug, image, unit price) and a `PENDING` timeline event, then empty the cart. If any item is
  short, the whole checkout rolls back with `409` ("Only 2 of Rare Ring left in stock").

Order shape: `{ id, orderNumber, status, subtotalPaise, shippingPaise, totalPaise, shippingAddress, shippingMethod,
paymentMethod, paymentStatus: "UNPAID" | "PAID" | "REFUNDED", cardLast4, createdAt, items[], events[] }`.

### Status lifecycle

```
PENDING ──► CONFIRMED ──► SHIPPED ──► DELIVERED
   │            │
   └────────────┴──► CANCELLED
```

Cancelling restores stock and marks a paid simulated-card order as `REFUNDED`. Delivering a cash-on-delivery order
marks it `PAID`. Status changes use a conditional update on the current status, so two simultaneous changes cannot
both apply.

## Admin: `/admin` (bearer + `ADMIN` role)

Every route below returns `401` without a token and `403` for customers.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/stats` | `revenuePaise`, `orderCount`, `pendingCount`, `customerCount`, `averageOrderPaise` (non-cancelled orders), `lowStock` (active, stock ≤ 5), `recentOrders`, and `sales` (14 days of `{ date, revenuePaise, orders }`, India time) |
| GET | `/admin/products` | All products, including hidden ones. Query: `q`, `category` (slug), `status=all\|active\|inactive\|low`, `page`, `limit` |
| GET | `/admin/products/:id` | One product |
| POST | `/admin/products` | `{ name, slug?, description, pricePaise, compareAtPaise?, categoryId, stock, images[1–8], active?, featured? }`. The slug is generated from the name if omitted. `compareAtPaise` must be higher than `pricePaise`. |
| PATCH | `/admin/products/:id` | Any subset of the fields above |
| DELETE | `/admin/products/:id` | Deletes the product; past orders keep their snapshots |
| GET | `/admin/categories` | Categories with `productCount` (all products) |
| POST | `/admin/categories` | `{ name, slug?, description?, imageUrl? }` |
| PATCH | `/admin/categories/:id` | Any subset |
| DELETE | `/admin/categories/:id` | `409` while the category still has products |
| GET | `/admin/orders` | Query: `status`, `q` (order number, customer name or email), `page`, `limit` |
| GET | `/admin/orders/:id` | Full order including `user` |
| PATCH | `/admin/orders/:id/status` | `{ status, note? }`. Only valid transitions; `409` otherwise |
| GET | `/admin/customers` | Query: `q`, `role`, `page`, `limit`. Each row includes `orderCount` and `totalSpentPaise` |

## Example session

```bash
API=http://localhost:4000/api
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@aurelle.dev","password":"Demo1234"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')

PRODUCT=$(curl -s "$API/products?limit=1&inStock=true" | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.items[0].id')
curl -s -X POST $API/cart/items -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PRODUCT\",\"quantity\":1}"

curl -s -X POST $API/orders -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "shippingAddress": {"fullName":"Demo Customer","phone":"9876543210","line1":"14 Indiranagar","city":"Bengaluru","state":"Karnataka","postalCode":"560038"},
  "shippingMethod": "STANDARD", "paymentMethod": "COD"}'
```
