import { describe, expect, it } from "vitest";

import {
  approvedPayPalOrderFromWebhook,
  centsFromPayPalValue,
  connectionFromPayPalSeller,
  createPayPalPlatformAdapter,
  mapPayPalWebhookToPaymentEvent,
  paypalAmountFromCents,
  paypalAuthAssertion,
  paypalRevocationMerchantId,
  type PayPalApiClient,
} from "@/lib/payments/providers/paypal.server";
import type { PaymentProviderConnection } from "@/lib/payments/types";

function connection(
  overrides: Partial<PaymentProviderConnection> = {},
): PaymentProviderConnection {
  return {
    id: "conn-1",
    userId: "user-1",
    provider: "paypal",
    providerAccountId: "SELLER123",
    status: "connected",
    displayName: "Studio North",
    email: "seller@example.com",
    country: "CA",
    defaultCurrency: "CAD",
    chargesEnabled: true,
    payoutsEnabled: true,
    ...overrides,
  };
}

function createClient(): PayPalApiClient & {
  referralBody: unknown;
  orderBody: unknown;
  captured: unknown;
  verified: unknown;
} {
  const client = {
    referralBody: null as unknown,
    orderBody: null as unknown,
    captured: null as unknown,
    verified: null as unknown,
    async createPartnerReferral(body: unknown) {
      client.referralBody = body;
      return { actionUrl: "https://www.sandbox.paypal.com/bizsignup/partner/entry?token=abc" };
    },
    async showSellerStatus(merchantId: string) {
      return {
        merchantId,
        legalName: "Studio North",
        email: "seller@example.com",
        country: "CA",
        currency: "CAD",
        paymentsReceivable: true,
        emailConfirmed: true,
      };
    },
    async findMerchantByTrackingId() {
      return { merchantId: "SELLER123" };
    },
    async createOrder(body: unknown) {
      client.orderBody = body;
      return {
        id: "ORDER-1",
        status: "PAYER_ACTION_REQUIRED",
        links: [
          { rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1" },
        ],
      };
    },
    async captureOrder(orderId: string, headers: { sellerMerchantId: string }) {
      client.captured = { orderId, sellerMerchantId: headers.sellerMerchantId };
      return { id: orderId, status: "COMPLETED" };
    },
    async verifyWebhookSignature(body: unknown) {
      client.verified = body;
      return { verification_status: "SUCCESS" };
    },
  };
  return client;
}

function adapter(overrides: { client?: PayPalApiClient } = {}) {
  return createPayPalPlatformAdapter({
    clientId: "paypal-client",
    clientSecret: "secret",
    environment: "sandbox",
    partnerAttributionId: "BN-TEST",
    partnerMerchantId: "PARTNER1",
    webhookId: "WH-ID",
    client: overrides.client ?? createClient(),
  });
}

describe("PayPal amounts", () => {
  it("round-trips cents without floating-point drift", () => {
    expect(paypalAmountFromCents(7500)).toBe("75.00");
    expect(centsFromPayPalValue("75.00")).toBe(7500);
    expect(centsFromPayPalValue("75.5")).toBe(7550);
    expect(centsFromPayPalValue("not-a-number")).toBeNull();
  });
});

describe("PayPal platform adapter", () => {
  it("creates a third-party Partner Referrals link without a partner fee", async () => {
    const client = createClient();
    const paypal = adapter({ client });
    const url = await paypal.getConnectUrl({
      userId: "user-1",
      state: "csrf_state",
      redirectUri: "http://localhost:3000/api/payments/callback/paypal",
    });
    expect(url).toContain("sandbox.paypal.com");
    expect(client.referralBody).toMatchObject({
      tracking_id: "csrf_state",
      products: ["EXPRESS_CHECKOUT"],
      operations: [
        {
          operation: "API_INTEGRATION",
          api_integration_preference: {
            rest_api_integration: {
              integration_type: "THIRD_PARTY",
              third_party_details: { features: ["PAYMENT", "REFUND"] },
            },
          },
        },
      ],
    });
    expect(JSON.stringify(client.referralBody)).not.toContain("PARTNER_FEE");
  });

  it("does not treat an email alone as a usable seller account", () => {
    const pending = connectionFromPayPalSeller("SELLER123", {
      merchantId: "SELLER123",
      email: "seller@example.com",
      paymentsReceivable: false,
      emailConfirmed: true,
    });
    expect(pending.status).toBe("pending");
    expect(pending.chargesEnabled).toBe(false);
  });

  it("creates a hosted order for the connected seller without a platform fee", async () => {
    const client = createClient();
    const paypal = adapter({ client });
    const result = await paypal.createCheckout({
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
    expect(result.checkoutUrl).toContain("checkoutnow");
    expect(result.providerCheckoutId).toBe("ORDER-1");
    expect(client.orderBody).toMatchObject({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: "chk-1",
          custom_id: "chk-1",
          amount: { currency_code: "CAD", value: "75.00" },
          payee: { merchant_id: "SELLER123" },
        },
      ],
    });
    expect(JSON.stringify(client.orderBody)).not.toContain("platform_fees");
  });

  it("rejects an unverified webhook", async () => {
    const client = createClient();
    client.verifyWebhookSignature = async () => ({ verification_status: "FAILURE" });
    const paypal = adapter({ client });
    await expect(
      paypal.verifyWebhook(
        new Request("https://independentpocket.com/api/payments/webhooks/paypal", {
          method: "POST",
          headers: {
            "paypal-transmission-id": "t1",
            "paypal-transmission-time": "2026-09-10T00:00:00Z",
            "paypal-transmission-sig": "sig",
            "paypal-cert-url": "https://api.paypal.com/cert",
            "paypal-auth-algo": "SHA256withRSA",
          },
          body: JSON.stringify({ id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED" }),
        }),
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_WEBHOOK_INVALID" });
  });

  it("captures after the buyer approves and does not mark that event paid", async () => {
    const client = createClient();
    const paypal = adapter({ client });
    const event = {
      provider: "paypal" as const,
      providerEventId: "WH-APPROVED",
      eventType: "CHECKOUT.ORDER.APPROVED",
      payload: {
        id: "WH-APPROVED",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: {
          id: "ORDER-1",
          purchase_units: [{ payee: { merchant_id: "SELLER123" } }],
        },
      },
    };
    expect(approvedPayPalOrderFromWebhook(event)).toEqual({
      orderId: "ORDER-1",
      sellerMerchantId: "SELLER123",
    });
    await paypal.processWebhook?.(event);
    expect(client.captured).toEqual({ orderId: "ORDER-1", sellerMerchantId: "SELLER123" });
    expect(mapPayPalWebhookToPaymentEvent(event)).toBeNull();
  });
});

describe("PayPal webhook mapping", () => {
  it("marks a completed capture as paid using the seller merchant and order ids", () => {
    expect(
      mapPayPalWebhookToPaymentEvent({
        provider: "paypal",
        providerEventId: "WH-1",
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        payload: {
          id: "WH-1",
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          create_time: "2026-09-10T03:00:00Z",
          resource: {
            id: "CAP-1",
            amount: { currency_code: "CAD", value: "75.00" },
            payee: { merchant_id: "SELLER123" },
            supplementary_data: { related_ids: { order_id: "ORDER-1" } },
          },
        },
      }),
    ).toMatchObject({
      status: "completed",
      providerPaymentId: "CAP-1",
      providerCheckoutId: "ORDER-1",
      providerAccountId: "SELLER123",
      amountCents: 7500,
      currency: "CAD",
    });
  });

  it("does not mark a pending capture as paid", () => {
    expect(
      mapPayPalWebhookToPaymentEvent({
        provider: "paypal",
        providerEventId: "WH-2",
        eventType: "PAYMENT.CAPTURE.PENDING",
        payload: {
          event_type: "PAYMENT.CAPTURE.PENDING",
          resource: {
            id: "CAP-2",
            amount: { currency_code: "CAD", value: "75.00" },
            payee: { merchant_id: "SELLER123" },
            supplementary_data: { related_ids: { order_id: "ORDER-1" } },
          },
        },
      })?.status,
    ).toBe("pending");
  });

  it("maps partner consent revocation to the seller merchant id", () => {
    expect(
      paypalRevocationMerchantId({
        provider: "paypal",
        providerEventId: "WH-3",
        eventType: "MERCHANT.PARTNER-CONSENT.REVOKED",
        payload: {
          event_type: "MERCHANT.PARTNER-CONSENT.REVOKED",
          resource: { merchant_id: "SELLER123" },
        },
      }),
    ).toBe("SELLER123");
  });

  it("builds the partner auth assertion without embedding the client secret", () => {
    const assertion = paypalAuthAssertion("client-id", "SELLER123");
    expect(assertion.endsWith(".")).toBe(true);
    expect(assertion).not.toContain("secret");
  });
});
