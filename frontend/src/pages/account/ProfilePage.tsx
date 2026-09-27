import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "../../providers/AuthProvider";
import { ApiError, patch, put } from "../../lib/api";
import { addressSchema, nameField, passwordField, type AddressForm } from "../../lib/schemas";
import type { User } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { AddressFields } from "../../components/order/AddressFields";

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-line py-10 first:pt-0 last:border-0 md:grid-cols-[18rem_1fr] md:gap-12">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

function NameForm() {
  const { user, setUser } = useAuth();
  const schema = z.object({ name: nameField });
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: user?.name } });
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async (v) => {
        try {
          const { user: u } = await patch<{ user: User }>("/me", v);
          setUser(u);
          reset({ name: u.name });
          toast.success("Name updated");
        } catch (e) {
          toast.error((e as Error).message);
        }
      })}
    >
      <Input label="Full name" autoComplete="name" {...register("name")} error={formState.errors.name?.message} />
      <Input label="Email" value={user?.email ?? ""} disabled readOnly hint="Email can't be changed" />
      <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
        Save name
      </Button>
    </form>
  );
}

const pwSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: passwordField, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

function PasswordForm() {
  const { setSession } = useAuth();
  const { register, handleSubmit, formState, reset, setError } = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async ({ currentPassword, newPassword }) => {
        try {
          setSession(await put<{ token: string; user: User }>("/me/password", { currentPassword, newPassword }));
          reset({ currentPassword: "", newPassword: "", confirm: "" });
          toast.success("Password changed. Other devices have been signed out.");
        } catch (e) {
          const err = e as ApiError;
          if (err.errors.some((x) => x.path === "currentPassword")) setError("currentPassword", { message: err.message });
          else toast.error(err.message);
        }
      })}
    >
      <Input label="Current password" type="password" autoComplete="current-password" {...register("currentPassword")} error={formState.errors.currentPassword?.message} />
      <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number" {...register("newPassword")} error={formState.errors.newPassword?.message} />
      <Input label="Confirm new password" type="password" autoComplete="new-password" {...register("confirm")} error={formState.errors.confirm?.message} />
      <Button type="submit" loading={formState.isSubmitting}>
        Change password
      </Button>
    </form>
  );
}

function SavedAddressForm() {
  const { user, setUser } = useAuth();
  const { register, handleSubmit, formState, reset } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: user?.address ? { ...user.address, line2: user.address.line2 ?? "" } : { fullName: user?.name ?? "", state: "" },
  });
  const save = async (address: AddressForm | null) => {
    try {
      const { user: u } = await put<{ user: User }>("/me/address", { address });
      setUser(u);
      if (!address) reset({ fullName: u.name, phone: "", line1: "", line2: "", city: "", state: "", postalCode: "" });
      toast.success(address ? "Address saved" : "Address removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <form noValidate onSubmit={handleSubmit(save)}>
      <AddressFields register={register} errors={formState.errors} />
      <div className="mt-6 flex gap-3">
        <Button type="submit" loading={formState.isSubmitting}>
          Save address
        </Button>
        {user?.address && (
          <Button variant="ghost" onClick={() => save(null)}>
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}

export default function ProfilePage() {
  return (
    <>
      <title>Profile · Aurelle</title>
      <Section title="Personal details" description="The name we use on orders and emails.">
        <NameForm />
      </Section>
      <Section title="Saved address" description="Filled in for you at checkout.">
        <SavedAddressForm />
      </Section>
      <Section title="Password" description="Changing it signs you out on every other device.">
        <PasswordForm />
      </Section>
    </>
  );
}
