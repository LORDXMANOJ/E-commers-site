/** Always-visible notice that this is a demonstration store. Kept quiet so it doesn't fight the design. */
export function DemoNotice() {
  return (
    <div role="note" aria-label="Demo store notice" className="border-b border-line bg-ink text-bg">
      <p className="container-page py-2 text-center text-xs leading-snug sm:text-[0.8rem]">
        <span className="font-semibold tracking-wide uppercase">Demo store</span>
        <span aria-hidden className="mx-2 opacity-50">·</span>
        Products, customers, orders and payments are for demonstration only. No real payment is processed.
      </p>
    </div>
  );
}
