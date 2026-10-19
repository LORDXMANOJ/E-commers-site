import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { get, patch, post } from "../../lib/api";
import { formatDateTime, NEXT_STATUSES, STATUS_LABEL } from "../../lib/format";
import type { Order, OrderStatus } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { controlClass } from "../../components/ui/Field";
import { ErrorState, Spinner } from "../../components/ui/Feedback";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useConfirm } from "../../components/ui/Dialog";
import { AddressBlock, OrderFacts, OrderItems, OrderTimeline, Totals } from "../../components/order/OrderParts";
import { AdminHeader, panel } from "./adminUi";

const ACTION_LABEL: Record<OrderStatus, string> = {
  PENDING: "Mark pending",
  CONFIRMED: "Confirm order",
  SHIPPED: "Mark as shipped",
  DELIVERED: "Mark as delivered",
  CANCELLED: "Cancel order",
};

export default function AdminOrderDetailPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [note, setNote] = useState("");
  const { data: order, isPending, isError, error, refetch } = useQuery({ queryKey: ["admin", "order", id], queryFn: () => get<Order>(`/admin/orders/${id}`) });

  const update = useMutation({
    mutationFn: (status: OrderStatus) => patch<Order>(`/admin/orders/${id}/status`, { status, note: note.trim() || undefined }),
    onSuccess: (o) => {
      qc.setQueryData(["admin", "order", id], { ...order, ...o });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      if (o.status === "CANCELLED") void qc.invalidateQueries({ queryKey: ["products"] });
      setNote("");
      toast.success(`Order ${o.orderNumber} is now ${STATUS_LABEL[o.status].toLowerCase()}`);
    },
    onError: (e) => {
      toast.error((e as Error).message);
      void refetch();
    },
  });

  const retryRefund = useMutation({
    mutationFn: () => post<Order>(`/admin/orders/${id}/refund`),
    onSuccess: (o) => {
      qc.setQueryData(["admin", "order", id], { ...order, ...o });
      if (o.razorpayRefundId) toast.success("Refund requested from Razorpay");
      else toast.error("Razorpay still refused the refund. Refund it from the Razorpay Dashboard.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (isPending) return <Spinner />;

  // An online order cannot be confirmed until Razorpay payment is verified (the server enforces this too).
  const awaitingPayment = order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "PAID";
  const next = NEXT_STATUSES[order.status].filter((s) => !(s === "CONFIRMED" && awaitingPayment));

  return (
    <>
      <Link to="/admin/orders" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Orders
      </Link>
      <AdminHeader title={order.orderNumber} description={`Placed ${formatDateTime(order.createdAt)}`}>
        <StatusBadge status={order.status} />
      </AdminHeader>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <section className={`${panel} p-5`}>
            <OrderItems items={order.items} />
            <div className="mt-6 border-t border-line pt-5">
              <Totals subtotalPaise={order.subtotalPaise} shippingPaise={order.shippingPaise} totalPaise={order.totalPaise} />
            </div>
          </section>
          <section className={`${panel} grid gap-6 p-5 md:grid-cols-[1fr_2fr]`}>
            <div>
              <h2 className="mb-2 text-sm text-muted">Customer</h2>
              <p className="font-medium">{order.user?.name}</p>
              <p className="text-sm text-ink-2">{order.user?.email}</p>
              <h2 className="mt-5 mb-2 text-sm text-muted">Ship to</h2>
              <AddressBlock address={order.shippingAddress} />
            </div>
            <OrderFacts order={order} />
          </section>
          {order.paymentMethod === "RAZORPAY" && (
            <section className={`${panel} p-5`} aria-labelledby="rzp-title">
              <h2 id="rzp-title" className="font-medium">Razorpay</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                {[
                  ["Order id", order.razorpayOrderId],
                  ["Payment id", order.razorpayPaymentId],
                  ["Refund id", order.razorpayRefundId],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted">{label}</dt>
                    <dd className="num mt-0.5 break-all">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">Look these up in the Razorpay Dashboard (test mode) to see the payment and any refund.</p>
              {order.status === "CANCELLED" && order.paymentStatus === "REFUND_PENDING" && !order.razorpayRefundId && (
                <Button className="mt-4" variant="secondary" loading={retryRefund.isPending} onClick={() => retryRefund.mutate()}>
                  Retry refund
                </Button>
              )}
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className={`${panel} p-5`} aria-labelledby="update-title">
            <h2 id="update-title" className="font-medium">
              Update status
            </h2>
            {next.length === 0 ? (
              <p className="mt-2 text-sm text-muted">This order is {STATUS_LABEL[order.status].toLowerCase()}. No further changes are possible.</p>
            ) : (
              <>
                <label className="mt-4 block text-sm">
                  <span className="text-muted">Note for the timeline (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Shipped via Blue Dart, AWB 1234567890" className={`${controlClass} mt-1 h-10 text-[16px] sm:text-sm`} />
                </label>
                <div className="mt-4 flex flex-col gap-2">
                  {next.map((s) => (
                    <Button
                      key={s}
                      variant={s === "CANCELLED" ? "secondary" : "primary"}
                      loading={update.isPending && update.variables === s}
                      disabled={update.isPending}
                      onClick={async () => {
                        if (
                          s === "CANCELLED" &&
                          !(await confirm({
                            title: `Cancel ${order.orderNumber}?`,
                            body: `Stock is restored${order.paymentStatus === "PAID" ? (order.paymentMethod === "RAZORPAY" ? " and a full refund is requested from Razorpay" : " and the simulated card payment is marked refunded") : ""}. This can't be undone.`,
                            confirmLabel: "Cancel order",
                            tone: "danger",
                          }))
                        )
                          return;
                        update.mutate(s);
                      }}
                    >
                      {ACTION_LABEL[s]}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </section>
          <section className={`${panel} p-5`} aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="mb-5 font-medium">
              Timeline
            </h2>
            <OrderTimeline order={order} />
            {order.events.some((e) => e.note) && (
              <ul className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
                {order.events
                  .filter((e) => e.note)
                  .map((e) => (
                    <li key={e.id}>
                      <span className="text-muted">{STATUS_LABEL[e.status]}:</span> {e.note}
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
