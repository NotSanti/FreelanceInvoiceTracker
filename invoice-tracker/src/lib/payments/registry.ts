import { PaymentError } from "@/lib/payments/errors";
import type { PaymentProvider, PaymentProviderAdapter } from "@/lib/payments/types";
import { isPaymentProvider } from "@/lib/payments/types";

function envFlag(name: string, defaultValue: boolean) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return defaultValue;
  }
  if (raw === "1" || raw === "true" || raw === "yes") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no") {
    return false;
  }
  return defaultValue;
}

export function isPaymentProviderEnabled(provider: PaymentProvider) {
  if (provider === "stripe") {
    return envFlag("PAYMENTS_STRIPE_ENABLED", true);
  }
  if (provider === "square") {
    return envFlag("PAYMENTS_SQUARE_ENABLED", true);
  }
  return envFlag("PAYMENTS_PAYPAL_ENABLED", false);
}

export type PaymentProviderRegistry = {
  get(provider: string): PaymentProviderAdapter;
  has(provider: PaymentProvider): boolean;
};

export function createPaymentProviderRegistry(
  adapters: PaymentProviderAdapter[],
  isEnabled: (provider: PaymentProvider) => boolean = isPaymentProviderEnabled,
): PaymentProviderRegistry {
  const byProvider = new Map<PaymentProvider, PaymentProviderAdapter>();
  for (const adapter of adapters) {
    byProvider.set(adapter.provider, adapter);
  }

  return {
    has(provider) {
      return byProvider.has(provider);
    },
    get(provider: string) {
      if (!isPaymentProvider(provider)) {
        throw new PaymentError("PAYMENT_PROVIDER_INVALID");
      }
      if (!isEnabled(provider)) {
        throw new PaymentError("PAYMENT_PROVIDER_DISABLED");
      }
      const adapter = byProvider.get(provider);
      if (!adapter) {
        throw new PaymentError("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
      }
      return adapter;
    },
  };
}
