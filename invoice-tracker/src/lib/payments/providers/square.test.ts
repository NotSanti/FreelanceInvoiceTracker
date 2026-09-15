import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createSquareOAuthAdapter,
  mapSquareWebhookToPaymentEvent,
  squareRevocationMerchantId,
  verifySquareWebhookSignature,
  type SquareApiClient,
  type SquareTokenStore,
} from "@/lib/payments/providers/square.server";
import type { PaymentProviderConnection } from "@/lib/payments/types";

function connection(
  overrides: Partial<PaymentProviderConnection> = {},
): PaymentProviderConnection {
  return {
    id: "conn-1",
    userId: "user-1",
    provider: "square",
    providerAccountId: "ML_SELLER",
    status: "connected",
    displayName: "Studio North",
    email: null,
    country: "CA",
    defaultCurrency: "CAD",
    chargesEnabled: true,
    payoutsEnabled: true,
    ...overrides,
  };
}

function createTokenStore(): SquareTokenStore & { saved: unknown } {
  const store = {
    saved: null as unknown,
    async getSecrets() {
      return {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      };
    },
    async saveSecrets(_connectionId: string, tokens: unknown) {
      store.saved = tokens;
    },
  };
  return store;
}

function createClient(): SquareApiClient & {
  paymentLinkBody: unknown;
  revoked: unknown;
} {
  const client = {
    paymentLinkBody: null as unknown,
    revoked: null as unknown,
    async obtainToken() {
      return {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: "2030-01-01T00:00:00Z",
        merchant_id: "ML_SELLER",
      };
    },
    async revokeToken(params: { accessToken: string; clientId: string }) {
      client.revoked = params;
    },
    async retrieveMerchant() {
      return {
        id: "ML_SELLER",
        business_name: "Studio North",
        country: "CA",
        currency: "CAD",
        status: "ACTIVE",
      };
    },
    async listLocations() {
      return [{ id: "L1", status: "ACTIVE", currency: "CAD" }];
    },
    async createPaymentLink(_token: string, body: unknown) {
      client.paymentLinkBody = body;
      return {
        id: "plink_1",
        url: "https://square.link/u/abc",
        order_id: "order_1",
      };
    },
  };
  return client;
}

function adapter(overrides: { client?: SquareApiClient; tokenStore?: SquareTokenStore } = {}) {
  return createSquareOAuthAdapter({
    applicationId: "sandbox-sq0idb-test",
    applicationSecret: "secret",
    environment: "sandbox",
    webhookSignatureKey: "whsec_square",
    webhookNotificationUrl: "https://independentpocket.com/api/payments/webhooks/square",
    client: overrides.client ?? createClient(),
    tokenStore: overrides.tokenStore ?? createTokenStore(),
  });
}

describe("Square OAuth adapter", () => {
  it("requests current Checkout and Payments scopes without application fees", async () => {
    const square = adapter();
    const url = new URL(
      await square.getConnectUrl({
        userId: "user-1",
        state: "csrf",
        redirectUri: "http://localhost:3000/api/payments/callback/square",
      }),
    );
    expect(url.origin).toBe("https://connect.squareupsandbox.com");
    expect(url.searchParams.get("scope")).toContain("PAYMENTS_WRITE");
    expect(url.searchParams.get("scope")).toContain("ORDERS_WRITE");
    expect(url.searchParams.get("session")).toBeNull();
  });

  it("requires a fresh Square login in production OAuth", async () => {
    const square = createSquareOAuthAdapter({
      applicationId: "sq0idp-test",
      applicationSecret: "secret",
      environment: "production",
      webhookSignatureKey: "whsec_square",
      webhookNotificationUrl: "https://independentpocket.com/api/payments/webhooks/square",
      client: createClient(),
      tokenStore: createTokenStore(),
    });
    const url = new URL(
      await square.getConnectUrl({
        userId: "user-1",
        state: "csrf",
        redirectUri: "https://independentpocket.com/api/payments/callback/square",
      }),
    );
    expect(url.origin).toBe("https://connect.squareup.com");
    expect(url.searchParams.get("session")).toBe("false");
  });

  it("creates a hosted Payment Link with the seller token and checkout id", async () => {
    const client = createClient();
    const square = adapter({ client });
    const result = await square.createCheckout({
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
    expect(result.checkoutUrl).toBe("https://square.link/u/abc");
    expect(result.providerCheckoutId).toBe("order_1");
    expect(client.paymentLinkBody).toMatchObject({
      idempotency_key: "independentpocket-checkout:chk-1",
      order: {
        location_id: "L1",
        reference_id: "chk-1",
      },
    });
  });

  it("revokes the seller access token on disconnect", async () => {
    const client = createClient();
    const square = adapter({ client });
    await square.disconnect(connection());
    expect(client.revoked).toMatchObject({
      clientId: "sandbox-sq0idb-test",
      accessToken: "access-token",
    });
  });

  it("rejects an invalid webhook signature", async () => {
    const square = adapter();
    await expect(
      square.verifyWebhook(
        new Request("https://independentpocket.com/api/payments/webhooks/square", {
          method: "POST",
          headers: { "x-square-hmacsha256-signature": "nope" },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_WEBHOOK_INVALID" });
  });

  it("accepts a valid HMAC-SHA256 webhook signature", () => {
    const notificationUrl = "https://independentpocket.com/api/payments/webhooks/square";
    const rawBody = '{"hello":"world"}';
    const signature = createHmac("sha256", "whsec_square")
      .update(notificationUrl + rawBody)
      .digest("base64");
    expect(
      verifySquareWebhookSignature({
        rawBody,
        signatureHeader: signature,
        signatureKey: "whsec_square",
        notificationUrl,
      }),
    ).toBe(true);
  });
});

describe("Square webhook mapping", () => {
  function paymentEvent(status: string, overrides: Record<string, unknown> = {}) {
    return {
      provider: "square" as const,
      providerEventId: "evt_1",
      eventType: "payment.updated",
      payload: {
        merchant_id: "ML_SELLER",
        type: "payment.updated",
        event_id: "evt_1",
        created_at: "2026-09-10T02:00:00Z",
        data: {
          type: "payment",
          object: {
            payment: {
              id: "pay_1",
              status,
              order_id: "order_1",
              amount_money: { amount: 7500, currency: "CAD" },
            },
          },
        },
        ...overrides,
      },
    };
  }

  it("marks COMPLETED payments as completed", () => {
    expect(mapSquareWebhookToPaymentEvent(paymentEvent("COMPLETED"))).toMatchObject({
      status: "completed",
      providerPaymentId: "pay_1",
      providerCheckoutId: "order_1",
      providerAccountId: "ML_SELLER",
      amountCents: 7500,
      currency: "CAD",
    });
  });

  it("does not mark pending authorizations as paid", () => {
    expect(mapSquareWebhookToPaymentEvent(paymentEvent("APPROVED"))?.status).toBe("pending");
    expect(mapSquareWebhookToPaymentEvent(paymentEvent("PENDING"))?.status).toBe("pending");
  });

  it("reads merchant_id from authorization revocation", () => {
    expect(
      squareRevocationMerchantId({
        provider: "square",
        providerEventId: "evt_rev",
        eventType: "oauth.authorization.revoked",
        payload: {
          merchant_id: "ML_SELLER",
          type: "oauth.authorization.revoked",
        },
      }),
    ).toBe("ML_SELLER");
  });
});
