import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { PaymentError } from "@/lib/payments/errors";
import type {
  PaymentProviderAdapter,
  PaymentProviderConnection,
  ProviderConnectionResult,
  ProviderWebhookEvent,
} from "@/lib/payments/types";
import {
  getSquareEnv,
  isSquareConfigured,
  squareApiBaseUrl,
} from "@/lib/square/env";

export const SQUARE_API_VERSION = "2026-08-19";

export const SQUARE_OAUTH_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "PAYMENTS_READ",
  "PAYMENTS_WRITE",
  "ORDERS_READ",
  "ORDERS_WRITE",
] as const;

export type SquareTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  merchant_id?: string;
};

export type SquareMerchant = {
  id?: string;
  business_name?: string;
  country?: string;
  currency?: string;
  status?: string;
  main_location_id?: string;
};

export type SquareLocation = {
  id?: string;
  status?: string;
  currency?: string;
};

export type SquarePaymentLink = {
  id?: string;
  url?: string;
  order_id?: string;
};

export type SquareTokenStore = {
  getSecrets(connectionId: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    tokenExpiresAt: string | null;
  } | null>;
  saveSecrets(
    connectionId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string | null;
      tokenExpiresAt?: string | null;
    },
  ): Promise<void>;
};

export type SquareApiClient = {
  obtainToken(body: Record<string, string>): Promise<SquareTokenResponse>;
  revokeToken(params: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
  }): Promise<void>;
  retrieveMerchant(accessToken: string, merchantId: string): Promise<SquareMerchant>;
  listLocations(accessToken: string): Promise<SquareLocation[]>;
  createPaymentLink(accessToken: string, body: unknown): Promise<SquarePaymentLink>;
};

type SquareJson = Record<string, unknown>;

function asRecord(value: unknown): SquareJson | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as SquareJson;
}

async function readSquareJson(response: Response): Promise<SquareJson> {
  const payload = asRecord(await response.json().catch(() => null));
  return payload ?? {};
}

function squareRequestFailed(payload: SquareJson, ok: boolean) {
  return !ok || Array.isArray(payload.errors);
}

