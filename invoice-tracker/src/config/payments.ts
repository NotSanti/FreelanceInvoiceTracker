export const MANUAL_PAYMENT_METHODS = [
  { value: "e-transfer", label: "e-Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
] as const;

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]["value"];

/** Card checkout stays in the codebase but is not offered until live Stripe is ready. */
export const STRIPE_CHECKOUT_ENABLED = false;

export function paymentMethodLabel(method: string) {
  if (method === "stripe") {
    return "Stripe";
  }
  return (
    MANUAL_PAYMENT_METHODS.find((option) => option.value === method)?.label ?? "Payment"
  );
}
