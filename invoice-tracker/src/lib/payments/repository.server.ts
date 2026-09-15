import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  decryptPaymentToken,
  encryptPaymentToken,
} from "@/lib/payments/crypto.server";
import { syncInvoicePaidStateFromDatabase } from "@/lib/payments/sync";
import type {
  CheckoutInvoiceRecord,
  PaymentProvider,
  PaymentProviderConnection,
  ProviderCheckoutResult,
  ProviderConnectionResult,
} from "@/lib/payments/types";
import type { PaymentOAuthStateRecord, PaymentOAuthStateStore } from "@/lib/payments/oauth-state.server";

function mapConnection(
  row: {
    id: string;
    user_id: string;
    provider: PaymentProvider;
    provider_account_id: string;
    status: PaymentProviderConnection["status"];
    display_name: string | null;
    email: string | null;
    country: string | null;
    default_currency: string | null;
    charges_enabled: boolean | null;
    payouts_enabled: boolean | null;
  },
): PaymentProviderConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    status: row.status,
    displayName: row.display_name,
    email: row.email,
    country: row.country,
    defaultCurrency: row.default_currency,
    chargesEnabled: row.charges_enabled,
    payoutsEnabled: row.payouts_enabled,
  };
}

async function syncPaidStateAfterProviderPayment(invoiceId: string, userId: string) {
  const synced = await syncInvoicePaidStateFromDatabase({
    supabase: createServiceClient(),
    invoiceId,
    userId,
  });
  if (synced.error) {
    throw new Error("Payment could not be stored.");
  }
}

export function createSupabaseOAuthStateStore(): PaymentOAuthStateStore {
  return {
    async insert(record) {
      const supabase = createServiceClient();
      const { error } = await supabase.from("payment_oauth_states").insert({
        hashed_state: record.hashedState,
        user_id: record.userId,
        provider: record.provider,
        return_path: record.returnPath,
        expires_at: record.expiresAt,
      });
      if (error) {
        throw new Error("OAuth state could not be stored.");
      }
    },
    async findByHashedState(hashedState) {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("payment_oauth_states")
        .select("hashed_state, user_id, provider, return_path, expires_at, consumed_at")
        .eq("hashed_state", hashedState)
        .maybeSingle();
      if (error || !data) {
        return null;
      }
      return {
        hashedState: data.hashed_state,
        userId: data.user_id,
        provider: data.provider,
        returnPath: data.return_path,
        expiresAt: data.expires_at,
        consumedAt: data.consumed_at,
      } satisfies PaymentOAuthStateRecord;
    },
    async markConsumed(hashedState, consumedAt) {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("payment_oauth_states")
        .update({ consumed_at: consumedAt })
        .eq("hashed_state", hashedState)
        .is("consumed_at", null)
        .select("hashed_state");
      return !error && (data?.length ?? 0) > 0;
    },
  };
}

export async function markProviderConnectionDisconnected(
  userId: string,
  provider: PaymentProvider,
) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("payment_provider_connections")
    .update({
      status: "disconnected",
      disconnected_at: now,
    })
    .eq("user_id", userId)
    .eq("provider", provider)
    .neq("status", "disconnected")
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error("We couldn't disconnect that payment method.");
  }
  if (!data?.id) {
    return;
  }
  const { error: secretError } = await supabase
    .from("payment_provider_connection_secrets")
    .delete()
    .eq("connection_id", data.id);
  if (secretError) {
    throw new Error("We couldn't disconnect that payment method.");
  }
}

export async function getProviderConnection(userId: string, provider: PaymentProvider) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("payment_provider_connections")
    .select(
      "id, user_id, provider, provider_account_id, status, display_name, email, country, default_currency, charges_enabled, payouts_enabled",
    )
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return mapConnection(data);
}

export async function isInvoiceProviderEnabled(
  invoiceId: string,
  userId: string,
  provider: PaymentProvider,
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("invoice_payment_methods")
    .select("enabled")
    .eq("invoice_id", invoiceId)
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (!error && data?.enabled === true) {
    return true;
  }
  if (!error && !data) {
    return true;
  }
  return false;
}

export async function insertPaymentCheckout(row: {
  userId: string;
  invoiceId: string;
  provider: PaymentProvider;
  providerConnectionId: string;
  amountCents: number;
  currency: string;
}) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("payment_checkouts")
    .insert({
      user_id: row.userId,
      invoice_id: row.invoiceId,
      provider: row.provider,
      provider_connection_id: row.providerConnectionId,
      amount_cents: row.amountCents,
      currency: row.currency,
      status: "created",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error("Checkout could not be stored.");
  }
  return { id: data.id };
}

export async function savePaymentCheckoutProviderDetails(
  checkoutId: string,
  details: ProviderCheckoutResult,
) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("payment_checkouts")
    .update({
      provider_checkout_id: details.providerCheckoutId,
      checkout_url: details.checkoutUrl,
      expires_at: details.expiresAt ?? null,
      status: "pending",
    })
    .eq("id", checkoutId);
  if (error) {
    throw new Error("Checkout could not be updated.");
  }
}

