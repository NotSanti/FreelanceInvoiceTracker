import { STRIPE_CHECKOUT_ENABLED } from "@/config/payments";

export function getStripeEnv() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const connectClientId = process.env.STRIPE_CONNECT_CLIENT_ID?.trim();

  if (!secretKey) {
    return { error: "Stripe isn't configured yet." } as const;
  }

  return { secretKey, webhookSecret, publishableKey, connectClientId } as const;
}

export function isStripeConfigured() {
  return !("error" in getStripeEnv());
}

export function isStripeTestMode() {
  const env = getStripeEnv();
  if ("error" in env) {
    return false;
  }
  return env.secretKey.startsWith("sk_test_");
}

export function isStripeCheckoutOffered() {
  return STRIPE_CHECKOUT_ENABLED && isStripeConfigured();
}
