import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input, Select } from "../ui/Field";
import { INDIAN_STATES, type AddressForm } from "../../lib/schemas";

/** Address inputs for react-hook-form. Autocomplete tokens let browsers fill them in one tap. */
export function AddressFields({ register, errors }: { register: UseFormRegister<AddressForm>; errors: FieldErrors<AddressForm> }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Input label="Full name" autoComplete="shipping name" {...register("fullName")} error={errors.fullName?.message} wrapperClassName="sm:col-span-2" />
      <Input label="Mobile number" type="tel" inputMode="tel" autoComplete="shipping tel" placeholder="98765 43210" {...register("phone")} error={errors.phone?.message} hint="For delivery updates only" wrapperClassName="sm:col-span-2" />
      <Input label="Address" autoComplete="shipping address-line1" placeholder="House no., street, area" {...register("line1")} error={errors.line1?.message} wrapperClassName="sm:col-span-2" />
      <Input label="Landmark or apartment" optional autoComplete="shipping address-line2" {...register("line2")} error={errors.line2?.message} wrapperClassName="sm:col-span-2" />
      <Input label="City" autoComplete="shipping address-level2" {...register("city")} error={errors.city?.message} />
      <Input label="PIN code" inputMode="numeric" autoComplete="shipping postal-code" maxLength={6} {...register("postalCode")} error={errors.postalCode?.message} />
      <Select label="State" autoComplete="shipping address-level1" {...register("state")} error={errors.state?.message} wrapperClassName="sm:col-span-2" defaultValue="">
        <option value="" disabled>
          Choose a state
        </option>
        {INDIAN_STATES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
    </div>
  );
}
