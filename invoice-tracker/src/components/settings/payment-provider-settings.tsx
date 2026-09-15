"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  disconnectPaymentProvider,
  refreshPaymentConnections,
  type PaymentConnectionActionState,
} from "@/app/(dashboard)/settings/payment-actions";
import { Button } from "@/components/ui/button";
import type { PaymentProviderCard } from "@/lib/payments/connection-status";

const initialDisconnectState: PaymentConnectionActionState = {};

function DisconnectButton({ provider }: { provider: PaymentProviderCard["provider"] }) {
  const [state, action, pending] = useActionState(
    disconnectPaymentProvider,
    initialDisconnectState,
  );

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.error]);

  return (
    <form action={action}>
      <input type="hidden" name="provider" value={provider} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
    </form>
  );
}

function ProviderCard({ card }: { card: PaymentProviderCard }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{card.label}</h3>
        <p className="text-sm text-muted-foreground">{card.statusLabel}</p>
        {card.accountLine ? (
          <p className="text-sm text-muted-foreground">{card.accountLine}</p>
        ) : null}
        {card.status === "setup_required" ? (
          <p className="text-sm text-muted-foreground">
            Provider onboarding is not configured for this deployment yet.
          </p>
        ) : null}
        {card.status === "coming_soon" ? (
          <p className="text-sm text-muted-foreground">
            PayPal will be available after platform approval.
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {card.canConnect ? (
          <Button asChild size="sm">
            <a href={`/api/payments/connect/${card.provider}`}>Connect</a>
          </Button>
        ) : card.status === "setup_required" ? (
          <Button type="button" size="sm" disabled>
            Setup required
          </Button>
        ) : card.status === "coming_soon" ? (
          <Button type="button" size="sm" disabled>
            Coming soon
          </Button>
        ) : null}
        {card.canDisconnect ? <DisconnectButton provider={card.provider} /> : null}
      </div>
    </div>
  );
}

export function PaymentProviderSettings({ cards }: { cards: PaymentProviderCard[] }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-base font-medium">Payments</h2>
          <p className="text-sm text-muted-foreground">
            Connect the services you already use to receive client payments.
            IndependentPocket does not hold your invoice funds.
          </p>
        </div>
        <form action={refreshPaymentConnections}>
          <Button type="submit" variant="outline" size="sm">
            Refresh
          </Button>
        </form>
      </div>
      <div>{cards.map((card) => <ProviderCard key={card.provider} card={card} />)}</div>
    </section>
  );
}
