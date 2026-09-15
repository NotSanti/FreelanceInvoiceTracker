"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { disconnectLiveProvider } from "@/lib/payments/connect.server";
import { createLivePaymentProviderRegistry } from "@/lib/payments/adapters.server";
import { getProviderConnection, markProviderConnectionDisconnected, upsertProviderConnection } from "@/lib/payments/repository.server";
import { isPaymentProvider, PAYMENT_PROVIDERS } from "@/lib/payments/types";

export type PaymentConnectionActionState = {
  error?: string;
};

export async function refreshPaymentConnections() {
  const { user } = await requireUser();
  const registry = createLivePaymentProviderRegistry();
  for (const provider of PAYMENT_PROVIDERS) {
    const connection = await getProviderConnection(user.id, provider);
    if (!connection || connection.status === "disconnected") {
      continue;
    }
    try {
      const adapter = registry.get(provider);
      if (adapter.refreshConnection) {
        const result = await adapter.refreshConnection(connection);
        await upsertProviderConnection(user.id, provider, result);
      }
    } catch {
      // Keep last-known connection state if the provider is unreachable.
    }
  }
  revalidatePath("/settings");
}

export async function disconnectPaymentProvider(
  _previous: PaymentConnectionActionState,
  formData: FormData,
): Promise<PaymentConnectionActionState> {
  const { user } = await requireUser();
  const provider = String(formData.get("provider") ?? "");
  if (!isPaymentProvider(provider)) {
    return { error: "That payment method is not available." };
  }

  try {
    await disconnectLiveProvider(user.id, provider);
    await markProviderConnectionDisconnected(user.id, provider);
  } catch {
    return { error: "We couldn't disconnect that payment method." };
  }

  revalidatePath("/settings");
  return {};
}
