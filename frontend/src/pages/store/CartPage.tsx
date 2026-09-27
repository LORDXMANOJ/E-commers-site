import { ShoppingBag } from "lucide-react";
import { useCart } from "../../providers/CartProvider";
import { useAuth } from "../../providers/AuthProvider";
import { estimateShipping, useShippingOptions } from "../../hooks/queries";
import { ButtonLink } from "../../components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { CartLineRow, FreeShippingMeter } from "../../components/layout/CartDrawer";
import { Totals } from "../../components/order/OrderParts";

export default function CartPage() {
  const cart = useCart();
  const { user } = useAuth();
  const shipping = useShippingOptions();
  const shippingPaise = estimateShipping(shipping, "STANDARD", cart.subtotalPaise);
  const blocked = cart.lines.some((l) => !l.available);

  return (
    <div className="container-page pt-8 sm:pt-12">
      <title>Your bag · Aurelle</title>
      <h1 className="display border-b border-line pb-6 text-4xl sm:text-5xl">Your bag</h1>

      {cart.isLoading ? (
        <div className="mt-8 space-y-6">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-36 w-full max-w-2xl" />
          ))}
        </div>
      ) : cart.isError ? (
        <ErrorState onRetry={cart.refetch} />
      ) : cart.lines.length === 0 ? (
        <EmptyState icon={<ShoppingBag />} title="Your bag is empty" action={<ButtonLink to="/shop">Browse the collection</ButtonLink>}>
          Find something you'll wear for years.
        </EmptyState>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
          <ul className="space-y-8">
            {cart.lines.map((l) => (
              <CartLineRow key={l.productId} line={l} />
            ))}
          </ul>

          <aside aria-labelledby="summary-title" className="h-fit rounded-[var(--radius-card)] border border-line bg-surface p-6 lg:sticky lg:top-28">
            <h2 id="summary-title" className="mb-5 text-lg font-semibold">
              Order summary
            </h2>
            <Totals subtotalPaise={cart.subtotalPaise} shippingPaise={shippingPaise} shippingLabel="Standard shipping" totalPaise={cart.subtotalPaise + shippingPaise} estimate />
            <div className="mt-6">
              <FreeShippingMeter subtotalPaise={cart.subtotalPaise} />
            </div>
            {blocked && <p className="mt-5 text-sm font-medium text-sale">Some items are no longer available in that quantity. Update your bag to continue.</p>}
            <ButtonLink to="/checkout" size="lg" className="mt-6 w-full" aria-disabled={blocked} onClick={(e) => blocked && e.preventDefault()}>
              {user ? "Check out" : "Sign in to check out"}
            </ButtonLink>
            {!user && <p className="mt-3 text-center text-sm text-muted">Your bag moves to your account when you sign in.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
