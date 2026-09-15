import "server-only";

import { PaymentError } from "@/lib/payments/errors";
import type { PaymentProviderRegistry } from "@/lib/payments/registry";
import { reconcilePaymentEvent, type ReconcileStore } from "@/lib/payments/reconcile.server";
import { isPaymentProvider } from "@/lib/payments/types";

export async function handleProviderWebhook(
  provider: string,
  request: Request,
  deps: {
    registry: PaymentProviderRegistry;
    store: ReconcileStore;
  },
) {
  if (!isPaymentProvider(provider)) {
    throw new PaymentError("PAYMENT_PROVIDER_INVALID");
  }

  const adapter = deps.registry.get(provider);
  const event = await adapter.verifyWebhook(request);
  const normalized = await adapter.mapWebhookToPaymentEvent(event);
  if (!normalized) {
    return { ignored: true as const };
  }

  return reconcilePaymentEvent(normalized, deps.store);
}
