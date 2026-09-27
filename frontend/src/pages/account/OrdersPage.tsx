import { useState } from "react";
import { Link } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, Package } from "lucide-react";
import { get } from "../../lib/api";
import { formatDate, formatINR, plural } from "../../lib/format";
import { sized } from "../../lib/image";
import type { OrderSummary, Paginated } from "../../lib/types";
import { ButtonLink } from "../../components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { Pagination } from "../../components/ui/Pagination";
import { StatusBadge } from "../../components/ui/StatusBadge";

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["orders", "mine", page],
    queryFn: () => get<Paginated<OrderSummary>>("/orders", { page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isPending)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  if (data.total === 0)
    return (
      <EmptyState icon={<Package />} title="No orders yet" action={<ButtonLink to="/shop">Start shopping</ButtonLink>}>
        When you place an order, you can follow it here from confirmation to delivery.
      </EmptyState>
    );

  return (
    <>
      <title>Your orders · Aurelle</title>
      <ul className="space-y-3">
        {data.items.map((o) => (
          <li key={o.id}>
            <Link to={`/account/orders/${o.id}`} className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:gap-6 sm:p-5">
              <div className="flex shrink-0 -space-x-6">
                {o.items.slice(0, 3).map((i, k) => (
                  <img key={k} src={i.imageUrl ? sized(i.imageUrl, 160) : undefined} alt="" className="aspect-[4/5] w-12 rounded-[var(--radius-img)] bg-surface-2 object-cover ring-2 ring-surface sm:w-14" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="num font-semibold">{o.orderNumber}</p>
                  <StatusBadge status={o.status} />
                </div>
                <p className="num mt-1 text-sm text-muted">
                  {formatDate(o.createdAt)}, {plural(o._count.items, "item")}
                </p>
              </div>
              <p className="num hidden font-medium sm:block">{formatINR(o.totalPaise)}</p>
              <ChevronRight className="size-5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <Pagination className="mt-10" page={data.page} totalPages={data.totalPages} onChange={setPage} />
    </>
  );
}
