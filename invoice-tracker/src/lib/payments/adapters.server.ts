import "server-only";

import {
  getPayPalPlatformAdapter,
  isPayPalConfigured,
  paypalPlatformAdapter,
} from "@/lib/payments/providers/paypal.server";
import {
  getSquareOAuthAdapter,
  isSquareConfigured,
  squareOAuthAdapter,
} from "@/lib/payments/providers/square.server";
import {
  getStripeConnectAdapter,
  isStripeConnectConfigured,
} from "@/lib/payments/providers/stripe.server";
import { createSupabaseSquareTokenStore } from "@/lib/payments/repository.server";
import { createPaymentProviderRegistry } from "@/lib/payments/registry";

export function createLivePaymentProviderRegistry() {
  const adapters = [
    isPayPalConfigured() ? getPayPalPlatformAdapter() : paypalPlatformAdapter,
    isSquareConfigured() ? getSquareOAuthAdapter(createSupabaseSquareTokenStore()) : squareOAuthAdapter,
  ];
  if (isStripeConnectConfigured()) {
    adapters.unshift(getStripeConnectAdapter());
  }
  return createPaymentProviderRegistry(adapters);
}
