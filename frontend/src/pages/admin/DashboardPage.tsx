import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { get } from "../../lib/api";
import { formatDateTime, formatINR } from "../../lib/format";
import { sized } from "../../lib/image";
import type { AdminStats } from "../../lib/types";
import { ErrorState, Skeleton } from "../../components/ui/Feedback";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { AdminHeader, panel, td, th } from "./adminUi";
import { SalesChart } from "./SalesChart";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={`${panel} p-4 sm:p-5`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="num mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => get<AdminStats>("/admin/stats") });

  return (
    <>
      <AdminHeader title="Dashboard" description="Revenue excludes cancelled orders." />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-[var(--radius-card)]" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-[var(--radius-card)]" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Revenue" value={formatINR(data.revenuePaise)} />
            <Stat label="Orders" value={data.orderCount.toLocaleString("en-IN")} note={data.pendingCount ? `${data.pendingCount} waiting for confirmation` : "None waiting"} />
            <Stat label="Average order" value={formatINR(data.averageOrderPaise)} />
            <Stat label="Customers" value={data.customerCount.toLocaleString("en-IN")} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <section className={`${panel} p-4 sm:p-5`}>
              <SalesChart data={data.sales} />
            </section>

            <section className={`${panel} p-4 sm:p-5`} aria-labelledby="low-stock-title">
              <h2 id="low-stock-title" className="mb-3 flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 text-warn" aria-hidden /> Low stock
                <span className="num text-sm font-normal text-muted">(≤ {data.lowStockThreshold})</span>
              </h2>
              {data.lowStock.length === 0 ? (
                <p className="py-6 text-sm text-muted">Every active product has healthy stock.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.lowStock.map((p) => (
                    <li key={p.id}>
                      <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 py-2.5 hover:text-accent">
                        <img src={p.images[0] ? sized(p.images[0], 96) : undefined} alt="" className="size-9 rounded-[var(--radius-img)] bg-surface-2 object-cover" />
                        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                        <span className={`num text-sm font-semibold ${p.stock === 0 ? "text-sale" : "text-warn"}`}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className={panel} aria-labelledby="recent-title">
            <div className="flex items-center justify-between p-4 sm:px-5">
              <h2 id="recent-title" className="font-medium">
                Recent orders
              </h2>
              <Link to="/admin/orders" className="link-underline text-sm">
                All orders
              </Link>
            </div>
            {data.recentOrders.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted">No orders yet. They'll appear here as soon as customers check out.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="border-y border-line bg-bg/50">
                    <tr>
                      <th className={th}>Order</th>
                      <th className={th}>Customer</th>
                      <th className={th}>Placed</th>
                      <th className={th}>Status</th>
                      <th className={`${th} text-right`}>Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.recentOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-bg/60">
                        <td className={td}>
                          <Link to={`/admin/orders/${o.id}`} className="num font-medium hover:text-accent">
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className={td}>{o.user.name}</td>
                        <td className={`${td} num text-muted`}>{formatDateTime(o.createdAt)}</td>
                        <td className={td}>
                          <StatusBadge status={o.status} />
                        </td>
                        <td className={`${td} num text-right font-medium`}>{formatINR(o.totalPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
