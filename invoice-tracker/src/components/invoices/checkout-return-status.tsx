"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CHECKOUT_CONFIRM_MAX_POLLS,
  CHECKOUT_CONFIRM_POLL_MS,
  type CheckoutReturnState,
} from "@/lib/payments/checkout-return";

const SLOW_POLL_MS = 5000;

export function CheckoutReturnStatus({
  checkout,
  paid,
}: {
  checkout: CheckoutReturnState;
  paid: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (checkout !== "success") {
      return;
    }
    if (paid) {
      router.replace(pathname, { scroll: false });
      return;
    }

    let polls = 0;
    let slowId: number | undefined;
    router.refresh();
    const id = window.setInterval(() => {
      polls += 1;
      router.refresh();
      if (polls < CHECKOUT_CONFIRM_MAX_POLLS) {
        return;
      }
      window.clearInterval(id);
      setTimedOut(true);
      slowId = window.setInterval(() => {
        router.refresh();
      }, SLOW_POLL_MS);
    }, CHECKOUT_CONFIRM_POLL_MS);

    return () => {
      window.clearInterval(id);
      if (slowId !== undefined) {
        window.clearInterval(slowId);
      }
    };
  }, [checkout, paid, pathname, router]);

  if (checkout === "cancelled" && !paid) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Checkout was cancelled. You can try again when you&apos;re ready.
      </p>
    );
  }

  if (checkout !== "success" || paid) {
    return null;
  }

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <p className="text-sm font-medium">
        {timedOut ? "Still confirming your payment" : "Confirming your payment…"}
      </p>
      <p className="text-sm text-muted-foreground">
        {timedOut
          ? "This can take a few seconds. You can wait here or refresh the page."
          : "This page will update when the payment is confirmed."}
      </p>
      {timedOut ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.refresh()}
        >
          Refresh
        </Button>
      ) : null}
    </div>
  );
}
