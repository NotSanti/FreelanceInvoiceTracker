import "server-only";

import { getAppUrl } from "@/lib/app-url";
import { PaymentError } from "@/lib/payments/errors";
import {
  consumeOAuthState,
  issueOAuthState,
  sanitizeOAuthReturnPath,
} from "@/lib/payments/oauth-state.server";
import { createLivePaymentProviderRegistry } from "@/lib/payments/adapters.server";
import {
  createSupabaseOAuthStateStore,
  getProviderConnection,
  upsertProviderConnection,
} from "@/lib/payments/repository.server";
import { isPaymentProvider } from "@/lib/payments/types";
import { isPaymentProviderConnectReady, getPaymentProviderEnv } from "@/lib/payments/provider-setup";

export function paymentProviderCallbackUrl(provider: string, appUrl = getAppUrl()) {
  return `${appUrl}/api/payments/callback/${provider}`;
}

export async function startPaymentProviderConnect(input: {
  userId: string;
  provider: string;
  returnPath?: string | null;
}) {
  if (!isPaymentProvider(input.provider)) {
    throw new PaymentError("PAYMENT_PROVIDER_INVALID");
  }
  if (!isPaymentProviderConnectReady(input.provider, getPaymentProviderEnv())) {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  }

  const registry = createLivePaymentProviderRegistry();
  const adapter = registry.get(input.provider);
  const rawState = await issueOAuthState(createSupabaseOAuthStateStore(), {
    userId: input.userId,
    provider: input.provider,
    returnPath: sanitizeOAuthReturnPath(input.returnPath) ?? "/settings",
  });

  return adapter.getConnectUrl({
    userId: input.userId,
    state: rawState,
    redirectUri: paymentProviderCallbackUrl(input.provider),
  });
}

export async function completePaymentProviderConnect(input: {
  provider: string;
  code: string | null;
  state: string | null;
  error?: string | null;
  returnAttributes?: Record<string, string | null>;
}) {
  if (input.error === "access_denied") {
    return { returnPath: "/settings", denied: true as const };
  }
  if (!input.code || !input.state) {
    throw new PaymentError("PAYMENT_OAUTH_STATE_INVALID");
  }

  const consumed = await consumeOAuthState(createSupabaseOAuthStateStore(), {
    rawState: input.state,
    provider: input.provider,
  });
  const registry = createLivePaymentProviderRegistry();
  const adapter = registry.get(consumed.provider);
  const result = await adapter.completeConnection({
    code: input.code,
    redirectUri: paymentProviderCallbackUrl(consumed.provider),
    returnAttributes: input.returnAttributes,
  });
  await upsertProviderConnection(consumed.userId, consumed.provider, result);
  return {
    returnPath: consumed.returnPath || "/settings",
    denied: false as const,
  };
}

export async function disconnectLiveProvider(
  userId: string,
  provider: Parameters<typeof getProviderConnection>[1],
) {
  const connection = await getProviderConnection(userId, provider);
  if (connection) {
    try {
      const registry = createLivePaymentProviderRegistry();
      await registry.get(provider).disconnect(connection);
    } catch {
      // Local disconnect still proceeds if the provider already revoked access.
    }
  }
}
