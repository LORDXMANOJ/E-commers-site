import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { get } from "../../lib/api";
import type { Order } from "../../lib/types";
import { ButtonLink } from "../../components/ui/Button";
import { ErrorState, Spinner } from "../../components/ui/Feedback";
import { AddressBlock, OrderFacts, OrderItems, Totals } from "../../components/order/OrderParts";

export default function OrderPlacedPage() {
  const { id = "" } = useParams();
  const { data: order, isPending, isError, refetch } = useQuery({ queryKey: ["orders", id], queryFn: () => get<Order>(`/orders/${id}`) });

  if (isPending) return <Spinner />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="container-page max-w-3xl pt-12 sm:pt-16">
      <title>{`Order ${order.orderNumber} placed · Aurelle`}</title>
      <div className="text-center">
        <CircleCheck className="mx-auto size-10 stroke-[1.25] text-success motion-safe:animate-[pop-in_400ms_var(--ease-out)]" aria-hidden />
        <h1 className="display mt-5 text-4xl sm:text-5xl">Thank you, {order.shippingAddress.fullName.split(" ")[0]}</h1>
        <p className="mt-4 text-ink-2">Your order is placed. We'll confirm it shortly and let you know when it ships.</p>
        <p className="mt-6 inline-flex flex-col items-center rounded-[var(--radius-card)] border border-line bg-surface px-6 py-3">
          <span className="text-xs text-muted">Order number</span>
          <span className="num text-xl font-semibold tracking-wide" data-testid="order-number">
            {order.orderNumber}
          </span>
        </p>
      </div>

      <div className="mt-12 space-y-8 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
        <OrderItems items={order.items} />
        <div className="border-t border-line pt-6">
          <Totals subtotalPaise={order.subtotalPaise} shippingPaise={order.shippingPaise} totalPaise={order.totalPaise} />
        </div>
        <div className="grid gap-8 border-t border-line pt-6 sm:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="mb-2 text-sm text-muted">Delivering to</h2>
            <AddressBlock address={order.shippingAddress} />
          </div>
          <OrderFacts order={order} />
        </div>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink to={`/account/orders/${order.id}`} size="lg">Track this order</ButtonLink>
        <ButtonLink to="/shop" variant="secondary" size="lg">Continue shopping</ButtonLink>
      </div>
    </div>
  );
}
