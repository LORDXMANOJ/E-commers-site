import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "../../providers/AuthProvider";
import { ApiError } from "../../lib/api";
import { emailField, nameField, passwordField } from "../../lib/schemas";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { AuthShell, applyServerErrors, safeNext } from "./AuthShell";

const schema = z.object({ name: nameField, email: emailField, password: passwordField });
type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: signUp, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const { register, handleSubmit, setError, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={safeNext(next)} replace />;

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    try {
      await signUp(name, email, password);
      toast.success("Your account is ready");
      navigate(safeNext(next), { replace: true });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) setError("email", { message: err.message });
      else if (!applyServerErrors<Form>(err.errors, setError as never, ["name", "email", "password"])) toast.error(err.message);
    }
  });

  return (
    <AuthShell
      title="Create an account"
      subtitle="Save your address, follow deliveries and keep your bag across devices."
      footer={
        <>
          Already have an account?{" "}
          <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-underline font-medium text-ink">
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <Input label="Full name" autoComplete="name" {...register("name")} error={formState.errors.name?.message} />
        <Input label="Email" type="email" autoComplete="email" {...register("email")} error={formState.errors.email?.message} />
        <Input label="Password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number" {...register("password")} error={formState.errors.password?.message} />
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
