import { describe, expect, it } from "vitest";
import {
  createStripeConnectAdapter,
  mapStripeWebhookToPaymentEvent,
  type StripeConnectClient,
} from "@/lib/payments/providers/stripe.server";
import type { PaymentProviderConnection } from "@/lib/payments/types";

function connection(
  overrides: Partial<PaymentProviderConnection> = {},
): PaymentProviderConnection {
  return {
    id: "conn-1",
    userId: "user-1",
    provider: "stripe",
    providerAccountId: "acct_seller",
    status: "connected",
    displayName: "Seller",
    email: null,
    country: "CA",
    defaultCurrency: "CAD",
    chargesEnabled: true,
    payoutsEnabled: true,
    ...overrides,
  };
}

function stripeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "checkout.session.completed",
    created: 1_778_000_000,
    account: "acct_seller",
    data: {
      object: {
        id: "cs_1",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_1",
        amount_total: 7_500,
        currency: "cad",
        metadata: {
          independentpocket_invoice_id: "inv-1",
          independentpocket_checkout_id: "chk-1",
        },
      },
    },
    ...overrides,
  };
}

function createMockStripe(): StripeConnectClient & {
  created: { params: unknown; options: unknown } | null;
  deauthorized: unknown;
} {
  const mock = {
    created: null as { params: unknown; options: unknown } | null,
    deauthorized: null as unknown,
    oauth: {
      authorizeUrl() {
        return "https://connect.stripe.com/oauth/authorize?state=abc";
      },
      async token() {
        return { stripe_user_id: "acct_seller" };
      },
      async deauthorize(params: { client_id?: string; stripe_user_id?: string }) {
        mock.deauthorized = params;
        return { stripe_user_id: params.stripe_user_id };
      },
    },
    accounts: {
      async retrieve() {
        return {
          id: "acct_seller",
          charges_enabled: true,
          payouts_enabled: true,
          email: "seller@example.com",
          country: "CA",
          default_currency: "cad",
          business_profile: { name: "Studio North" },
        };
      },
    },
    checkout: {
      sessions: {
        async create(params: unknown, options: unknown) {
          mock.created = { params, options };
          return {
            id: "cs_live",
            url: "https://checkout.stripe.com/c/pay/cs_live",
            expires_at: 1_778_003_600,
          };
        },
      },
    },
    webhooks: {
      constructEvent() {
        throw new Error("bad signature");
      },
    },
  };

  return mock as unknown as StripeConnectClient & {
    created: { params: unknown; options: unknown } | null;
    deauthorized: unknown;
  };
}

describe("Stripe Connect adapter", () => {
  it("creates Checkout on the connected account with no application fee", async () => {
    const stripe = createMockStripe();
    const adapter = createStripeConnectAdapter({
      stripe,
      connectClientId: "ca_test",
    });
    const result = await adapter.createCheckout({
      invoice: {
        id: "inv-1",
        userId: "user-1",
        invoiceNumber: "INV-001",
        currency: "CAD",
        outstandingCents: 7_500,
      },
      connection: connection(),
      checkoutId: "chk-1",
      successUrl: "https://independentpocket.com/invoice/x?checkout=success",
      cancelUrl: "https://independentpocket.com/invoice/x?checkout=cancelled",
    });
    expect(result.providerCheckoutId).toBe("cs_live");
    expect(stripe.created?.options).toMatchObject({
      stripeAccount: "acct_seller",
    });
    const params = stripe.created?.params as {
      payment_intent_data?: { application_fee_amount?: number };
    };
    expect(params.payment_intent_data).toBeUndefined();
  });

  it("deauthorizes with the connected account id, not an access token", async () => {
    const stripe = createMockStripe();
    const adapter = createStripeConnectAdapter({
      stripe,
      connectClientId: "ca_test",
    });
    await adapter.disconnect(connection());
    expect(stripe.deauthorized).toEqual({
      client_id: "ca_test",
      stripe_user_id: "acct_seller",
    });
  });

  it("rejects an invalid webhook signature", async () => {
    const stripe = createMockStripe();
    const adapter = createStripeConnectAdapter({
      stripe,
      connectClientId: "ca_test",
      webhookSecret: "whsec_test",
    });
    await expect(
      adapter.verifyWebhook(
        new Request("https://example.test/webhook", {
          method: "POST",
          headers: { "stripe-signature": "bad" },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_WEBHOOK_INVALID" });
  });
});

describe("Stripe webhook mapping", () => {
  it("ignores platform events that have no connected account", () => {
    const mapped = mapStripeWebhookToPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      eventType: "checkout.session.completed",
      payload: stripeEvent({ account: undefined }),
    });
    expect(mapped).toBeNull();
  });

  it("maps a paid connected-account Checkout session", () => {
    const mapped = mapStripeWebhookToPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      eventType: "checkout.session.completed",
      payload: stripeEvent(),
    });
    expect(mapped).toMatchObject({
      provider: "stripe",
      providerAccountId: "acct_seller",
      providerCheckoutId: "cs_1",
      providerPaymentId: "pi_1",
      amountCents: 7_500,
      currency: "CAD",
      status: "completed",
      invoiceId: "inv-1",
    });
  });

  it("does not complete payment from an unpaid session", () => {
    const mapped = mapStripeWebhookToPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      eventType: "checkout.session.completed",
      payload: stripeEvent({
        data: {
          object: {
            id: "cs_1",
            mode: "payment",
            payment_status: "unpaid",
            payment_intent: "pi_1",
            amount_total: 7_500,
            currency: "cad",
            metadata: { independentpocket_invoice_id: "inv-1" },
          },
        },
      }),
    });
    expect(mapped?.status).toBe("pending");
  });

  it("maps expired sessions as failed", () => {
    const mapped = mapStripeWebhookToPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_2",
      eventType: "checkout.session.expired",
      payload: stripeEvent({
        id: "evt_2",
        type: "checkout.session.expired",
      }),
    });
    expect(mapped?.status).toBe("failed");
  });
});
