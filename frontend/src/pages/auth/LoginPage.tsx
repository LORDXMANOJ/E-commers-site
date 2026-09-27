import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "../../providers/AuthProvider";
import { ApiError } from "../../lib/api";
import { emailField } from "../../lib/schemas";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { AuthShell, safeNext } from "./AuthShell";

const schema = z.object({ email: emailField, password: z.string().min(1, "Enter your password") });
type Form = z.infer<typeof schema>;

const DEMO = [
  { label: "Customer", email: "demo@aurelle.dev", password: "Demo1234" },
  { label: "Admin", email: "admin@aurelle.dev", password: "Admin1234" },
];

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const { register, handleSubmit, setValue, setError, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={safeNext(next, user.role === "ADMIN" ? "/admin" : "/")} replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.name.split(" ")[0]}`);
      navigate(safeNext(next, u.role === "ADMIN" ? "/admin" : "/"), { replace: true });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setError("password", { message: err.message });
      else toast.error(err.message);
    }
  });

  return (
    <AuthShell
      title="Sign in"
      subtitle="Track orders, save your address and check out faster."
      footer={
        <>
          New to Aurelle?{" "}
          <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-underline font-medium text-ink">
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <Input label="Email" type="email" autoComplete="email" {...register("email")} error={formState.errors.email?.message} />
        <Input label="Password" type="password" autoComplete="current-password" {...register("password")} error={formState.errors.password?.message} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="link-underline text-sm">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>

      <div className="mt-8 rounded-[var(--radius-ctl)] border border-dashed border-line-strong p-4 text-sm">
        <p className="font-medium">Demo accounts</p>
        <p className="mt-0.5 text-muted">This is a portfolio store. Try it with a seeded account.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.label}
              type="button"
              className="rounded-full border border-line-strong px-3 py-1.5 hover:border-ink"
              onClick={() => {
                setValue("email", d.email, { shouldValidate: true });
                setValue("password", d.password, { shouldValidate: true });
              }}
            >
              Use {d.label.toLowerCase()} account
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
