import "server-only";

import { PaymentError } from "@/lib/payments/errors";
import type {
  PaymentProviderAdapter,
  ProviderConnectionResult,
  ProviderWebhookEvent,
} from "@/lib/payments/types";
import {
  getPayPalEnv,
  isPayPalConfigured,
  paypalApiBaseUrl,
  type PayPalEnvironment,
} from "@/lib/paypal/env";

export const PAYPAL_THIRD_PARTY_FEATURES = ["PAYMENT", "REFUND"] as const;

type PayPalJson = Record<string, unknown>;

export type PayPalLink = {
  href?: string;
  rel?: string;
};

export type PayPalOrder = {
  id?: string;
  status?: string;
  links?: PayPalLink[];
};

export type PayPalMerchantStatus = {
  merchantId?: string;
  trackingId?: string;
  legalName?: string | null;
  email?: string | null;
  country?: string | null;
  currency?: string | null;
  paymentsReceivable?: boolean;
  emailConfirmed?: boolean;
};

export type PayPalApiClient = {
  createPartnerReferral(body: unknown): Promise<{ actionUrl?: string }>;
  showSellerStatus(merchantId: string): Promise<PayPalMerchantStatus>;
  findMerchantByTrackingId(trackingId: string): Promise<{ merchantId?: string }>;
  createOrder(
    body: unknown,
    headers: { requestId: string; sellerMerchantId: string },
  ): Promise<PayPalOrder>;
  captureOrder(
    orderId: string,
    headers: { requestId: string; sellerMerchantId: string },
  ): Promise<PayPalOrder>;
  verifyWebhookSignature(body: unknown): Promise<{ verification_status?: string }>;
};

function asRecord(value: unknown): PayPalJson | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as PayPalJson;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export function paypalAmountFromCents(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function centsFromPayPalValue(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }
  const [major, fraction = ""] = value.split(".");
  return Number(major) * 100 + Number((fraction + "00").slice(0, 2));
}

