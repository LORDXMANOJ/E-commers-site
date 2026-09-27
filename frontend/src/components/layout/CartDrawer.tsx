import { Link, useNavigate } from "react-router";
import { ShoppingBag, X } from "lucide-react";
import { useCart } from "../../providers/CartProvider";
import { useShippingOptions } from "../../hooks/queries";
import { formatINR } from "../../lib/format";
import { sized } from "../../lib/image";
import { cn } from "../../lib/cn";
import type { CartLine } from "../../lib/types";
import { Sheet } from "../ui/Dialog";
import { Button, ButtonLink } from "../ui/Button";
import { QuantityStepper } from "../ui/QuantityStepper";
import { EmptyState, ErrorState, Skeleton } from "../ui/Feedback";

export function FreeShippingMeter({ subtotalPaise }: { subtotalPaise: number }) {
  const { freeShippingThresholdPaise: t } = useShippingOptions();
  const left = t - subtotalPaise;
  const pct = Math.min(100, Math.round((subtotalPaise / t) * 100));
  return (
    <div>
      <p className="text-sm">
        {left > 0 ? (
          <>
            Add <span className="num font-medium">{formatINR(left)}</span> more for free standard shipping
          </>
        ) : (
          "Standard shipping is free on this order"
        )}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress to free shipping">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartLineRow({ line, compact, onNavigate }: { line: CartLine; compact?: boolean; onNavigate?: () => void }) {
  const { setQuantity, remove, pendingIds } = useCart();
  const busy = pendingIds.has(line.productId);
  const { product } = line;
  const short = product.stock < line.quantity;
  return (
    <li className={cn("flex gap-4", busy && "opacity-60")}>
      <Link to={`/product/${product.slug}`} onClick={onNavigate} className="shrink-0">
        <img
          src={product.images[0] ? sized(product.images[0], 240) : undefined}
          alt={product.name}
          className={cn("aspect-[4/5] rounded-[var(--radius-img)] bg-surface-2 object-cover", compact ? "w-20" : "w-24 sm:w-28")}
          loading="lazy"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/product/${product.slug}`} onClick={onNavigate} className="font-medium leading-snug hover:underline">
            {product.name}
          </Link>
          <p className="num shrink-0 font-medium">{formatINR(line.lineTotalPaise)}</p>
        </div>
        <p className="num mt-0.5 text-sm text-muted">{formatINR(product.pricePaise)} each</p>
        {!line.available && (
          <p className="mt-1 text-xs font-medium text-sale">
            {product.stock <= 0 ? "Sold out. Remove it to check out." : short ? `Only ${product.stock} left. Lower the quantity.` : "No longer available"}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <QuantityStepper
            size="sm"
            value={line.quantity}
            max={Math.max(line.quantity > product.stock ? line.quantity : product.stock, 1)}
            onChange={(q) => (q < 1 ? remove(line.productId) : setQuantity(line.productId, Math.min(q, 20)))}
            disabled={busy}
            label={`Quantity of ${product.name}`}
          />
          <button type="button" onClick={() => remove(line.productId)} disabled={busy} className="inline-flex items-center gap-1 rounded px-1 text-sm text-muted hover:text-ink">
            <X className="size-3.5" aria-hidden /> Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  const blocked = cart.lines.some((l) => !l.available);

  const footer =
    cart.lines.length > 0 ? (
      <div className="space-y-4">
        <FreeShippingMeter subtotalPaise={cart.subtotalPaise} />
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Subtotal</span>
          <span className="num text-lg font-semibold">{formatINR(cart.subtotalPaise)}</span>
        </div>
        <p className="-mt-3 text-xs text-muted">Shipping is calculated at checkout.</p>
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink to="/cart" variant="secondary" onClick={cart.closeDrawer}>
            View bag
          </ButtonLink>
          <Button
            disabled={blocked}
            onClick={() => {
              cart.closeDrawer();
              navigate("/checkout");
            }}
          >
            Check out
          </Button>
        </div>
      </div>
    ) : undefined;

  return (
    <Sheet open={cart.drawerOpen} onClose={cart.closeDrawer} title={`Your bag${cart.itemCount ? ` (${cart.itemCount})` : ""}`} footer={footer}>
      {cart.isLoading ? (
        <div className="space-y-5 p-5">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="aspect-[4/5] w-24" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : cart.isError ? (
        <ErrorState onRetry={cart.refetch} />
      ) : cart.lines.length === 0 ? (
        <EmptyState icon={<ShoppingBag />} title="Your bag is empty" action={<ButtonLink to="/shop" onClick={cart.closeDrawer}>Browse the collection</ButtonLink>}>
          Pieces you add will wait here{cart.isGuest ? " and move to your account when you sign in" : ""}.
        </EmptyState>
      ) : (
        <ul className="space-y-6 p-5">
          {cart.lines.map((l) => (
            <CartLineRow key={l.productId} line={l} compact onNavigate={cart.closeDrawer} />
          ))}
        </ul>
      )}
    </Sheet>
  );
}
