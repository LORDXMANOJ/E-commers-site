import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

/**
 * Thin wrapper over the native <dialog>: showModal() gives us a focus trap, Escape to close,
 * an inert page behind it, and a ::backdrop, all for free and accessibly.
 */
function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handle = (e: Event) => {
      e.preventDefault(); // we control closing through state
      onClose();
    };
    d.addEventListener("cancel", handle);
    return () => d.removeEventListener("cancel", handle);
  }, [onClose]);
  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  return { ref, onBackdropClick };
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "side": right drawer on ≥sm, bottom sheet on phones. "full": full-screen (mobile menu). */
  variant?: "side" | "full";
};

export function Sheet({ open, onClose, title, children, footer, variant = "side" }: SheetProps) {
  const { ref, onBackdropClick } = useNativeDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClick={onBackdropClick}
      className={cn(
        "fixed m-0 max-h-none max-w-none bg-surface p-0 text-ink backdrop:bg-overlay open:flex open:flex-col",
        variant === "side"
          ? "inset-x-0 top-auto bottom-0 max-h-[88dvh] w-full rounded-t-[20px] shadow-[var(--shadow-sheet)] open:animate-[sheet-up_320ms_var(--ease-out)] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-dvh sm:w-[27rem] sm:rounded-none sm:open:animate-[sheet-left_320ms_var(--ease-out)]"
          : "inset-0 h-dvh max-h-dvh w-full open:animate-[fade-in_200ms_ease-out]",
        "backdrop:animate-[fade-in_200ms_ease-out]",
      )}
    >
      {variant === "side" && <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden />}
      <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="-mr-2 grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
          <X className="size-5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && <footer className="shrink-0 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
    </dialog>
  );
}

export function Modal({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const { ref, onBackdropClick } = useNativeDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClick={onBackdropClick}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-card)] bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-overlay open:animate-[pop-in_220ms_var(--ease-out)] backdrop:animate-[fade-in_200ms_ease-out]",
        className,
      )}
    >
      {open && children}
    </dialog>
  );
}

/* ─────────────── Confirmation dialog, used as `await confirm({...})` ─────────────── */

type ConfirmOptions = { title: string; body?: ReactNode; confirmLabel: string; cancelLabel?: string; tone?: "danger" | "primary" };
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), []);
  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );
  const cancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!pending} onClose={cancel} title={pending?.title ?? "Confirm"}>
        {pending && (
          <div className="p-6">
            <h2 className="text-lg font-semibold">{pending.title}</h2>
            {pending.body && <div className="mt-2 text-muted">{pending.body}</div>}
            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={cancel} autoFocus>
                {pending.cancelLabel ?? "Keep it"}
              </Button>
              <Button variant={pending.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
                {pending.confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}
