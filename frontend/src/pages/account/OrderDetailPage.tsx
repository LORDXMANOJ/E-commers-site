import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { ApiError, get, post } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import type { Order } from "../../lib/types";
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
                body: "The items go back into stock and you won't be charged. This can't be undone.",
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
