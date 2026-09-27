import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { errorMessage, post } from "../../lib/api";
import { passwordField } from "../../lib/schemas";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { AuthShell } from "./AuthShell";

const schema = z
  .object({ password: passwordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (!/^[a-f0-9]{64}$/.test(token))
    return (
      <AuthShell title="This link doesn't work" subtitle="Reset links expire after 30 minutes and can only be used once.">
        <ButtonLink to="/forgot-password" size="lg">Request a new link</ButtonLink>
      </AuthShell>
    );

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await post("/auth/reset-password", { token, password });
      toast.success("Password updated. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <AuthShell title="Choose a new password" subtitle="This signs you out on every other device." footer={<Link to="/login" className="link-underline">Back to sign in</Link>}>
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number" {...register("password")} error={formState.errors.password?.message} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" {...register("confirm")} error={formState.errors.confirm?.message} />
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
