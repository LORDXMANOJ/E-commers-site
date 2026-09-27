import { Suspense } from "react";
import { Link, Outlet, ScrollRestoration } from "react-router";
import { Header, Wordmark } from "./Header";
import { CartDrawer } from "./CartDrawer";
import { Spinner } from "../ui/Feedback";

function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Wordmark className="text-[2.2rem]" />
          <p className="mt-4 text-sm text-muted">Clothes and accessories in natural fibres, made in small runs and priced honestly.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Shop</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li><Link className="hover:text-ink" to="/shop?sort=newest">New arrivals</Link></li>
            <li><Link className="hover:text-ink" to="/shop?sort=popular">Best sellers</Link></li>
            <li><Link className="hover:text-ink" to="/shop">All products</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Account</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li><Link className="hover:text-ink" to="/account">Orders</Link></li>
            <li><Link className="hover:text-ink" to="/account/profile">Profile</Link></li>
            <li><Link className="hover:text-ink" to="/cart">Bag</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Good to know</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li>Free standard shipping over ₹2,999</li>
            <li>Cancel any order until it's confirmed</li>
            <li>Cash on delivery available</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-5 text-xs text-muted">
          © {new Date().getFullYear()} Aurelle. A portfolio project: card payments are simulated and no real charges are made.
        </p>
      </div>
    </footer>
  );
}

export function StoreLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <ScrollRestoration />
    </div>
  );
}
