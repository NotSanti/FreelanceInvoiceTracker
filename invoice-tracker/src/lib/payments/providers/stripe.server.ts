import "server-only";

import type Stripe from "stripe";

import { PaymentError } from "@/lib/payments/errors";
import type {
  PaymentProviderAdapter,
  ProviderConnectionResult,
  ProviderWebhookEvent,
} from "@/lib/payments/types";
import { getStripe } from "@/lib/stripe/client";
import { getStripeEnv } from "@/lib/stripe/env";

export type StripeConnectClient = {
  oauth: {
    authorizeUrl(params: {
      client_id?: string;
      response_type?: "code";
      scope?: string;
      redirect_uri?: string;
      state?: string;
      stripe_user?: { email?: string; business_name?: string };
    }): string;
    token(params: {
      grant_type: "authorization_code";
      code?: string;
    }): Promise<{ stripe_user_id?: string }>;
    deauthorize(params: {
      client_id?: string;
      stripe_user_id?: string;
    }): Promise<unknown>;
  };
  accounts: {
    retrieve(id: string): Promise<Stripe.Account>;
  };
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
        options: { stripeAccount: string; idempotencyKey?: string },
      ): Promise<Stripe.Checkout.Session>;
    };
  };
  webhooks: {
    constructEvent(payload: string, signature: string, secret: string): Stripe.Event;
  };
};

function statusFromAccount(account: Stripe.Account): ProviderConnectionResult["status"] {
  if (account.charges_enabled) {
    return "connected";
  }
  if (account.requirements?.disabled_reason) {
    return "restricted";
  }
  return "pending";
}

function connectionFromAccount(account: Stripe.Account): ProviderConnectionResult {
  return {
    providerAccountId: account.id,
    status: statusFromAccount(account),
    displayName: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
    email: account.email ?? null,
    country: account.country ?? null,
    defaultCurrency: account.default_currency?.toUpperCase() ?? null,
    chargesEnabled: account.charges_enabled ?? null,
    payoutsEnabled: account.payouts_enabled ?? null,
  };
}

function sessionPaymentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string" && session.payment_intent) {
    return session.payment_intent;
  }
  if (session.payment_intent && typeof session.payment_intent === "object") {
    return session.payment_intent.id;
  }
  return session.id;
}

export function createStripeConnectAdapter(deps: {
  stripe: StripeConnectClient;
  connectClientId: string;
  webhookSecret?: string;
}): PaymentProviderAdapter {
  return {
    provider: "stripe",
    async getConnectUrl(params) {
      return deps.stripe.oauth.authorizeUrl({
        client_id: deps.connectClientId,
        response_type: "code",
        scope: "read_write",
        redirect_uri: params.redirectUri,
        state: params.state,
      });
    },
    async completeConnection(params) {
      const token = await deps.stripe.oauth.token({
        grant_type: "authorization_code",
        code: params.code,
      });
      if (!token.stripe_user_id) {
        throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
      }
      const account = await deps.stripe.accounts.retrieve(token.stripe_user_id);
      return connectionFromAccount(account);
    },
    async refreshConnection(connection) {
      const account = await deps.stripe.accounts.retrieve(connection.providerAccountId);
      return connectionFromAccount(account);
    },
    async disconnect(connection) {
      await deps.stripe.oauth.deauthorize({
        client_id: deps.connectClientId,
        stripe_user_id: connection.providerAccountId,
      });
    },
    async createCheckout(params) {
      const session = await deps.stripe.checkout.sessions.create(
        {
          mode: "payment",
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          client_reference_id: params.invoice.id,
          metadata: {
            independentpocket_invoice_id: params.invoice.id,
            independentpocket_checkout_id: params.checkoutId,
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: params.invoice.currency.toLowerCase(),
                unit_amount: params.invoice.outstandingCents,
                product_data: {
                  name: `Invoice ${params.invoice.invoiceNumber}`,
                },
              },
            },
          ],
        },
        {
          stripeAccount: params.connection.providerAccountId,
          idempotencyKey: `independentpocket-checkout:${params.checkoutId}`,
        },
      );
      if (!session.url) {
        throw new PaymentError("PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED");
      }
      return {
        providerCheckoutId: session.id,
        checkoutUrl: session.url,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
      };
    },
    async verifyWebhook(request) {
      if (!deps.webhookSecret) {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
      const rawBody = await request.text();
      try {
        const event = deps.stripe.webhooks.constructEvent(
          rawBody,
          signature,
          deps.webhookSecret,
        );
        return {
          provider: "stripe",
          providerEventId: event.id,
          eventType: event.type,
          payload: event,
        };
      } catch (error) {
        if (error instanceof PaymentError) {
          throw error;
        }
        throw new PaymentError("PAYMENT_WEBHOOK_INVALID");
      }
    },
    async mapWebhookToPaymentEvent(event) {
      return mapStripeWebhookToPaymentEvent(event);
    },
  };
}

