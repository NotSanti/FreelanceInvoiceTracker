/** Shared validation limits (keep in sync with SQL check constraints). */

export const LIMITS = {
  name: 200,
  companyName: 200,
  email: 254,
  phone: 40,
  addressLine: 300,
  city: 120,
  province: 120,
  postalCode: 32,
  country: 120,
  notes: 10_000,
  paymentInstructions: 10_000,
  invoiceLineDescription: 1_000,
  taxName: 80,
  paymentReference: 5_000,
  invoiceLineCount: 40,
  moneyMaxCents: 900_719_925_474_0991,
  quantityMax: 1_000_000,
  pushEndpoint: 2048,
  pushP256dh: 512,
  pushAuth: 256,
  pushUserAgent: 512,
  requestBodyBytes: {
    pushSubscribe: 8_192,
    stripeCheckout: 16_384,
  },
} as const;

export function hasControlChars(value: string) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

export function withinLength(value: string, max: number) {
  return value.length <= max;
}
