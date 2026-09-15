import type { ManualPaymentMethod } from "@/config/payments";

export type PaymentProvider = "stripe" | "paypal" | "square";

export const PAYMENT_PROVIDERS = ["stripe", "paypal", "square"] as const;

export type ProviderConnectionStatus =
  | "pending"
  | "connected"
  | "restricted"
  | "disconnected"
  | "error";

export type ProviderCheckoutStatus =
  | "created"
  | "pending"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

export type { ManualPaymentMethod };

export type PaymentProviderConnection = {
  id: string;
  userId: string;
  provider: PaymentProvider;
  providerAccountId: string;
  status: ProviderConnectionStatus;
  displayName: string | null;
  email: string | null;
  country: string | null;
  defaultCurrency: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
};

export type ProviderConnectionResult = {
  providerAccountId: string;
  status: ProviderConnectionStatus;
  displayName?: string | null;
  email?: string | null;
  country?: string | null;
  defaultCurrency?: string | null;
  chargesEnabled?: boolean | null;
  payoutsEnabled?: boolean | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
};

export type CheckoutInvoiceRecord = {
  id: string;
  userId: string;
  invoiceNumber: string;
  status: "draft" | "sent" | "paid" | "void";
  currency: string;
  totalCents: number;
  paidCents: number;
};

export type CheckoutInvoice = {
  id: string;
  userId: string;
  invoiceNumber: string;
  currency: string;
  outstandingCents: number;
};

export type ProviderCheckoutResult = {
  providerCheckoutId: string;
  checkoutUrl: string;
  expiresAt?: string | null;
};

export type ProviderWebhookEvent = {
  provider: PaymentProvider;
  providerEventId: string;
  eventType: string;
  payload: unknown;
};

export type NormalizedPaymentEvent = {
  provider: PaymentProvider;
  providerEventId: string;
  eventType: string;
  providerPaymentId: string;
  providerCheckoutId?: string;
  providerAccountId: string;
  invoiceId?: string;
  amountCents: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;

  getConnectUrl(params: {
    userId: string;
    state: string;
    redirectUri: string;
  }): Promise<string>;

  completeConnection(params: {
    code: string;
    redirectUri: string;
    returnAttributes?: Record<string, string | null>;
  }): Promise<ProviderConnectionResult>;

  refreshConnection?(
    connection: PaymentProviderConnection,
  ): Promise<ProviderConnectionResult>;

  disconnect(connection: PaymentProviderConnection): Promise<void>;

  createCheckout(params: {
    invoice: CheckoutInvoice;
    connection: PaymentProviderConnection;
    checkoutId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<ProviderCheckoutResult>;

  verifyWebhook(request: Request): Promise<ProviderWebhookEvent>;

  processWebhook?(event: ProviderWebhookEvent): Promise<void>;

  mapWebhookToPaymentEvent(
    event: ProviderWebhookEvent,
  ): Promise<NormalizedPaymentEvent | null>;
}

export function isPaymentProvider(value: string): value is PaymentProvider {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

export function isUsableProviderConnection(connection: PaymentProviderConnection) {
  return connection.status === "connected" && connection.chargesEnabled !== false;
}
