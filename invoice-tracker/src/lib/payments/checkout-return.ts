export type CheckoutReturnState = "success" | "cancelled";

export function checkoutReturnFromSearchParam(
  value: string | string[] | undefined,
): CheckoutReturnState | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "success" || raw === "cancelled") {
    return raw;
  }
  return null;
}

export const CHECKOUT_CONFIRM_POLL_MS = 1500;
export const CHECKOUT_CONFIRM_MAX_POLLS = 20;
