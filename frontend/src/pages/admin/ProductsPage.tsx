import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackageOpen, Plus, Search, Trash2 } from "lucide-react";
import { del, get } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatINR, plural } from "../../lib/format";
import { sized } from "../../lib/image";
import type { AdminProduct, Paginated } from "../../lib/types";
import { useCategories } from "../../hooks/queries";
import { useDebounced } from "../../hooks/useDebounced";
import { ButtonLink } from "../../components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { controlClass, selectArrow } from "../../components/ui/Field";
import { Pagination } from "../../components/ui/Pagination";
import { useConfirm } from "../../components/ui/Dialog";
import { AdminHeader, panel, td, th } from "./adminUi";

const filterSelect = cn(controlClass, selectArrow, "h-10 w-auto appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9 text-[16px] sm:text-sm");

export default function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search.trim());
  const category = params.get("category") ?? "";
  const status = params.get("status") ?? "all";
  const page = Number(params.get("page") ?? 1) || 1;
  const { data: categories } = useCategories();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const set = (patch: Record<string, string>) =>
    setParams(() => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) (v && v !== "all" ? next.set(k, v) : next.delete(k));
      if (!("page" in patch)) next.delete("page");
      return next;
    });

  useEffect(() => {
    if ((params.get("q") ?? "") !== q) set({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "products", { q, category, status, page }],
    queryFn: () => get<Paginated<AdminProduct>>("/admin/products", { q: q || undefined, category: category || undefined, status, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/admin/products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted");
      void qc.invalidateQueries({ queryKey: ["admin"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <AdminHeader title="Products" description={data ? plural(data.total, "product") : undefined}>
        <ButtonLink to="/admin/products/new" size="sm">
          <Plus className="size-4" aria-hidden /> New product
        </ButtonLink>
      </AdminHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or description" aria-label="Search products" className={cn(controlClass, "h-10 pl-9 text-[16px] sm:text-sm")} />
        </div>
        <select aria-label="Category" value={category} onChange={(e) => set({ category: e.target.value })} className={filterSelect}>
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => set({ status: e.target.value })} className={filterSelect}>
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Hidden</option>
          <option value="low">Low stock</option>
        </select>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
      ) : data.items.length === 0 ? (
        <div className={panel}>
          <EmptyState icon={<PackageOpen />} title={q || category || status !== "all" ? "No products match" : "No products yet"} action={<ButtonLink to="/admin/products/new">Add a product</ButtonLink>}>
            {q || category || status !== "all" ? "Try a different search or filter." : "Add your first product to open the store."}
          </EmptyState>
        </div>
      ) : (
        <div className={cn(panel, "overflow-hidden transition-opacity", isFetching && "opacity-70")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-line bg-bg/50">
                <tr>
                  <th className={th}>Product</th>
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Price</th>
                  <th className={`${th} text-right`}>Stock</th>
                  <th className={th}>Status</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-bg/60">
                    <td className={td}>
                      <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-accent">
                        <img src={p.images[0] ? sized(p.images[0], 96) : undefined} alt="" className="size-10 shrink-0 rounded-[var(--radius-img)] bg-surface-2 object-cover" />
                        <span className="min-w-0">
                          <span className="block font-medium">{p.name}</span>
                          <span className="block text-xs text-muted">/{p.slug}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={`${td} text-ink-2`}>{p.category.name}</td>
                    <td className={`${td} num text-right`}>
                      {formatINR(p.pricePaise)}
                      {p.compareAtPaise && <s className="block text-xs text-muted">{formatINR(p.compareAtPaise)}</s>}
                    </td>
                    <td className={cn(td, "num text-right font-medium", p.stock === 0 ? "text-sale" : p.stock <= 5 && "text-warn")}>{p.stock}</td>
                    <td className={td}>
                      <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", p.active ? "bg-success-soft text-success" : "bg-surface-2 text-muted")}>{p.active ? "Active" : "Hidden"}</span>
                      {p.featured && <span className="ml-1.5 text-xs text-muted">Featured</span>}
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex justify-end gap-1">
                        <Link to={`/admin/products/${p.id}`} className="rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-2">
                          Edit
                        </Link>
                        <button
                          type="button"
                          aria-label={`Delete ${p.name}`}
                          className="grid size-8 place-items-center rounded-md text-muted hover:bg-sale-soft hover:text-sale"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: `Delete ${p.name}?`,
                                body: "It disappears from the store and from customers' bags. Past orders keep their copy of the name and price. To keep it but stop selling, hide it instead.",
                                confirmLabel: "Delete product",
                                tone: "danger",
                              })
                            )
                              remove.mutate(p.id);
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
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
