import "server-only";

import { requireUser } from "@/lib/auth/session";
import {
  listPaymentProviderCards,
  type PaymentConnectionSummary,
} from "@/lib/payments/connection-status";
import {
  getPaymentProviderEnv,
  isPaymentProviderConnectReady,
} from "@/lib/payments/provider-setup";
import type { PaymentProvider } from "@/lib/payments/types";

export async function getSettingsPaymentProviderCards() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("payment_provider_connections")
    .select("provider, status, display_name, email")
    .eq("user_id", user.id);

  if (error) {
    throw new Error("We could not load payment connections.");
  }

  const connections = {} as Partial<Record<PaymentProvider, PaymentConnectionSummary>>;
  for (const row of data ?? []) {
    connections[row.provider] = {
      status: row.status,
      displayName: row.display_name,
      email: row.email,
    };
  }

  const env = getPaymentProviderEnv();
  return listPaymentProviderCards({
    connections,
    isConnectReady: (provider) => isPaymentProviderConnectReady(provider, env),
  });
}
