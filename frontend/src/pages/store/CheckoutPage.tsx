import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, CreditCard, Lock, ShoppingBag } from "lucide-react";
import { useCart } from "../../providers/CartProvider";
import { useAuth } from "../../providers/AuthProvider";
import { estimateShipping, useShippingOptions } from "../../hooks/queries";
import { ApiError, post } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatINR, PAYMENT_LABEL, SHIPPING_LABEL } from "../../lib/format";
import { sized } from "../../lib/image";
import { addressSchema, cardSchema, type AddressForm, type CardForm } from "../../lib/schemas";
import type { Order, PaymentMethod, ShippingMethod } from "../../lib/types";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { EmptyState, Spinner } from "../../components/ui/Feedback";
import { AddressFields } from "../../components/order/AddressFields";
import { AddressBlock, Totals } from "../../components/order/OrderParts";

const STEPS = ["Address", "Delivery", "Payment", "Review"] as const;
type Step = 0 | 1 | 2 | 3;

function Stepper({ step, onGo }: { step: Step; onGo: (s: Step) => void }) {
  return (
    <ol className="mb-10 flex items-center gap-2 text-sm" aria-label="Checkout steps">
      {STEPS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-4 bg-line-strong sm:w-8" aria-hidden />}
            <button
              type="button"
              disabled={state === "todo"}
              onClick={() => onGo(i as Step)}
              aria-current={state === "current" ? "step" : undefined}
              className={cn("flex items-center gap-2 rounded-full py-1 pr-1", state === "todo" ? "text-muted" : "text-ink", state === "done" && "hover:underline")}
            >
              <span className={cn("num grid size-6 place-items-center rounded-full text-xs font-semibold", state === "todo" ? "border border-line-strong" : "bg-ink text-bg")}>{i + 1}</span>
              <span className={cn(state !== "current" && "hidden sm:inline")}>{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function SummaryCard({ shippingPaise }: { shippingPaise: number }) {
  const cart = useCart();
  return (
    <aside aria-labelledby="co-summary" className="h-fit rounded-[var(--radius-card)] border border-line bg-surface p-6 lg:sticky lg:top-28">
      <h2 id="co-summary" className="mb-5 text-lg font-semibold">
        In your bag <span className="num font-normal text-muted">({cart.itemCount})</span>
      </h2>
      <ul className="mb-6 space-y-4">
        {cart.lines.map((l) => (
          <li key={l.productId} className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img src={l.product.images[0] ? sized(l.product.images[0], 160) : undefined} alt="" className="aspect-[4/5] w-14 rounded-[var(--radius-img)] bg-surface-2 object-cover" />
              <span className="num absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-semibold text-bg">{l.quantity}</span>
            </div>
            <p className="min-w-0 flex-1 truncate text-sm">{l.product.name}</p>
            <p className="num text-sm">{formatINR(l.lineTotalPaise)}</p>
          </li>
        ))}
      </ul>
      <Totals subtotalPaise={cart.subtotalPaise} shippingPaise={shippingPaise} totalPaise={cart.subtotalPaise + shippingPaise} />
    </aside>
  );
}

export default function CheckoutPage() {
  const cart = useCart();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const shippingOpts = useShippingOptions();

  const [step, setStep] = useState<Step>(0);
  const [address, setAddress] = useState<AddressForm | null>(null);
  const [saveAddress, setSaveAddress] = useState(!user?.address);
  const [method, setMethod] = useState<ShippingMethod>("STANDARD");
  const [payment, setPayment] = useState<PaymentMethod>("COD");
  const [card, setCard] = useState<CardForm | null>(null);
  const [placing, setPlacing] = useState(false);

  const addressForm = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: user?.address ? { ...user.address, line2: user.address.line2 ?? "" } : { fullName: user?.name ?? "", state: "" },
  });
  const cardForm = useForm<CardForm>({ resolver: zodResolver(cardSchema), defaultValues: { name: user?.name ?? "" } });

  const shippingPaise = estimateShipping(shippingOpts, method, cart.subtotalPaise);
  const blocked = cart.lines.some((l) => !l.available);

  if (cart.isLoading) return <Spinner />;
  if (cart.lines.length === 0 && !placing)
    return (
      <EmptyState icon={<ShoppingBag />} title="Your bag is empty" action={<ButtonLink to="/shop">Browse the collection</ButtonLink>}>
        Add something to your bag to check out.
      </EmptyState>
    );

  const placeOrder = async () => {
    if (!address) return setStep(0);
    setPlacing(true);
    try {
      const order = await post<Order>("/orders", {
        shippingAddress: address,
        shippingMethod: method,
        paymentMethod: payment,
        card: payment === "CARD_SIMULATED" ? card : undefined,
        saveAddress,
      });
      qc.setQueryData(["cart"], { items: [], itemCount: 0, subtotalPaise: 0 });
      qc.setQueryData(["orders", order.id], order);
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      if (saveAddress) void qc.invalidateQueries({ queryKey: ["me"] });
      navigate(`/checkout/success/${order.id}`, { replace: true });
    } catch (e) {
      setPlacing(false);
      const err = e as ApiError;
      toast.error(err.message);
      if (err.status === 409) void qc.invalidateQueries({ queryKey: ["cart"] });
      if (err.status === 402) setStep(2);
    }
  };

  const radioCard = (active: boolean) =>
    cn("flex cursor-pointer items-start gap-4 rounded-[var(--radius-ctl)] border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", active ? "border-ink bg-surface" : "border-line-strong hover:border-ink-2");

  return (
    <div className="container-page pt-8 sm:pt-12">
      <title>Checkout · Aurelle</title>
      <h1 className="display mb-8 text-4xl sm:text-5xl">Checkout</h1>
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
        <div className="min-w-0">
          <Stepper step={step} onGo={setStep} />

          {step === 0 && (
            <form
              noValidate
              onSubmit={addressForm.handleSubmit((values) => {
                setAddress(values);
                setStep(1);
              })}
            >
              <h2 className="mb-6 text-xl font-semibold">Where should we deliver?</h2>
              <AddressFields register={addressForm.register} errors={addressForm.formState.errors} />
              <label className="mt-6 flex items-center gap-3 text-[0.95rem]">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="size-5 accent-[var(--accent)]" />
                Save this address to my account
              </label>
              <Button type="submit" size="lg" className="mt-8 w-full sm:w-auto">
                Continue to delivery
              </Button>
            </form>
          )}

          {step === 1 && (
            <div>
              <h2 className="mb-6 text-xl font-semibold">How fast do you need it?</h2>
              <fieldset className="space-y-3">
                <legend className="sr-only">Delivery speed</legend>
                {shippingOpts.methods.map((m) => {
                  const price = estimateShipping(shippingOpts, m.id, cart.subtotalPaise);
                  return (
                    <label key={m.id} className={radioCard(method === m.id)}>
                      <input type="radio" name="shipping" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 size-4 accent-[var(--accent)]" />
                      <span className="flex-1">
                        <span className="block font-medium">{m.label}</span>
                        <span className="text-sm text-muted">{m.eta}</span>
                      </span>
                      <span className="num font-medium">{price === 0 ? "Free" : formatINR(price)}</span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
                <Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button>
                <Button size="lg" onClick={() => setStep(2)}>Continue to payment</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-6 text-xl font-semibold">How would you like to pay?</h2>
              <fieldset className="space-y-3">
                <legend className="sr-only">Payment method</legend>
                <label className={radioCard(payment === "COD")}>
                  <input type="radio" name="payment" checked={payment === "COD"} onChange={() => setPayment("COD")} className="mt-1 size-4 accent-[var(--accent)]" />
                  <Banknote className="mt-0.5 size-5 text-muted" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-medium">Cash on delivery</span>
                    <span className="text-sm text-muted">Pay in cash or UPI when your order arrives.</span>
                  </span>
                </label>
                <label className={radioCard(payment === "CARD_SIMULATED")}>
                  <input type="radio" name="payment" checked={payment === "CARD_SIMULATED"} onChange={() => setPayment("CARD_SIMULATED")} className="mt-1 size-4 accent-[var(--accent)]" />
                  <CreditCard className="mt-0.5 size-5 text-muted" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-medium">Card (simulated)</span>
                    <span className="text-sm text-muted">A demo of card checkout. No real payment is taken.</span>
                  </span>
                </label>
              </fieldset>

              {payment === "CARD_SIMULATED" ? (
                <form
                  noValidate
                  className="mt-6"
                  onSubmit={cardForm.handleSubmit((values) => {
                    setCard(values);
                    setStep(3);
                  })}
                >
                  <div className="mb-5 rounded-[var(--radius-ctl)] border border-warn/30 bg-warn-soft p-4 text-sm text-ink">
                    <p className="font-semibold">Test mode: nothing will be charged</p>
                    <p className="num mt-1 text-ink-2">
                      Use 4242 4242 4242 4242 with any future expiry and any CVC. 4000 0000 0000 0002 is always declined.
                    </p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input label="Name on card" autoComplete="cc-name" {...cardForm.register("name")} error={cardForm.formState.errors.name?.message} wrapperClassName="sm:col-span-2" />
                    <Input label="Card number" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" className="num" {...cardForm.register("number")} error={cardForm.formState.errors.number?.message} wrapperClassName="sm:col-span-2" />
                    <Input label="Expiry" placeholder="MM/YY" inputMode="numeric" autoComplete="cc-exp" maxLength={5} className="num" {...cardForm.register("expiry")} error={cardForm.formState.errors.expiry?.message} />
                    <Input label="CVC" inputMode="numeric" autoComplete="cc-csc" maxLength={4} className="num" {...cardForm.register("cvc")} error={cardForm.formState.errors.cvc?.message} />
                  </div>
                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
                    <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                    <Button type="submit" size="lg">Review order</Button>
                  </div>
                </form>
              ) : (
                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
                  <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                  <Button size="lg" onClick={() => setStep(3)}>Review order</Button>
                </div>
              )}
            </div>
          )}

          {step === 3 && address && (
            <div>
              <h2 className="mb-6 text-xl font-semibold">Check everything before you place the order</h2>
              <div className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
                {[
                  { label: "Deliver to", step: 0 as Step, body: <AddressBlock address={address} /> },
                  { label: "Delivery", step: 1 as Step, body: <p>{SHIPPING_LABEL[method]}, <span className="num">{shippingPaise === 0 ? "free" : formatINR(shippingPaise)}</span></p> },
                  {
                    label: "Payment",
                    step: 2 as Step,
                    body: <p>{PAYMENT_LABEL[payment]}{payment === "CARD_SIMULATED" && card && <span className="num text-muted"> ending {card.number.replace(/\D/g, "").slice(-4)}</span>}</p>,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 p-5">
                    <div>
                      <h3 className="mb-1.5 text-sm text-muted">{row.label}</h3>
                      {row.body}
                    </div>
                    <button type="button" onClick={() => setStep(row.step)} className="link-underline text-sm">
                      Change
                    </button>
                  </div>
                ))}
              </div>
              {blocked && (
                <p className="mt-5 text-sm font-medium text-sale">
                  Some items are no longer available in that quantity. <Link to="/cart" className="underline">Update your bag</Link>.
                </p>
              )}
              <Button size="lg" className="mt-8 w-full" onClick={placeOrder} loading={placing} disabled={blocked}>
                <Lock className="size-4" aria-hidden /> Place order · <span className="num">{formatINR(cart.subtotalPaise + shippingPaise)}</span>
              </Button>
              <p className="mt-3 text-center text-xs text-muted">Prices and stock are confirmed by our server when you place the order.</p>
            </div>
          )}
        </div>

        <SummaryCard shippingPaise={shippingPaise} />
      </div>
    </div>
  );
}