export function createSquareFetchClient(baseUrl: string): SquareApiClient {
  async function request(
    path: string,
    init: {
      method: string;
      accessToken?: string;
      extraHeaders?: Record<string, string>;
      body?: unknown;
    },
    errorCode:
      | "PAYMENT_CONNECTION_UNUSABLE"
      | "PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED" = "PAYMENT_CONNECTION_UNUSABLE",
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        "Square-Version": SQUARE_API_VERSION,
        "Content-Type": "application/json",
        ...(init.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
        ...init.extraHeaders,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const payload = await readSquareJson(response);
    if (squareRequestFailed(payload, response.ok)) {
      throw new PaymentError(errorCode);
    }
    return payload;
  }

  return {
    async obtainToken(body) {
      const payload = await request("/oauth2/token", { method: "POST", body });
      return {
        access_token: typeof payload.access_token === "string" ? payload.access_token : undefined,
        refresh_token: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
        expires_at: typeof payload.expires_at === "string" ? payload.expires_at : undefined,
        merchant_id: typeof payload.merchant_id === "string" ? payload.merchant_id : undefined,
      };
    },
    async revokeToken(params) {
      await request("/oauth2/revoke", {
        method: "POST",
        extraHeaders: { Authorization: `Client ${params.clientSecret}` },
        body: {
          client_id: params.clientId,
          access_token: params.accessToken,
        },
      });
    },
    async retrieveMerchant(accessToken, merchantId) {
      const payload = await request(`/v2/merchants/${encodeURIComponent(merchantId)}`, {
        method: "GET",
        accessToken,
      });
      const merchant = asRecord(payload.merchant) ?? payload;
      return {
        id: typeof merchant.id === "string" ? merchant.id : undefined,
        business_name: typeof merchant.business_name === "string" ? merchant.business_name : undefined,
        country: typeof merchant.country === "string" ? merchant.country : undefined,
        currency: typeof merchant.currency === "string" ? merchant.currency : undefined,
        status: typeof merchant.status === "string" ? merchant.status : undefined,
        main_location_id:
          typeof merchant.main_location_id === "string" ? merchant.main_location_id : undefined,
      };
    },
    async listLocations(accessToken) {
      const payload = await request("/v2/locations", { method: "GET", accessToken });
      const locations = Array.isArray(payload.locations) ? payload.locations : [];
      return locations.flatMap((item) => {
        const location = asRecord(item);
        if (!location) {
          return [];
        }
        return [
          {
            id: typeof location.id === "string" ? location.id : undefined,
            status: typeof location.status === "string" ? location.status : undefined,
            currency: typeof location.currency === "string" ? location.currency : undefined,
          },
        ];
      });
    },
    async createPaymentLink(accessToken, body) {
      const payload = await request(
        "/v2/online-checkout/payment-links",
        {
          method: "POST",
          accessToken,
          body,
        },
        "PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED",
      );
      const link = asRecord(payload.payment_link) ?? {};
      return {
        id: typeof link.id === "string" ? link.id : undefined,
        url: typeof link.url === "string" ? link.url : undefined,
        order_id: typeof link.order_id === "string" ? link.order_id : undefined,
      };
    },
  };
}

export function verifySquareWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  signatureKey: string;
  notificationUrl: string;
}) {
  if (!input.signatureHeader) {
    return false;
  }
  const digest = createHmac("sha256", input.signatureKey)
    .update(input.notificationUrl + input.rawBody)
    .digest("base64");
  const expected = Buffer.from(digest);
  const received = Buffer.from(input.signatureHeader);
  if (expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(expected, received);
}

function connectionFromMerchant(
  merchant: SquareMerchant,
  merchantId: string,
): ProviderConnectionResult {
  const active = merchant.status === "ACTIVE" || !merchant.status;
  return {
    providerAccountId: merchant.id || merchantId,
    status: active ? "connected" : "restricted",
    displayName: merchant.business_name ?? null,
    country: merchant.country ?? null,
    defaultCurrency: merchant.currency?.toUpperCase() ?? null,
    chargesEnabled: active,
    payoutsEnabled: active,
  };
}

function tokenExpiresSoon(tokenExpiresAt: string | null) {
  if (!tokenExpiresAt) {
    return true;
  }
  const expiresAt = Date.parse(tokenExpiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now() + 60_000;
}

function paymentObjectFromEvent(payload: SquareJson) {
  const data = asRecord(payload.data);
  const object = asRecord(data?.object);
  if (!object) {
    return null;
  }
  return asRecord(object.payment) ?? object;
}

function paymentStatus(status: string | undefined): "pending" | "completed" | "failed" | null {
  if (status === "COMPLETED") {
    return "completed";
  }
  if (status === "FAILED" || status === "CANCELED") {
    return "failed";
  }
  if (status === "APPROVED" || status === "PENDING") {
    return "pending";
  }
  return null;
}

export function mapSquareWebhookToPaymentEvent(event: ProviderWebhookEvent) {
  const payload = asRecord(event.payload);
  if (!payload) {
    return null;
  }
  const merchantId = typeof payload.merchant_id === "string" ? payload.merchant_id : null;
  if (!merchantId) {
    return null;
  }
  const type = typeof payload.type === "string" ? payload.type : event.eventType;
  if (type !== "payment.created" && type !== "payment.updated") {
    return null;
  }
  const payment = paymentObjectFromEvent(payload);
  if (!payment) {
    return null;
  }
  const amountMoney = asRecord(payment.amount_money);
  const amountCents = typeof amountMoney?.amount === "number" ? amountMoney.amount : null;
  const currency = typeof amountMoney?.currency === "string" ? amountMoney.currency : null;
  const paymentId = typeof payment.id === "string" ? payment.id : null;
  const orderId = typeof payment.order_id === "string" ? payment.order_id : null;
  const status = paymentStatus(typeof payment.status === "string" ? payment.status : undefined);
  if (!paymentId || !orderId || !amountCents || !currency || !status) {
    return null;
  }
  const createdAt =
    typeof payload.created_at === "string" ? payload.created_at : new Date().toISOString();
  return {
    provider: "square" as const,
    providerEventId: event.providerEventId,
    eventType: type,
    providerPaymentId: paymentId,
    providerCheckoutId: orderId,
    providerAccountId: merchantId,
    amountCents,
    currency: currency.toUpperCase(),
    status,
    occurredAt: createdAt,
  };
}

export function squareRevocationMerchantId(event: ProviderWebhookEvent) {
  const payload = asRecord(event.payload);
  if (!payload || payload.type !== "oauth.authorization.revoked") {
    return null;
  }
  return typeof payload.merchant_id === "string" ? payload.merchant_id : null;
}

export function createSquareOAuthAdapter(deps: {
  applicationId: string;
  applicationSecret: string;
  environment: "sandbox" | "production";
  webhookSignatureKey?: string;
  webhookNotificationUrl: string;
  client: SquareApiClient;
  tokenStore: SquareTokenStore;
}): PaymentProviderAdapter {
  const baseUrl = squareApiBaseUrl(deps.environment);

  async function sellerAccessToken(connection: PaymentProviderConnection) {
    const secrets = await deps.tokenStore.getSecrets(connection.id);
    if (!secrets?.accessToken) {
      throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
    }
    if (!tokenExpiresSoon(secrets.tokenExpiresAt)) {
      return secrets.accessToken;
    }
    if (!secrets.refreshToken) {
      throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
    }
    const refreshed = await deps.client.obtainToken({
      client_id: deps.applicationId,
      client_secret: deps.applicationSecret,
      grant_type: "refresh_token",
      refresh_token: secrets.refreshToken,
    });
    if (!refreshed.access_token) {
      throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
    }
    await deps.tokenStore.saveSecrets(connection.id, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? secrets.refreshToken,
      tokenExpiresAt: refreshed.expires_at ?? null,
    });
    return refreshed.access_token;
  }

  async function connectionFromAccessToken(
    accessToken: string,
    merchantId: string,
    tokens: SquareTokenResponse,
  ): Promise<ProviderConnectionResult> {
    const merchant = await deps.client.retrieveMerchant(accessToken, merchantId);
    return {
      ...connectionFromMerchant(merchant, merchantId),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_at ?? null,
    };
  }

  return {
    provider: "square",
    async getConnectUrl(params) {
      const url = new URL(`${baseUrl}/oauth2/authorize`);
      url.searchParams.set("client_id", deps.applicationId);
      url.searchParams.set("scope", SQUARE_OAUTH_SCOPES.join(" "));
      // Sandbox does not support session=false; production should require a login.
      if (deps.environment === "production") {
        url.searchParams.set("session", "false");
      }
      url.searchParams.set("state", params.state);
      url.searchParams.set("redirect_uri", params.redirectUri);
      return url.toString();
    },
    async completeConnection(params) {
      const token = await deps.client.obtainToken({
        client_id: deps.applicationId,
        client_secret: deps.applicationSecret,
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirectUri,
      });
      if (!token.access_token || !token.merchant_id) {
        throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
      }
      return connectionFromAccessToken(token.access_token, token.merchant_id, token);
    },
    async refreshConnection(connection) {
      const accessToken = await sellerAccessToken(connection);
      const merchant = await deps.client.retrieveMerchant(
        accessToken,
        connection.providerAccountId,
      );
      return connectionFromMerchant(merchant, connection.providerAccountId);
    },
    async disconnect(connection) {
      const secrets = await deps.tokenStore.getSecrets(connection.id);
      if (!secrets?.accessToken) {
        return;
      }
      await deps.client.revokeToken({
        clientId: deps.applicationId,
        clientSecret: deps.applicationSecret,
        accessToken: secrets.accessToken,
      });
    },
    async createCheckout(params) {
      const accessToken = await sellerAccessToken(params.connection);
      const locations = await deps.client.listLocations(accessToken);
      const location =
        locations.find((item) => item.status === "ACTIVE" && item.id) ??
        locations.find((item) => item.id);
      if (!location?.id) {
        throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
      }
      const link = await deps.client.createPaymentLink(accessToken, {
        idempotency_key: `independentpocket-checkout:${params.checkoutId}`,
        checkout_options: {
          redirect_url: params.successUrl,
        },
        order: {
          location_id: location.id,
          reference_id: params.checkoutId,
          line_items: [
            {
              name: `Invoice ${params.invoice.invoiceNumber}`,
              quantity: "1",
              base_price_money: {
                amount: params.invoice.outstandingCents,
                currency: params.invoice.currency.toUpperCase(),
              },
            },
          ],
        },
      });
      if (!link.url || (!link.order_id && !link.id)) {
        throw new PaymentError("PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED");
      }
      return {
        providerCheckoutId: link.order_id || link.id || params.checkoutId,
        checkoutUrl: link.url,
      };
    },
    async verifyWebhook(request) {
      if (!deps.webhookSignatureKey) {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      const signature = request.headers.get("x-square-hmacsha256-signature");
      const rawBody = await request.text();
      if (
        !verifySquareWebhookSignature({
          rawBody,
          signatureHeader: signature,
          signatureKey: deps.webhookSignatureKey,
          notificationUrl: deps.webhookNotificationUrl,
        })
      ) {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      let payload: ReturnType<typeof asRecord>;
      try {
        payload = asRecord(JSON.parse(rawBody) as unknown);
      } catch {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      if (!payload) {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      const eventId = typeof payload.event_id === "string" ? payload.event_id : null;
      const eventType = typeof payload.type === "string" ? payload.type : "";
      if (!eventId) {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      return {
        provider: "square",
        providerEventId: eventId,
        eventType,
        payload,
      };
    },
    async mapWebhookToPaymentEvent(event) {
      return mapSquareWebhookToPaymentEvent(event);
    },
  };
}

export const squareOAuthAdapter: PaymentProviderAdapter = {
  provider: "square",
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

export function getSquareOAuthAdapter(tokenStore: SquareTokenStore): PaymentProviderAdapter {
  const env = getSquareEnv();
  if ("error" in env) {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  }
  return createSquareOAuthAdapter({
    applicationId: env.applicationId,
    applicationSecret: env.applicationSecret,
    environment: env.environment,
    webhookSignatureKey: env.webhookSignatureKey,
    webhookNotificationUrl: env.webhookNotificationUrl,
    client: createSquareFetchClient(squareApiBaseUrl(env.environment)),
    tokenStore,
  });
}

export { isSquareConfigured };