export function paypalAuthAssertion(clientId: string, sellerMerchantId: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ iss: clientId, payer_id: sellerMerchantId })}.`;
}

function linkHref(links: unknown, rel: string) {
  if (!Array.isArray(links)) {
    return null;
  }
  for (const item of links) {
    const link = asRecord(item);
    if (asString(link?.rel) === rel) {
      return asString(link?.href);
    }
  }
  return null;
}

export function connectionFromPayPalSeller(
  merchantId: string,
  status: PayPalMerchantStatus,
  returnAttributes: Record<string, string | null> = {},
): ProviderConnectionResult {
  const paymentsReceivable =
    status.paymentsReceivable ?? asBoolean(returnAttributes.permissionsGranted) ?? false;
  const emailConfirmed =
    status.emailConfirmed ?? asBoolean(returnAttributes.isEmailConfirmed) ?? false;
  const ready = paymentsReceivable && emailConfirmed;
  return {
    providerAccountId: status.merchantId || merchantId,
    status: ready ? "connected" : "pending",
    displayName: status.legalName ?? null,
    email: status.email ?? null,
    country: status.country ?? null,
    defaultCurrency: status.currency?.toUpperCase() ?? null,
    chargesEnabled: ready,
    payoutsEnabled: ready,
  };
}

export function mapPayPalWebhookToPaymentEvent(event: ProviderWebhookEvent) {
  const payload = asRecord(event.payload);
  if (!payload) {
    return null;
  }
  const eventType = asString(payload.event_type) ?? event.eventType;
  if (
    eventType !== "PAYMENT.CAPTURE.COMPLETED" &&
    eventType !== "PAYMENT.CAPTURE.DECLINED" &&
    eventType !== "PAYMENT.CAPTURE.PENDING"
  ) {
    return null;
  }
  const resource = asRecord(payload.resource);
  if (!resource) {
    return null;
  }
  const amount = asRecord(resource.amount);
  const value = asString(amount?.value);
  const currency = asString(amount?.currency_code);
  const amountCents = value ? centsFromPayPalValue(value) : null;
  const captureId = asString(resource.id);
  const supplementary = asRecord(resource.supplementary_data);
  const relatedIds = asRecord(supplementary?.related_ids);
  const orderId = asString(relatedIds?.order_id) ?? asString(resource.custom_id);
  const payee = asRecord(resource.payee);
  const units = Array.isArray(resource.purchase_units) ? resource.purchase_units : [];
  const unitPayee = asRecord(asRecord(units[0])?.payee);
  const merchantId =
    asString(payee?.merchant_id) ??
    asString(unitPayee?.merchant_id) ??
    asString(payload.merchant_id);
  if (!captureId || !orderId || !amountCents || !currency || !merchantId) {
    return null;
  }
  const status =
    eventType === "PAYMENT.CAPTURE.COMPLETED"
      ? ("completed" as const)
      : eventType === "PAYMENT.CAPTURE.DECLINED"
        ? ("failed" as const)
        : ("pending" as const);
  return {
    provider: "paypal" as const,
    providerEventId: event.providerEventId,
    eventType,
    providerPaymentId: captureId,
    providerCheckoutId: orderId,
    providerAccountId: merchantId,
    amountCents,
    currency: currency.toUpperCase(),
    status,
    occurredAt: asString(payload.create_time) ?? new Date().toISOString(),
  };
}

export function paypalRevocationMerchantId(event: ProviderWebhookEvent) {
  const payload = asRecord(event.payload);
  if (!payload || asString(payload.event_type) !== "MERCHANT.PARTNER-CONSENT.REVOKED") {
    return null;
  }
  const resource = asRecord(payload.resource);
  return asString(resource?.merchant_id) ?? asString(payload.merchant_id);
}

export function approvedPayPalOrderFromWebhook(event: ProviderWebhookEvent) {
  const payload = asRecord(event.payload);
  if (!payload || asString(payload.event_type) !== "CHECKOUT.ORDER.APPROVED") {
    return null;
  }
  const resource = asRecord(payload.resource);
  const orderId = asString(resource?.id);
  const units = Array.isArray(resource?.purchase_units) ? resource.purchase_units : [];
  const firstUnit = asRecord(units[0]);
  const payee = asRecord(firstUnit?.payee);
  const sellerMerchantId = asString(payee?.merchant_id);
  if (!orderId || !sellerMerchantId) {
    return null;
  }
  return { orderId, sellerMerchantId };
}

function merchantFromStatusPayload(payload: PayPalJson): PayPalMerchantStatus {
  return {
    merchantId: asString(payload.merchant_id) ?? undefined,
    trackingId: asString(payload.tracking_id) ?? undefined,
    legalName: asString(payload.legal_name),
    email: asString(payload.primary_email),
    country: asString(payload.country),
    currency: asString(payload.primary_currency),
    paymentsReceivable: asBoolean(payload.payments_receivable) ?? false,
    emailConfirmed: asBoolean(payload.primary_email_confirmed) ?? false,
  };
}

function paypalIssue(payload: PayPalJson) {
  const details = Array.isArray(payload.details) ? payload.details : [];
  for (const item of details) {
    const issue = asString(asRecord(item)?.issue);
    if (issue) {
      return issue;
    }
  }
  return asString(payload.name);
}

export function createPayPalFetchClient(deps: {
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
  partnerAttributionId?: string;
  partnerMerchantId?: string;
}): PayPalApiClient {
  const baseUrl = paypalApiBaseUrl(deps.environment);
  let cachedToken: { value: string; expiresAt: number } | null = null;

  async function accessToken() {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
      return cachedToken.value;
    }
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${deps.clientId}:${deps.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const payload = asRecord(await response.json().catch(() => null)) ?? {};
    const token = asString(payload.access_token);
    if (!response.ok || !token) {
      throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
    }
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 300;
    cachedToken = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  }

  function partnerHeaders(extra: Record<string, string> = {}) {
    return {
      ...(deps.partnerAttributionId
        ? { "PayPal-Partner-Attribution-Id": deps.partnerAttributionId }
        : {}),
      ...extra,
    };
  }

  async function request(
    path: string,
    init: {
      method: string;
      body?: unknown;
      extraHeaders?: Record<string, string>;
      tolerateIssues?: string[];
    },
    errorCode:
      | "PAYMENT_CONNECTION_UNUSABLE"
      | "PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED"
      | "PAYMENT_WEBHOOK_INVALID" = "PAYMENT_CONNECTION_UNUSABLE",
  ) {
    const token = await accessToken();
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...partnerHeaders(init.extraHeaders ?? {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const payload = asRecord(await response.json().catch(() => null)) ?? {};
    if (!response.ok) {
      const issue = paypalIssue(payload);
      if (issue && init.tolerateIssues?.includes(issue)) {
        return payload;
      }
      throw new PaymentError(errorCode);
    }
    return payload;
  }

  return {
    async createPartnerReferral(body) {
      const payload = await request("/v2/customer/partner-referrals", {
        method: "POST",
        body,
      });
      return { actionUrl: linkHref(payload.links, "action_url") ?? undefined };
    },
    async showSellerStatus(merchantId) {
      if (!deps.partnerMerchantId) {
        return { merchantId };
      }
      const payload = await request(
        `/v1/customer/partners/${encodeURIComponent(deps.partnerMerchantId)}/merchant-integrations/${encodeURIComponent(merchantId)}`,
        { method: "GET" },
      );
      return merchantFromStatusPayload(payload);
    },
    async findMerchantByTrackingId(trackingId) {
      if (!deps.partnerMerchantId) {
        return {};
      }
      const payload = await request(
        `/v1/customer/partners/${encodeURIComponent(deps.partnerMerchantId)}/merchant-integrations?tracking_id=${encodeURIComponent(trackingId)}`,
        { method: "GET" },
      );
      return { merchantId: asString(payload.merchant_id) ?? undefined };
    },
    async createOrder(body, headers) {
      const payload = await request(
        "/v2/checkout/orders",
        {
          method: "POST",
          body,
          extraHeaders: {
            "PayPal-Request-Id": headers.requestId,
            "PayPal-Auth-Assertion": paypalAuthAssertion(deps.clientId, headers.sellerMerchantId),
          },
        },
        "PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED",
      );
      return {
        id: asString(payload.id) ?? undefined,
        status: asString(payload.status) ?? undefined,
        links: Array.isArray(payload.links) ? (payload.links as PayPalLink[]) : [],
      };
    },
    async captureOrder(orderId, headers) {
      const payload = await request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        body: {},
        extraHeaders: {
          "PayPal-Request-Id": headers.requestId,
          "PayPal-Auth-Assertion": paypalAuthAssertion(deps.clientId, headers.sellerMerchantId),
        },
        tolerateIssues: ["ORDER_ALREADY_CAPTURED"],
      });
      return {
        id: asString(payload.id) ?? orderId,
        status: asString(payload.status) ?? undefined,
      };
    },
    async verifyWebhookSignature(body) {
      const payload = await request(
        "/v1/notifications/verify-webhook-signature",
        { method: "POST", body },
        "PAYMENT_WEBHOOK_INVALID",
      );
      return { verification_status: asString(payload.verification_status) ?? undefined };
    },
  };
}

export function createPayPalPlatformAdapter(deps: {
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
  partnerAttributionId?: string;
  partnerMerchantId?: string;
  webhookId?: string;
  client: PayPalApiClient;
}): PaymentProviderAdapter {
  async function sellerConnection(
    merchantId: string,
    returnAttributes: Record<string, string | null> = {},
  ): Promise<ProviderConnectionResult> {
    let status: PayPalMerchantStatus = { merchantId };
    try {
      status = await deps.client.showSellerStatus(merchantId);
    } catch {
      status = { merchantId };
    }
    return connectionFromPayPalSeller(merchantId, status, returnAttributes);
  }

  return {
    provider: "paypal",
    async getConnectUrl(params) {
      const returnUrl = new URL(params.redirectUri);
      returnUrl.searchParams.set("state", params.state);
      const referral = await deps.client.createPartnerReferral({
        tracking_id: params.state,
        partner_config_override: {
          return_url: returnUrl.toString(),
          return_url_description: "Return to IndependentPocket",
        },
        operations: [
          {
            operation: "API_INTEGRATION",
            api_integration_preference: {
              rest_api_integration: {
                integration_method: "PAYPAL",
                integration_type: "THIRD_PARTY",
                third_party_details: {
                  features: [...PAYPAL_THIRD_PARTY_FEATURES],
                },
              },
            },
          },
        ],
        products: ["EXPRESS_CHECKOUT"],
        legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
      });
      if (!referral.actionUrl) {
        throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
      }
      return referral.actionUrl;
    },
    async completeConnection(params) {
      const merchantId = params.code.trim();
      if (!merchantId) {
        throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
      }
      return sellerConnection(merchantId, params.returnAttributes ?? {});
    },
    async refreshConnection(connection) {
      return sellerConnection(connection.providerAccountId);
    },
    async disconnect() {
      // Third-party integrations have no seller token to revoke. Local disconnect still proceeds.
    },
    async createCheckout(params) {
      const order = await deps.client.createOrder(
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: params.checkoutId,
              custom_id: params.checkoutId,
              amount: {
                currency_code: params.invoice.currency.toUpperCase(),
                value: paypalAmountFromCents(params.invoice.outstandingCents),
              },
              payee: {
                merchant_id: params.connection.providerAccountId,
              },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                user_action: "PAY_NOW",
                payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                return_url: params.successUrl,
                cancel_url: params.cancelUrl,
              },
            },
          },
        },
        {
          requestId: `independentpocket-checkout:${params.checkoutId}`,
          sellerMerchantId: params.connection.providerAccountId,
        },
      );
      const checkoutUrl =
        linkHref(order.links, "payer-action") ?? linkHref(order.links, "approve");
      if (!order.id || !checkoutUrl) {
        throw new PaymentError("PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED");
      }
      return {
        providerCheckoutId: order.id,
        checkoutUrl,
      };
    },
    async verifyWebhook(request) {
      if (!deps.webhookId) {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      const rawBody = await request.text();
      let payload: PayPalJson;
      try {
        payload = asRecord(JSON.parse(rawBody) as unknown) ?? {};
      } catch {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      const verification = await deps.client.verifyWebhookSignature({
        auth_algo: request.headers.get("paypal-auth-algo"),
        cert_url: request.headers.get("paypal-cert-url"),
        transmission_id: request.headers.get("paypal-transmission-id"),
        transmission_sig: request.headers.get("paypal-transmission-sig"),
        transmission_time: request.headers.get("paypal-transmission-time"),
        webhook_id: deps.webhookId,
        webhook_event: payload,
      });
      if (verification.verification_status !== "SUCCESS") {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      const eventId = asString(payload.id);
      const eventType = asString(payload.event_type) ?? "";
      if (!eventId) {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      return {
        provider: "paypal",
        providerEventId: eventId,
        eventType,
        payload,
      };
    },
    async processWebhook(event) {
      const approved = approvedPayPalOrderFromWebhook(event);
      if (!approved) {
        return;
      }
      await deps.client.captureOrder(approved.orderId, {
        requestId: `independentpocket-capture:${approved.orderId}`,
        sellerMerchantId: approved.sellerMerchantId,
      });
    },
    async mapWebhookToPaymentEvent(event) {
      return mapPayPalWebhookToPaymentEvent(event);
    },
  };
}

export const paypalPlatformAdapter: PaymentProviderAdapter = {
  provider: "paypal",
  getConnectUrl: () => {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  },
  completeConnection: () => {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  },
  disconnect: () => {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  },
  createCheckout: () => {
    throw new PaymentError("PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED");
  },
  verifyWebhook: () => {
    throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
  },
  mapWebhookToPaymentEvent: async () => null,
};

export function getPayPalPlatformAdapter(): PaymentProviderAdapter {
  const env = getPayPalEnv();
  if ("error" in env) {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  }
  return createPayPalPlatformAdapter({
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    environment: env.environment,
    partnerAttributionId: env.partnerAttributionId,
    partnerMerchantId: env.partnerMerchantId,
    webhookId: env.webhookId,
    client: createPayPalFetchClient(env),
  });
}

export { isPayPalConfigured };
