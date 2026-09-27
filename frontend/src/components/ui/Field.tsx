import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export const controlClass =
  "w-full rounded-[var(--radius-ctl)] border border-line-strong bg-surface px-3.5 text-ink placeholder:text-muted/80 transition-colors hover:border-ink-2 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent aria-[invalid=true]:border-sale disabled:opacity-60";

type FieldProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
  optional?: boolean;
};

/** Label + control + hint/error, wired up with ids for screen readers. */
export function Field({ label, error, hint, children, className, optional }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-xs font-medium text-sale">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode; optional?: boolean; ref?: Ref<HTMLInputElement>; wrapperClassName?: string };

export function Input({ label, error, hint, optional, className, wrapperClassName, ref, ...rest }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          ref={ref}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(controlClass, "h-12", className)}
          {...rest}
        />
      )}
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: ReactNode; optional?: boolean; ref?: Ref<HTMLTextAreaElement> };

export function Textarea({ label, error, hint, optional, className, ref, ...rest }: TextareaProps) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          ref={ref}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(controlClass, "min-h-28 py-3 leading-relaxed", className)}
          {...rest}
        />
      )}
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: ReactNode; ref?: Ref<HTMLSelectElement>; wrapperClassName?: string };

export function Select({ label, error, hint, className, wrapperClassName, children, ref, ...rest }: SelectProps) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          ref={ref}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(controlClass, "h-12 appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10", selectArrow, className)}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
}

export const selectArrow =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23646a7e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]";
