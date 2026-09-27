import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { ApiError, get, patch, post } from "../../lib/api";
import { paiseToRupeesInput, rupeesToPaise } from "../../lib/format";
import type { AdminProduct } from "../../lib/types";
import { useCategories } from "../../hooks/queries";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Field";
import { ErrorState, Spinner } from "../../components/ui/Feedback";
import { AdminHeader, panel } from "./adminUi";

const money = z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter an amount like 1299 or 1299.50");

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(120),
    slug: z.union([z.literal(""), z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens")]),
    description: z.string().trim().min(10, "Write at least a sentence").max(5000),
    price: money,
    compareAt: z.union([z.literal(""), money]),
    categoryId: z.string().min(1, "Choose a category"),
    stock: z.string().trim().regex(/^\d{1,7}$/, "Enter a whole number"),
    images: z
      .string()
      .transform((s) => s.split(/\s+/).map((x) => x.trim()).filter(Boolean))
      .pipe(z.array(z.url("Each line must be a full https:// URL")).min(1, "Add at least one image URL").max(8, "Up to 8 images")),
    active: z.boolean(),
    featured: z.boolean(),
  })
  .refine((v) => !v.compareAt || rupeesToPaise(v.compareAt) > rupeesToPaise(v.price), { path: ["compareAt"], message: "Must be higher than the price" });

type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export default function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const existing = useQuery({ queryKey: ["admin", "product", id], queryFn: () => get<AdminProduct>(`/admin/products/${id}`), enabled: !isNew });

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", description: "", price: "", compareAt: "", categoryId: "", stock: "0", images: "", active: true, featured: false },
  });
  const { register, handleSubmit, formState, reset, setError, control } = form;
  const imagesText = useWatch({ control, name: "images" });
  const previews = (imagesText ?? "").split(/\s+/).filter((u) => /^https?:\/\//.test(u)).slice(0, 8);

  useEffect(() => {
    const p = existing.data;
    if (p)
      reset({
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: paiseToRupeesInput(p.pricePaise),
        compareAt: paiseToRupeesInput(p.compareAtPaise),
        categoryId: p.categoryId,
        stock: String(p.stock),
        images: p.images.join("\n"),
        active: p.active,
        featured: p.featured,
      });
  }, [existing.data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const body = {
      name: v.name,
      ...(v.slug ? { slug: v.slug } : {}),
      description: v.description,
      pricePaise: rupeesToPaise(v.price),
      compareAtPaise: v.compareAt ? rupeesToPaise(v.compareAt) : null,
      categoryId: v.categoryId,
      stock: Number(v.stock),
      images: v.images,
      active: v.active,
      featured: v.featured,
    };
    try {
      const saved = isNew ? await post<AdminProduct>("/admin/products", body) : await patch<AdminProduct>(`/admin/products/${id}`, body);
      toast.success(isNew ? `${saved.name} created` : `${saved.name} saved`);
      void qc.invalidateQueries({ queryKey: ["admin"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["categories"] });
      navigate("/admin/products");
    } catch (e) {
      const err = e as ApiError;
      const map: Record<string, keyof FormIn> = { pricePaise: "price", compareAtPaise: "compareAt", categoryId: "categoryId", slug: "slug", name: "name", images: "images" };
      let shown = false;
      for (const fe of err.errors) {
        const field = map[fe.path.split(".")[0]];
        if (field) {
          setError(field, { message: fe.message });
          shown = true;
        }
      }
      if (err.status === 409) setError("slug", { message: "Another product already uses this slug" });
      else if (!shown) toast.error(err.message);
    }
  });

  if (!isNew && existing.isError) return <ErrorState message={existing.error.message} onRetry={() => existing.refetch()} />;
  if (!isNew && existing.isPending) return <Spinner />;

  const e = formState.errors;
  return (
    <>
      <Link to="/admin/products" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Products
      </Link>
      <AdminHeader title={isNew ? "New product" : "Edit product"} />
      <form noValidate onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section className={`${panel} space-y-5 p-5`}>
            <Input label="Name" placeholder="e.g. Linen Camp-Collar Shirt" {...register("name")} error={e.name?.message} />
            <Input label="Slug" optional placeholder="e.g. linen-camp-collar-shirt" hint="Used in the product URL. Leave empty to generate it from the name." {...register("slug")} error={e.slug?.message} />
            <Textarea label="Description" rows={5} placeholder="e.g. Breathable washed linen with a relaxed camp collar, coconut-shell buttons and a straight hem made to be worn untucked." {...register("description")} error={e.description?.message} />
          </section>
          <section className={`${panel} grid gap-5 p-5 sm:grid-cols-3`}>
            <Input label="Price (₹)" inputMode="decimal" placeholder="2490" className="num" {...register("price")} error={e.price?.message} />
            <Input label="Compare-at price (₹)" optional inputMode="decimal" placeholder="2990" className="num" hint="Shows the item as on sale" {...register("compareAt")} error={e.compareAt?.message} />
            <Input label="Stock" inputMode="numeric" placeholder="25" className="num" {...register("stock")} error={e.stock?.message} />
          </section>
          <section className={`${panel} space-y-4 p-5`}>
            <Textarea label="Image URLs" rows={4} placeholder="https://images.unsplash.com/photo-1596755094514-f87e34085b2c" hint="One https:// URL per line. The first is the main image." className="font-mono text-sm" {...register("images")} error={e.images?.message} />
            {previews.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Image previews">
                {previews.map((u, i) => (
                  <li key={u + i}>
                    <img src={u} alt={`Preview ${i + 1}`} className="aspect-[4/5] w-20 rounded-[var(--radius-img)] bg-surface-2 object-cover" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className={`${panel} space-y-5 p-5`}>
            <Select label="Category" {...register("categoryId")} error={e.categoryId?.message}>
              <option value="">Choose…</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <label className="flex items-start gap-3">
              <input type="checkbox" {...register("active")} className="mt-0.5 size-5 accent-[var(--accent)]" />
              <span>
                <span className="block font-medium">Active</span>
                <span className="text-sm text-muted">Visible and purchasable in the store</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" {...register("featured")} className="mt-0.5 size-5 accent-[var(--accent)]" />
              <span>
                <span className="block font-medium">Featured</span>
                <span className="text-sm text-muted">Highlighted in curated sections</span>
              </span>
            </label>
          </section>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={formState.isSubmitting}>
              {isNew ? "Create product" : "Save changes"}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/admin/products")}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
