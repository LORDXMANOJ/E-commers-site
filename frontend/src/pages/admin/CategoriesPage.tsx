import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { ApiError, del, get, patch, post } from "../../lib/api";
import { sized } from "../../lib/image";
import type { Category } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { Input, Textarea } from "../../components/ui/Field";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { Modal, useConfirm } from "../../components/ui/Dialog";
import { AdminHeader, panel } from "./adminUi";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(60),
  description: z.string().trim().max(500),
  imageUrl: z.union([z.literal(""), z.url("Enter a full https:// URL")]),
});
type Form = z.infer<typeof schema>;

function CategoryForm({ initial, onDone }: { initial?: Category; onDone: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState, setError } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? "", description: initial?.description ?? "", imageUrl: initial?.imageUrl ?? "" },
  });
  const onSubmit = handleSubmit(async (v) => {
    const body = { name: v.name, description: v.description || null, imageUrl: v.imageUrl || null };
    try {
      if (initial) await patch(`/admin/categories/${initial.id}`, body);
      else await post("/admin/categories", body);
      toast.success(initial ? "Category saved" : `${v.name} created`);
      void qc.invalidateQueries({ queryKey: ["categories"] });
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      onDone();
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) setError("name", { message: "A category with this name already exists" });
      else toast.error(err.message);
    }
  });
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5 p-6">
      <h2 className="text-lg font-semibold">{initial ? `Edit ${initial.name}` : "New category"}</h2>
      <Input label="Name" placeholder="e.g. Knitwear" {...register("name")} error={formState.errors.name?.message} />
      <Textarea label="Description" optional rows={3} placeholder="e.g. Merino, cashmere and cotton knits for every season." {...register("description")} error={formState.errors.description?.message} />
      <Input label="Image URL" optional placeholder="https://images.unsplash.com/…" {...register("imageUrl")} error={formState.errors.imageUrl?.message} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          {initial ? "Save category" : "Create category"}
        </Button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => get<Category[]>("/admin/categories") });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/admin/categories/${id}`),
    onSuccess: () => {
      toast.success("Category deleted");
      void qc.invalidateQueries({ queryKey: ["categories"] });
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <AdminHeader title="Categories" description="Group products so customers can browse.">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> New category
        </Button>
      </AdminHeader>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <Skeleton className="h-64 rounded-[var(--radius-card)]" />
      ) : data.length === 0 ? (
        <div className={panel}>
          <EmptyState icon={<Tags />} title="No categories yet" action={<Button onClick={() => setEditing("new")}>Create a category</Button>}>
            You need at least one category before adding products.
          </EmptyState>
        </div>
      ) : (
        <ul className={`${panel} divide-y divide-line`}>
          {data.map((c) => (
            <li key={c.id} className="flex items-center gap-4 p-4">
              <img src={c.imageUrl ? sized(c.imageUrl, 120) : undefined} alt="" className="size-12 shrink-0 rounded-[var(--radius-img)] bg-surface-2 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="truncate text-sm text-muted">{c.description || `/${c.slug}`}</p>
              </div>
              <Link to={`/admin/products?category=${c.slug}`} className="num hidden text-sm text-ink-2 hover:text-accent sm:block">
                {c.productCount} {c.productCount === 1 ? "product" : "products"}
              </Link>
              <div className="flex gap-1">
                <button type="button" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  className="grid size-9 place-items-center rounded-md text-muted hover:bg-sale-soft hover:text-sale"
                  onClick={async () => {
                    if (c.productCount > 0) {
                      toast.error(`Move or delete the ${c.productCount} product(s) in ${c.name} first`);
                      return;
                    }
                    if (await confirm({ title: `Delete ${c.name}?`, body: "This can't be undone.", confirmLabel: "Delete category", tone: "danger" })) remove.mutate(c.id);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Category">
        <CategoryForm initial={editing === "new" || editing === null ? undefined : editing} onDone={() => setEditing(null)} />
      </Modal>
    </>
  );
}