export async function getCheckoutInvoiceByPublicToken(
  publicToken: string,
): Promise<CheckoutInvoiceRecord | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_invoice_checkout_state", {
    p_token: publicToken,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const row = data as Record<string, unknown>;
  if (typeof row.invoice_id !== "string" || typeof row.user_id !== "string") {
    return null;
  }
  const status = row.status === "paid" ? "paid" : "sent";
  return {
    id: row.invoice_id,
    userId: row.user_id,
    invoiceNumber: String(row.invoice_number ?? ""),
    status,
    currency: String(row.currency),
    totalCents: Number(row.total_cents),
    paidCents: Number(row.paid_cents ?? 0),
  };
}

export async function upsertProviderConnection(
  userId: string,
  provider: PaymentProvider,
  result: ProviderConnectionResult,
) {
  const supabase = createServiceClient();
  const { data: existingAccount, error: accountError } = await supabase
    .from("payment_provider_connections")
    .select("id, user_id")
    .eq("provider", provider)
    .eq("provider_account_id", result.providerAccountId)
    .maybeSingle();
  if (accountError) {
    throw new Error("Payment connection could not be saved.");
  }
  if (existingAccount && existingAccount.user_id !== userId) {
    throw new Error("That payment account is already connected to another workspace.");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("payment_provider_connections")
    .upsert(
      {
        user_id: userId,
        provider,
        provider_account_id: result.providerAccountId,
        status: result.status,
        display_name: result.displayName ?? null,
        email: result.email ?? null,
        country: result.country ?? null,
        default_currency: result.defaultCurrency ?? null,
        charges_enabled: result.chargesEnabled ?? null,
        payouts_enabled: result.payoutsEnabled ?? null,
        connected_at: result.status === "connected" ? now : null,
        disconnected_at: null,
      },
      { onConflict: "user_id,provider" },
    )
    .select("id, user_id, provider, provider_account_id, status, display_name, email, country, default_currency, charges_enabled, payouts_enabled")
    .single();
  if (error || !data) {
    throw new Error("Payment connection could not be saved.");
  }
  if (result.accessToken) {
    await upsertProviderConnectionSecrets(data.id, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? null,
      tokenExpiresAt: result.tokenExpiresAt ?? null,
    });
  }
  return mapConnection(data);
}

export async function getProviderConnectionSecrets(connectionId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("payment_provider_connection_secrets")
    .select("access_token_ciphertext, refresh_token_ciphertext, token_expires_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error || !data?.access_token_ciphertext) {
    return null;
  }
  return {
    accessToken: decryptPaymentToken(data.access_token_ciphertext),
    refreshToken: data.refresh_token_ciphertext
      ? decryptPaymentToken(data.refresh_token_ciphertext)
      : null,
    tokenExpiresAt: data.token_expires_at,
  };
}

export async function upsertProviderConnectionSecrets(
  connectionId: string,
  tokens: {
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiresAt?: string | null;
  },
) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("payment_provider_connection_secrets").upsert(
    {
      connection_id: connectionId,
      access_token_ciphertext: encryptPaymentToken(tokens.accessToken),
      refresh_token_ciphertext: tokens.refreshToken
        ? encryptPaymentToken(tokens.refreshToken)
        : null,
      token_expires_at: tokens.tokenExpiresAt ?? null,
    },
    { onConflict: "connection_id" },
  );
  if (error) {
    throw new Error("Payment connection could not be saved.");
  }
}

export function createSupabaseSquareTokenStore() {
  return {
    getSecrets: getProviderConnectionSecrets,
    saveSecrets: upsertProviderConnectionSecrets,
  };
}

export async function updateProviderConnectionByAccountId(
  provider: PaymentProvider,
  providerAccountId: string,
  result: ProviderConnectionResult,
) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("payment_provider_connections")
    .update({
      status: result.status,
      display_name: result.displayName ?? null,
      email: result.email ?? null,
      country: result.country ?? null,
      default_currency: result.defaultCurrency ?? null,
      charges_enabled: result.chargesEnabled ?? null,
      payouts_enabled: result.payoutsEnabled ?? null,
      connected_at: result.status === "connected" ? now : undefined,
      disconnected_at: result.status === "disconnected" ? now : null,
    })
    .eq("provider", provider)
    .eq("provider_account_id", providerAccountId)
    .neq("status", "disconnected");
  if (error) {
    throw new Error("Payment connection could not be updated.");
  }
}

export async function disconnectByProviderAccountId(
  provider: PaymentProvider,
  providerAccountId: string,
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("payment_provider_connections")
    .select("id, user_id")
    .eq("provider", provider)
    .eq("provider_account_id", providerAccountId)
    .neq("status", "disconnected")
    .maybeSingle();
  if (error || !data) {
    return;
  }
  await markProviderConnectionDisconnected(data.user_id, provider);
}

