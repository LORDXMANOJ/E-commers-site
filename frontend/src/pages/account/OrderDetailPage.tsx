import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { ApiError, get, post } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { payWithRazorpay } from "../../lib/razorpay";
import type { Order, PaymentSession } from "../../lib/types";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../../components/ui/Button";
import { ErrorState, Skeleton } from "../../components/ui/Feedback";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useConfirm } from "../../components/ui/Dialog";
import { AddressBlock, OrderFacts, OrderItems, OrderTimeline, Totals } from "../../components/order/OrderParts";
import { NotFound } from "../../components/NotFound";

export default function OrderDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { data: order, isPending, isError, error, refetch } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => get<Order>(`/orders/${id}`),
    refetchOnWindowFocus: true, // pick up status changes made by the store
  });

  const cancel = useMutation({
    mutationFn: () => post<Order>(`/orders/${id}/cancel`),
    onSuccess: (o) => {
      qc.setQueryData(["orders", id], o);
      void qc.invalidateQueries({ queryKey: ["orders", "mine"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Order ${o.orderNumber} cancelled`);
    },
    onError: (e) => {
      toast.error((e as Error).message);
      void refetch();
    },
  });

  const pay = useMutation({
    mutationFn: async () => {
      const session = await post<PaymentSession>(`/orders/${id}/pay`);
      return payWithRazorpay(session, {
        name: order?.shippingAddress.fullName,
        email: user?.email,
        contact: order ? `+91${order.shippingAddress.phone.replace(/\D/g, "").slice(-10)}` : undefined,
      });
    },
    onSuccess: (r) => {
      if (r.status === "paid") {
        qc.setQueryData(["orders", id], r.order);
        void qc.invalidateQueries({ queryKey: ["orders", "mine"] });
        toast.success("Payment received. Thank you!");
      } else if (r.lastError) {
        toast.error(`Payment not completed: ${r.lastError}`);
      }
    },
    onError: (e) => {
      toast.error((e as Error).message);
      void refetch();
    },
  });

  if (isError && error instanceof ApiError && error.status === 404) return <NotFound />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isPending) return <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />;

  return (
    <div>
      <title>{`Order ${order.orderNumber} · Aurelle`}</title>
      <Link to="/account" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All orders
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="num text-2xl font-semibold">{order.orderNumber}</h2>
            <StatusBadge status={order.status} />
          </div>
          <p className="num mt-1 text-sm text-muted">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        {order.status === "PENDING" && (
          <Button
            variant="secondary"
            loading={cancel.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: "Cancel this order?",
                body:
                  order.paymentStatus === "PAID"
                    ? "The items go back into stock and your payment is refunded to the original method. This can't be undone."
                    : "The items go back into stock and you won't be charged. This can't be undone.",
                confirmLabel: "Cancel order",
                tone: "danger",
              });
              if (ok) cancel.mutate();
            }}
          >
            Cancel order
          </Button>
        )}
      </div>

      {awaitingPayment(order) && (
        <div role="status" className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-warn/30 bg-warn-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-semibold text-ink">Payment pending</p>
            <p className="mt-1 text-ink-2">
              Your items are held until <span className="num">{formatDateTime(order.paymentExpiresAt!)}</span>. After that the order
              is cancelled automatically. Razorpay is in test mode on this demo, so no real money moves.
            </p>
          </div>
          <Button onClick={() => pay.mutate()} loading={pay.isPending} className="shrink-0">
            Pay now
          </Button>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-7">
          <OrderItems items={order.items} />
          <div className="border-t border-line pt-6">
            <Totals subtotalPaise={order.subtotalPaise} shippingPaise={order.shippingPaise} totalPaise={order.totalPaise} />
          </div>
          <div className="border-t border-line pt-6">
            <OrderFacts order={order} />
          </div>
          <div className="border-t border-line pt-6">
            <h3 className="mb-2 text-sm text-muted">Delivering to</h3>
            <AddressBlock address={order.shippingAddress} />
          </div>
        </div>
        <section aria-labelledby="progress-title" className="h-fit rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-7">
          <h3 id="progress-title" className="mb-6 font-semibold">
            Progress
          </h3>
          <OrderTimeline order={order} />
        </section>
      </div>
    </div>
  );
}

function awaitingPayment(o: Order) {
  return (
    o.paymentMethod === "RAZORPAY" &&
    o.paymentStatus === "UNPAID" &&
    o.status === "PENDING" &&
    !!o.paymentExpiresAt &&
    new Date(o.paymentExpiresAt) > new Date()
  );
}
