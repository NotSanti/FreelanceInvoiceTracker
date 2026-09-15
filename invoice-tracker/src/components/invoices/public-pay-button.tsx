"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { PaymentProvider } from "@/lib/payments/types";

export function PublicPayButton({
  publicToken,
  provider = "stripe",
}: {
  publicToken: string;
  provider?: PaymentProvider;
}) {
  const [pending, setPending] = useState(false);
  const label =
    provider === "square"
      ? "Pay with Square"
      : provider === "paypal"
        ? "Pay with PayPal"
        : "Pay with Stripe";

  async function startCheckout() {
    setPending(true);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicInvoiceToken: publicToken,
          provider,
        }),
      });
      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "This payment method is temporarily unavailable.");
      }
      window.location.href = payload.checkoutUrl;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "This payment method is temporarily unavailable.",
      );
      setPending(false);
    }
  }

  return (
    <Button type="button" size="sm" disabled={pending} onClick={() => void startCheckout()}>
      {pending ? "Redirecting…" : label}
    </Button>
  );
}

export function LegacyStripePayButton({ publicToken }: { publicToken: string }) {
  return (
    <form action="/api/stripe/checkout" method="post">
      <input type="hidden" name="public_token" value={publicToken} />
      <Button type="submit" size="sm">
        Pay securely
      </Button>
    </form>
  );
}