export function mapStripeWebhookToPaymentEvent(event: ProviderWebhookEvent) {
  const stripeEvent = event.payload as Stripe.Event | null;
  if (!stripeEvent || typeof stripeEvent !== "object") {
    return null;
  }
  const connectedAccount =
    typeof stripeEvent.account === "string" ? stripeEvent.account : null;
  if (!connectedAccount) {
    return null;
  }

  const type = stripeEvent.type;
  if (
    type !== "checkout.session.completed" &&
    type !== "checkout.session.async_payment_succeeded" &&
    type !== "checkout.session.async_payment_failed" &&
    type !== "checkout.session.expired"
  ) {
    return null;
  }

  const session = stripeEvent.data.object as Stripe.Checkout.Session;
  if (session.mode && session.mode !== "payment") {
    return null;
  }

  const invoiceId = session.metadata?.independentpocket_invoice_id;
  const amountCents = session.amount_total;
  const currency = session.currency;
  if (!amountCents || !currency) {
    return null;
  }

  let status: "pending" | "completed" | "failed" = "pending";
  if (type === "checkout.session.expired" || type === "checkout.session.async_payment_failed") {
    status = "failed";
  } else if (
    type === "checkout.session.async_payment_succeeded" ||
    session.payment_status === "paid"
  ) {
    status = "completed";
  }

  return {
    provider: "stripe" as const,
    providerEventId: stripeEvent.id,
    eventType: type,
    providerPaymentId: sessionPaymentId(session),
    providerCheckoutId: session.id,
    providerAccountId: connectedAccount,
    invoiceId: invoiceId || undefined,
    amountCents,
    currency: currency.toUpperCase(),
    status,
    occurredAt: new Date((stripeEvent.created || Date.now() / 1000) * 1000).toISOString(),
  };
}

export function stripeAccountFromWebhook(
  event: ProviderWebhookEvent,
): { kind: "updated"; account: Stripe.Account } | { kind: "deauthorized"; accountId: string } | null {
  const stripeEvent = event.payload as Stripe.Event | null;
  if (!stripeEvent || typeof stripeEvent !== "object") {
    return null;
  }
  if (stripeEvent.type === "account.updated") {
    return { kind: "updated", account: stripeEvent.data.object as Stripe.Account };
  }
  if (stripeEvent.type === "account.application.deauthorized") {
    const accountId = typeof stripeEvent.account === "string" ? stripeEvent.account : null;
    if (!accountId) {
      return null;
    }
    return { kind: "deauthorized", accountId };
  }
  return null;
}

export function stripeConnectionFromAccount(account: Stripe.Account): ProviderConnectionResult {
  return connectionFromAccount(account);
}

export function getStripeConnectAdapter(): PaymentProviderAdapter {
  const env = getStripeEnv();
  const stripe = getStripe();
  if (!stripe || "error" in env || !env.connectClientId) {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  }
  return createStripeConnectAdapter({
    stripe: stripe as StripeConnectClient,
    connectClientId: env.connectClientId,
    webhookSecret: env.webhookSecret,
  });
}

export function isStripeConnectConfigured() {
  const env = getStripeEnv();
  return !("error" in env) && Boolean(env.connectClientId);
}