export function createSupabaseCheckoutStore() {
  return {
    getInvoiceByPublicToken: getCheckoutInvoiceByPublicToken,
    getConnection: getProviderConnection,
    isProviderEnabledOnInvoice: isInvoiceProviderEnabled,
    insertCheckout: insertPaymentCheckout,
    saveProviderCheckoutDetails: savePaymentCheckoutProviderDetails,
  };
}

export function createSupabaseReconcileStore() {
  return {
    async findWebhookEvent(provider: PaymentProvider, providerEventId: string) {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("payment_webhook_events")
        .select("id")
        .eq("provider", provider)
        .eq("provider_event_id", providerEventId)
        .maybeSingle();
      if (error || !data) {
        return null;
      }
      return { id: data.id };
    },
    async insertWebhookEvent(event: {
      provider: PaymentProvider;
      providerEventId: string;
      eventType: string;
      providerAccountId: string;
    }) {
      const supabase = createServiceClient();
      const { error } = await supabase.from("payment_webhook_events").insert({
        provider: event.provider,
        provider_event_id: event.providerEventId,
        event_type: event.eventType,
        provider_account_id: event.providerAccountId,
        processing_status: "received",
      });
      if (error) {
        if (error.code === "23505") {
          return "duplicate" as const;
        }
        throw new Error("Webhook event could not be stored.");
      }
      return "inserted" as const;
    },
    async markWebhookProcessed(provider: PaymentProvider, providerEventId: string) {
      const supabase = createServiceClient();
      await supabase
        .from("payment_webhook_events")
        .update({
          processing_status: "processed",
          processed_at: new Date().toISOString(),
        })
        .eq("provider", provider)
        .eq("provider_event_id", providerEventId);
    },
    async findCheckout(params: {
      provider: PaymentProvider;
      providerCheckoutId?: string;
      invoiceId?: string;
    }) {
      const supabase = createServiceClient();
      let query = supabase
        .from("payment_checkouts")
        .select(
          "id, user_id, invoice_id, provider, provider_connection_id, provider_checkout_id, amount_cents, currency, status",
        )
        .eq("provider", params.provider);
      if (params.providerCheckoutId) {
        query = query.eq("provider_checkout_id", params.providerCheckoutId);
      } else if (params.invoiceId) {
        query = query.eq("invoice_id", params.invoiceId).order("created_at", { ascending: false }).limit(1);
      } else {
        return null;
      }
      const { data, error } = await query.maybeSingle();
      if (error || !data) {
        return null;
      }
      return {
        id: data.id,
        userId: data.user_id,
        invoiceId: data.invoice_id,
        provider: data.provider,
        providerConnectionId: data.provider_connection_id,
        providerCheckoutId: data.provider_checkout_id,
        amountCents: Number(data.amount_cents),
        currency: data.currency,
        status: data.status,
      };
    },
    async getConnectionById(id: string) {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("payment_provider_connections")
        .select(
          "id, user_id, provider, provider_account_id, status, display_name, email, country, default_currency, charges_enabled, payouts_enabled",
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        return null;
      }
      return mapConnection(data);
    },
    async findPayment(provider: PaymentProvider, providerPaymentId: string) {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("payments")
        .select("id")
        .eq("provider", provider)
        .eq("provider_payment_id", providerPaymentId)
        .maybeSingle();
      if (error || !data) {
        return null;
      }
      return { id: data.id };
    },
    async insertPayment(row: {
      userId: string;
      invoiceId: string;
      amountCents: number;
      currency: string;
      provider: PaymentProvider;
      providerPaymentId: string;
      providerCheckoutId: string | null;
      providerAccountId: string;
      paidOn: string;
    }) {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("payments")
        .insert({
          user_id: row.userId,
          invoice_id: row.invoiceId,
          amount_cents: row.amountCents,
          currency: row.currency,
          method:
            row.provider === "stripe" || row.provider === "square" || row.provider === "paypal"
              ? row.provider
              : "other",
          paid_on: row.paidOn,
          provider: row.provider,
          provider_payment_id: row.providerPaymentId,
          provider_checkout_id: row.providerCheckoutId,
          provider_account_id: row.providerAccountId,
          stripe_checkout_session_id:
            row.provider === "stripe" ? row.providerCheckoutId : null,
          stripe_payment_intent_id:
            row.provider === "stripe" ? row.providerPaymentId : null,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          await syncPaidStateAfterProviderPayment(row.invoiceId, row.userId);
          return "duplicate" as const;
        }
        throw new Error("Payment could not be stored.");
      }
      await syncPaidStateAfterProviderPayment(row.invoiceId, row.userId);
      return { id: data.id };
    },
    async updateCheckoutStatus(
      checkoutId: string,
      status: "created" | "pending" | "completed" | "failed" | "expired" | "cancelled",
    ) {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("payment_checkouts")
        .update({ status })
        .eq("id", checkoutId);
      if (error) {
        throw new Error("Checkout could not be updated.");
      }
    },
  };
}
