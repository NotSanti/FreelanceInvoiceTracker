export const PAYMENT_ERROR_CODES = [
  "PAYMENT_PROVIDER_INVALID",
  "PAYMENT_PROVIDER_DISABLED",
  "PAYMENT_PROVIDER_NOT_IMPLEMENTED",
  "PAYMENT_OWNER_MISMATCH",
  "PAYMENT_CONNECTION_UNUSABLE",
  "PAYMENT_INVOICE_NOT_FOUND",
  "PAYMENT_INVOICE_NOT_PAYABLE",
  "PAYMENT_METHOD_NOT_ENABLED",
  "PAYMENT_CHECKOUT_RATE_LIMITED",
  "PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED",
  "PAYMENT_RECONCILE_REJECTED",
  "PAYMENT_WEBHOOK_INVALID",
  "PAYMENT_OAUTH_STATE_INVALID",
  "PAYMENT_CRYPTO_TAMPERED",
  "PAYMENT_CRYPTO_KEY_INVALID",
] as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[number];

export const CLIENT_PAYMENT_UNAVAILABLE =
  "This payment method is temporarily unavailable. Choose another payment method or contact the invoice issuer.";

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;

  constructor(code: PaymentErrorCode, message = CLIENT_PAYMENT_UNAVAILABLE) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
  }
}

export function isPaymentError(error: unknown): error is PaymentError {
  return error instanceof PaymentError;
}
