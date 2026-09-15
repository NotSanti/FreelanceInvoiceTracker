import type {
  NormalizedPaymentEvent,
  PaymentProvider,
  PaymentProviderAdapter,
  PaymentProviderConnection,
  ProviderWebhookEvent,
} from "@/lib/payments/types";

export function createFakePaymentAdapter(
  provider: PaymentProvider = "stripe",
): PaymentProviderAdapter & {
  lastCheckoutOutstandingCents: number | null;
} {
  const adapter = {
    provider,
    lastCheckoutOutstandingCents: null as number | null,
    async getConnectUrl(params: { userId: string; state: string; redirectUri: string }) {
      return `https://example.test/${provider}/connect?state=${encodeURIComponent(params.state)}&redirect_uri=${encodeURIComponent(params.redirectUri)}`;
    },
    async completeConnection() {
      return {
        providerAccountId: `fake_${provider}_acct`,
        status: "connected" as const,
        displayName: "Fake seller",
        chargesEnabled: true,
        payoutsEnabled: true,
      };
    },
    async disconnect() {},
    async createCheckout(params: {
      invoice: { outstandingCents: number; id: string; userId: string; invoiceNumber: string; currency: string };
      connection: PaymentProviderConnection;
      checkoutId: string;
      successUrl: string;
      cancelUrl: string;
    }) {
      adapter.lastCheckoutOutstandingCents = params.invoice.outstandingCents;
      return {
        providerCheckoutId: `fake_chk_${provider}_${params.invoice.outstandingCents}`,
        checkoutUrl: `https://example.test/${provider}/pay`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
    },
    async verifyWebhook(request: Request): Promise<ProviderWebhookEvent> {
      const payload = await request.json();
      return {
        provider,
        providerEventId: String(payload.eventId ?? "evt_fake"),
        eventType: String(payload.eventType ?? "payment.updated"),
        payload,
      };
    },
    async mapWebhookToPaymentEvent(event: ProviderWebhookEvent) {
      const payload = event.payload as Record<string, unknown>;
      let status: NormalizedPaymentEvent["status"] = "completed";
      if (
        payload.status === "pending" ||
        payload.status === "failed" ||
        payload.status === "refunded"
      ) {
        status = payload.status;
      }
      return {
        provider,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        providerPaymentId: String(payload.paymentId ?? "pay_fake"),
        providerCheckoutId:
          typeof payload.checkoutId === "string" ? payload.checkoutId : undefined,
        providerAccountId: String(payload.accountId ?? `fake_${provider}_acct`),
        invoiceId: typeof payload.invoiceId === "string" ? payload.invoiceId : undefined,
        amountCents: Number(payload.amountCents ?? 0),
        currency: String(payload.currency ?? "CAD"),
        status,
        occurredAt: new Date().toISOString(),
      };
    },
  };

  return adapter;
}
