import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ReceiptText, Search } from "lucide-react";
import { get } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatDateTime, formatINR, PAYMENT_LABEL, plural, STATUS_LABEL } from "../../lib/format";
import type { AdminOrderRow, OrderStatus, Paginated } from "../../lib/types";
import { useDebounced } from "../../hooks/useDebounced";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { controlClass } from "../../components/ui/Field";
import { Pagination } from "../../components/ui/Pagination";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { AdminHeader, panel, td, th } from "./adminUi";

const TABS: (OrderStatus | "")[] = ["", "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as OrderStatus | "";
  const page = Number(params.get("page") ?? 1) || 1;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search.trim());

  const set = (patch: Record<string, string>) =>
    setParams(() => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
      if (!("page" in patch)) next.delete("page");
      return next;
    });

  useEffect(() => {
    if ((params.get("q") ?? "") !== q) set({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "orders", { status, q, page }],
    queryFn: () => get<Paginated<AdminOrderRow>>("/admin/orders", { status: status || undefined, q: q || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <AdminHeader title="Orders" description={data ? plural(data.total, "order") : undefined} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filter by status" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {TABS.map((t) => (
            <button
              key={t || "all"}
              role="tab"
              type="button"
              aria-selected={status === t}
              onClick={() => set({ status: t })}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors", status === t ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2")}
            >
              {t ? STATUS_LABEL[t] : "All"}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number, name or email" aria-label="Search orders" className={cn(controlClass, "h-10 pl-9 text-[16px] sm:text-sm")} />
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
      ) : data.items.length === 0 ? (
        <div className={panel}>
          <EmptyState icon={<ReceiptText />} title={status || q ? "No orders match" : "No orders yet"}>
            {status || q ? "Try another status or search." : "Orders appear here as soon as customers check out."}
          </EmptyState>
        </div>
      ) : (
        <div className={cn(panel, "overflow-hidden transition-opacity", isFetching && "opacity-70")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="border-b border-line bg-bg/50">
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Placed</th>
                  <th className={th}>Payment</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((o) => (
                  <tr key={o.id} className="hover:bg-bg/60">
                    <td className={td}>
                      <Link to={`/admin/orders/${o.id}`} className="num font-medium hover:text-accent">
                        {o.orderNumber}
                      </Link>
                      <p className="num text-xs text-muted">{plural(o._count.items, "item")}</p>
                    </td>
                    <td className={td}>
                      <p>{o.user.name}</p>
                      <p className="text-xs text-muted">{o.user.email}</p>
                    </td>
                    <td className={`${td} num text-muted`}>{formatDateTime(o.createdAt)}</td>
                    <td className={`${td} text-ink-2`}>
                      {PAYMENT_LABEL[o.paymentMethod]}
                      <p className="text-xs text-muted">{o.paymentStatus.charAt(0) + o.paymentStatus.slice(1).toLowerCase()}</p>
                    </td>
                    <td className={td}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className={`${td} num text-right font-medium`}>{formatINR(o.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} onChange={(p) => set({ page: String(p) })} />}
    </>
  );
}
