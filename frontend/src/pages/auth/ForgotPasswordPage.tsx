import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { errorMessage, post } from "../../lib/api";
import { emailField } from "../../lib/schemas";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { AuthShell } from "./AuthShell";

const schema = z.object({ email: emailField });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<{ message: string; devResetUrl?: string } | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setSent(await post<{ message: string; devResetUrl?: string }>("/auth/forgot-password", values));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  if (sent) {
    const devPath = sent.devResetUrl ? new URL(sent.devResetUrl).pathname + new URL(sent.devResetUrl).search : null;
    return (
      <AuthShell title="Check your email" footer={<Link to="/login" className="link-underline font-medium text-ink">Back to sign in</Link>}>
        <div className="flex gap-3">
          <MailCheck className="size-5 shrink-0 text-success" aria-hidden />
          <p className="text-ink-2">{sent.message} The link expires in 30 minutes.</p>
        </div>
        {devPath && (
          <div className="mt-6 rounded-[var(--radius-ctl)] border border-warn/30 bg-warn-soft p-4 text-sm">
            <p className="font-semibold">Development mode</p>
            <p className="mt-1 text-ink-2">No email provider is configured, so here is the reset link directly:</p>
            <Link to={devPath} className="mt-2 inline-block font-medium break-all text-accent underline" data-testid="dev-reset-link">
              Reset your password
            </Link>
          </div>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter the email you signed up with and we'll send you a link to choose a new password.">
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <Input label="Email" type="email" autoComplete="email" {...register("email")} error={formState.errors.email?.message} />
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
