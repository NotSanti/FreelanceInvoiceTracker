import { getAppUrl } from "@/lib/app-url";

export type SquareEnvironment = "sandbox" | "production";

export function getSquareEnv() {
  const applicationId = process.env.SQUARE_APPLICATION_ID?.trim();
  const applicationSecret = process.env.SQUARE_APPLICATION_SECRET?.trim();
  const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  const environment =
    process.env.SQUARE_ENVIRONMENT?.trim() === "production" ? "production" : "sandbox";
  const webhookNotificationUrl =
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim() ||
    `${getAppUrl()}/api/payments/webhooks/square`;

  if (!applicationId || !applicationSecret) {
    return { error: "Square isn't configured yet." } as const;
  }

  return {
    applicationId,
    applicationSecret,
    webhookSignatureKey,
    environment: environment as SquareEnvironment,
    webhookNotificationUrl,
  } as const;
}

export function isSquareConfigured() {
  return !("error" in getSquareEnv());
}

export function squareApiBaseUrl(environment: SquareEnvironment) {
  return environment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}
