import Stripe from "stripe";

import { getStripeEnv } from "@/lib/stripe/env";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const env = getStripeEnv();
  if ("error" in env) {
    return null;
  }

  stripeClient ??= new Stripe(env.secretKey);
  return stripeClient;
}
