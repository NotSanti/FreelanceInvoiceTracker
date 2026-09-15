export type PayPalEnvironment = "sandbox" | "production";

export function getPayPalEnv() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const partnerAttributionId = process.env.PAYPAL_PARTNER_ATTRIBUTION_ID?.trim();
  const partnerMerchantId = process.env.PAYPAL_PARTNER_MERCHANT_ID?.trim();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  const environment =
    process.env.PAYPAL_ENVIRONMENT?.trim() === "production" ? "production" : "sandbox";

  if (!clientId || !clientSecret) {
    return { error: "PayPal isn't configured yet." } as const;
  }

  return {
    clientId,
    clientSecret,
    partnerAttributionId,
    partnerMerchantId,
    webhookId,
    environment: environment as PayPalEnvironment,
  } as const;
}

export function isPayPalConfigured() {
  return !("error" in getPayPalEnv());
}

export function paypalApiBaseUrl(environment: PayPalEnvironment) {
  return environment === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}
