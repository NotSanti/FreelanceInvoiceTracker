import { isPaymentProviderEnabled } from "@/lib/payments/registry";
import type { PaymentProvider } from "@/lib/payments/types";

export type PaymentProviderEnv = {
  stripeSecretKey?: string;
  stripeConnectClientId?: string;
  squareApplicationId?: string;
  squareApplicationSecret?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
};

const LIVE_PAYMENT_ADAPTERS = new Set<PaymentProvider>(["stripe", "square", "paypal"]);

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

export function isPaymentProviderAdapterLive(provider: PaymentProvider) {
  return LIVE_PAYMENT_ADAPTERS.has(provider);
}

export function isPaymentProviderConnectReady(
  provider: PaymentProvider,
  env: PaymentProviderEnv,
  options: {
    isEnabled?: (provider: PaymentProvider) => boolean;
    isAdapterLive?: (provider: PaymentProvider) => boolean;
  } = {},
) {
  const isEnabled = options.isEnabled ?? isPaymentProviderEnabled;
  const isAdapterLive = options.isAdapterLive ?? isPaymentProviderAdapterLive;
  if (!isEnabled(provider) || !isAdapterLive(provider)) {
    return false;
  }
  if (provider === "stripe") {
    return present(env.stripeSecretKey) && present(env.stripeConnectClientId);
  }
  if (provider === "square") {
    return present(env.squareApplicationId) && present(env.squareApplicationSecret);
  }
  return present(env.paypalClientId) && present(env.paypalClientSecret);
}

export function getPaymentProviderEnv(): PaymentProviderEnv {
  return {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeConnectClientId: process.env.STRIPE_CONNECT_CLIENT_ID,
    squareApplicationId: process.env.SQUARE_APPLICATION_ID,
    squareApplicationSecret: process.env.SQUARE_APPLICATION_SECRET,
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET,
  };
}
