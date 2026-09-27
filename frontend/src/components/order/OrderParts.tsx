import { Link } from "react-router";
import { Check, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatDateTime, formatINR, PAYMENT_LABEL, PAYMENT_STATUS_LABEL, SHIPPING_LABEL } from "../../lib/format";
import { sized } from "../../lib/image";
import type { Address, Order, OrderStatus } from "../../lib/types";

export function Totals({ subtotalPaise, shippingPaise, totalPaise, shippingLabel = "Shipping", estimate }: { subtotalPaise: number; shippingPaise: number | null; totalPaise: number; shippingLabel?: string; estimate?: boolean }) {
  return (
    <dl className="num space-y-2.5 text-[0.95rem]">
      <div className="flex justify-between">
        <dt className="text-ink-2">Subtotal</dt>
        <dd>{formatINR(subtotalPaise)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-ink-2">{shippingLabel}</dt>
        <dd>{shippingPaise === null ? "Calculated at checkout" : shippingPaise === 0 ? "Free" : formatINR(shippingPaise)}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold">
        <dt>{estimate ? "Estimated total" : "Total"}</dt>
        <dd>{formatINR(totalPaise)}</dd>
      </div>
    </dl>
  );
}

export function OrderItems({ items }: { items: Order["items"] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => (
        <li key={i.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
          {i.imageUrl ? (
            <img src={sized(i.imageUrl, 200)} alt="" className="aspect-[4/5] w-16 shrink-0 rounded-[var(--radius-img)] bg-surface-2 object-cover" loading="lazy" />
          ) : (
            <div className="aspect-[4/5] w-16 shrink-0 rounded-[var(--radius-img)] bg-surface-2" />
          )}
          <div className="flex min-w-0 flex-1 justify-between gap-3">
            <div>
              {i.productId ? (
                <Link to={`/product/${i.slug}`} className="font-medium hover:underline">
                  {i.name}
                </Link>
              ) : (
                <p className="font-medium">{i.name}</p>
              )}
              <p className="num mt-0.5 text-sm text-muted">
                {i.quantity} × {formatINR(i.unitPaise)}
              </p>
            </div>
            <p className="num shrink-0 font-medium">{formatINR(i.lineTotalPaise)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AddressBlock({ address }: { address: Address }) {
  return (
    <address className="text-[0.95rem] leading-relaxed not-italic text-ink-2">
      <span className="font-medium text-ink">{address.fullName}</span>
      <br />
      {address.line1}
      {address.line2 ? (
        <>
          <br />
          {address.line2}
        </>
      ) : null}
      <br />
      {address.city}, {address.state} <span className="num">{address.postalCode}</span>
      <br />
      <span className="num">{address.phone}</span>
    </address>
  );
}

export function OrderFacts({ order }: { order: Order }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 text-[0.95rem] sm:grid-cols-3">
      <div>
        <dt className="text-sm text-muted">Delivery</dt>
        <dd className="mt-1">{SHIPPING_LABEL[order.shippingMethod]}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted">Payment</dt>
        <dd className="mt-1">
          {PAYMENT_LABEL[order.paymentMethod]}
          {order.cardLast4 && <span className="num text-muted"> ending {order.cardLast4}</span>}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-muted">Payment status</dt>
        <dd className="mt-1">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</dd>
      </div>
    </dl>
  );
}

const FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];
const STEP_COPY: Record<OrderStatus, string> = {
  PENDING: "Order placed",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Status timeline: PENDING → CONFIRMED → SHIPPED → DELIVERED, or cut short by CANCELLED. */
export function OrderTimeline({ order }: { order: Pick<Order, "status" | "events"> }) {
  const at = new Map(order.events.map((e) => [e.status, e.createdAt]));
  const cancelled = order.status === "CANCELLED";
  const reached = cancelled ? FLOW.filter((s) => at.has(s)) : FLOW.slice(0, FLOW.indexOf(order.status) + 1);
  const steps: OrderStatus[] = cancelled ? [...reached, "CANCELLED"] : FLOW;

  return (
    <ol className="relative" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = reached.includes(s) || s === "CANCELLED";
        const current = s === order.status;
        const time = at.get(s);
        return (
          <li key={s} className="relative flex gap-4 pb-7 last:pb-0" aria-current={current ? "step" : undefined}>
            {i < steps.length - 1 && (
              <span className={cn("absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-0.5", done && reached.includes(steps[i + 1]) ? "bg-ink" : "bg-line")} aria-hidden />
            )}
            <span
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2",
                s === "CANCELLED" ? "border-sale bg-sale text-white dark:text-bg" : done ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface",
              )}
              aria-hidden
            >
              {s === "CANCELLED" ? <X className="size-3.5" strokeWidth={3} /> : done ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <div className="pt-0.5">
              <p className={cn("font-medium", !done && "text-muted")}>
                {STEP_COPY[s]}
                <span className="sr-only">{done ? ", completed" : ", not yet"}</span>
              </p>
              {time && <p className="num text-sm text-muted">{formatDateTime(time)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

