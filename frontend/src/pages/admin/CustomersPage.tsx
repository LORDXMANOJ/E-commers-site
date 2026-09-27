import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { get } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatDate, formatINR, plural } from "../../lib/format";
import type { Customer, Paginated } from "../../lib/types";
import { useDebounced } from "../../hooks/useDebounced";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { controlClass } from "../../components/ui/Field";
import { Pagination } from "../../components/ui/Pagination";
import { AdminHeader, panel, td, th } from "./adminUi";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "customers", { q, page }],
    queryFn: () => get<Paginated<Customer>>("/admin/customers", { q: q || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <AdminHeader title="Customers" description={data ? plural(data.total, "account") : undefined} />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Name or email"
          aria-label="Search customers"
          className={cn(controlClass, "h-10 pl-9 text-[16px] sm:text-sm")}
        />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <Skeleton className="h-80 rounded-[var(--radius-card)]" />
      ) : data.items.length === 0 ? (
        <div className={panel}>
          <EmptyState icon={<Users />} title={q ? "No one matches" : "No accounts yet"}>
            {q ? "Try another name or email." : "Customers appear here when they register."}
          </EmptyState>
        </div>
      ) : (
        <div className={cn(panel, "overflow-hidden transition-opacity", isFetching && "opacity-70")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-line bg-bg/50">
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Role</th>
                  <th className={th}>Joined</th>
                  <th className={`${th} text-right`}>Orders</th>
                  <th className={`${th} text-right`}>Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-bg/60">
                    <td className={td}>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted">{c.email}</p>
                    </td>
                    <td className={td}>
                      <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", c.role === "ADMIN" ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2")}>
                        {c.role === "ADMIN" ? "Admin" : "Customer"}
                      </span>
                    </td>
                    <td className={`${td} num text-muted`}>{formatDate(c.createdAt)}</td>
                    <td className={`${td} num text-right`}>{c.orderCount}</td>
                    <td className={`${td} num text-right font-medium`}>{formatINR(c.totalSpentPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  );
}
