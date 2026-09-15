import { describe, expect, it } from "vitest";

import { reconcilePaymentEvent, type ReconcileStore } from "@/lib/payments/reconcile.server";
import type { NormalizedPaymentEvent, PaymentProviderConnection } from "@/lib/payments/types";

function createReconcileStore(): ReconcileStore & {
  payments: number;
  events: string[];
} {
  const store = {
    payments: 0,
    events: [] as string[],
    processed: new Set<string>(),
    async findWebhookEvent(provider: string, providerEventId: string) {
      return store.processed.has(`${provider}:${providerEventId}`)
        ? { id: providerEventId }
        : null;
    },
    async insertWebhookEvent(event: { provider: string; providerEventId: string }) {
      const key = `${event.provider}:${event.providerEventId}`;
      if (store.events.includes(key)) {
        return "duplicate" as const;
      }
      store.events.push(key);
      return "inserted" as const;
    },
    async markWebhookProcessed(provider: string, providerEventId: string) {
      store.processed.add(`${provider}:${providerEventId}`);
    },
    async findCheckout() {
      return {
        id: "chk-1",
        userId: "user-a",
        invoiceId: "inv-1",
        provider: "stripe" as const,
        providerConnectionId: "conn-a",
        providerCheckoutId: "cs_1",
        amountCents: 7_500,
        currency: "CAD",
        status: "pending" as const,
      };
    },
    async getConnectionById(): Promise<PaymentProviderConnection> {
      return {
        id: "conn-a",
        userId: "user-a",
        provider: "stripe",
        providerAccountId: "acct_a",
        status: "connected",
        displayName: "A",
        email: null,
        country: null,
        defaultCurrency: "CAD",
        chargesEnabled: true,
        payoutsEnabled: true,
      };
    },
    async findPayment() {
      return null;
    },
    async insertPayment() {
      store.payments += 1;
      return { id: `pay-${store.payments}` };
    },
    async updateCheckoutStatus() {},
  };
  return store;
}

function event(overrides: Partial<NormalizedPaymentEvent> = {}): NormalizedPaymentEvent {
  return {
    provider: "stripe",
    providerEventId: "evt_1",
    eventType: "checkout.session.completed",
    providerPaymentId: "pi_1",
    providerCheckoutId: "cs_1",
    providerAccountId: "acct_a",
    invoiceId: "inv-1",
    amountCents: 7_500,
    currency: "CAD",
    status: "completed",
    occurredAt: "2026-09-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("payment reconciliation", () => {
  it("inserts a completed payment once", async () => {
    const store = createReconcileStore();
    const first = await reconcilePaymentEvent(event(), store);
    const second = await reconcilePaymentEvent(event(), store);
    expect(first.paymentCreated).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(store.payments).toBe(1);
  });

  it("does not mark paid from a pending event", async () => {
    const store = createReconcileStore();
    const result = await reconcilePaymentEvent(event({ status: "pending" }), store);
    expect(result.paymentCreated).toBe(false);
    expect(store.payments).toBe(0);
  });

  it("rejects amount and currency mismatches", async () => {
    const store = createReconcileStore();
    await expect(reconcilePaymentEvent(event({ amountCents: 1 }), store)).rejects.toMatchObject({
      code: "PAYMENT_RECONCILE_REJECTED",
    });
    await expect(reconcilePaymentEvent(event({ currency: "USD" }), store)).rejects.toMatchObject({
      code: "PAYMENT_RECONCILE_REJECTED",
    });
  });

  it("rejects the wrong connected account", async () => {
    const store = createReconcileStore();
    await expect(
      reconcilePaymentEvent(event({ providerAccountId: "acct_other" }), store),
    ).rejects.toMatchObject({ code: "PAYMENT_OWNER_MISMATCH" });
  });
});
