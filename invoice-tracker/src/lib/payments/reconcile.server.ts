import "server-only";

import { PaymentError } from "@/lib/payments/errors";
import type {
  NormalizedPaymentEvent,
  PaymentProvider,
  PaymentProviderConnection,
  ProviderCheckoutStatus,
} from "@/lib/payments/types";

export type ReconcileCheckoutRecord = {
  id: string;
  userId: string;
  invoiceId: string;
  provider: PaymentProvider;
  providerConnectionId: string;
  providerCheckoutId: string | null;
  amountCents: number;
  currency: string;
  status: ProviderCheckoutStatus;
};

export type ReconcileStore = {
  findWebhookEvent(
    provider: PaymentProvider,
    providerEventId: string,
  ): Promise<{ id: string } | null>;
  insertWebhookEvent(event: {
    provider: PaymentProvider;
    providerEventId: string;
    eventType: string;
    providerAccountId: string;
  }): Promise<"inserted" | "duplicate">;
  markWebhookProcessed(provider: PaymentProvider, providerEventId: string): Promise<void>;
  findCheckout(params: {
    provider: PaymentProvider;
    providerCheckoutId?: string;
    invoiceId?: string;
  }): Promise<ReconcileCheckoutRecord | null>;
  getConnectionById(id: string): Promise<PaymentProviderConnection | null>;
  findPayment(
    provider: PaymentProvider,
    providerPaymentId: string,
  ): Promise<{ id: string } | null>;
  insertPayment(row: {
    userId: string;
    invoiceId: string;
    amountCents: number;
    currency: string;
    provider: PaymentProvider;
    providerPaymentId: string;
    providerCheckoutId: string | null;
    providerAccountId: string;
    paidOn: string;
  }): Promise<{ id: string } | "duplicate">;
  updateCheckoutStatus(
    checkoutId: string,
    status: ProviderCheckoutStatus,
  ): Promise<void>;
};

function currenciesMatch(left: string, right: string) {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

export async function reconcilePaymentEvent(
  event: NormalizedPaymentEvent,
  store: ReconcileStore,
) {
  if (!event.providerEventId || !event.providerPaymentId || !event.providerAccountId) {
    throw new PaymentError("PAYMENT_RECONCILE_REJECTED");
  }

  const existingEvent = await store.findWebhookEvent(event.provider, event.providerEventId);
  if (existingEvent) {
    return { duplicate: true as const, paymentCreated: false };
  }

  const checkout = await store.findCheckout({
    provider: event.provider,
    providerCheckoutId: event.providerCheckoutId,
    invoiceId: event.invoiceId,
  });
  if (!checkout) {
    throw new PaymentError("PAYMENT_RECONCILE_REJECTED");
  }

  const connection = await store.getConnectionById(checkout.providerConnectionId);
  if (!connection || connection.userId !== checkout.userId) {
    throw new PaymentError("PAYMENT_OWNER_MISMATCH");
  }
  if (connection.providerAccountId !== event.providerAccountId) {
    throw new PaymentError("PAYMENT_OWNER_MISMATCH");
  }
  if (event.invoiceId && event.invoiceId !== checkout.invoiceId) {
    throw new PaymentError("PAYMENT_RECONCILE_REJECTED");
  }
  if (!currenciesMatch(event.currency, checkout.currency)) {
    throw new PaymentError("PAYMENT_RECONCILE_REJECTED");
  }
  if (event.amountCents !== checkout.amountCents) {
    throw new PaymentError("PAYMENT_RECONCILE_REJECTED");
  }

  const inserted = await store.insertWebhookEvent({
    provider: event.provider,
    providerEventId: event.providerEventId,
    eventType: event.eventType,
    providerAccountId: event.providerAccountId,
  });
  if (inserted === "duplicate") {
    return { duplicate: true as const, paymentCreated: false };
  }

  if (event.status !== "completed") {
    await store.updateCheckoutStatus(
      checkout.id,
      event.status === "failed" ? "failed" : "pending",
    );
    await store.markWebhookProcessed(event.provider, event.providerEventId);
    return {
      duplicate: false as const,
      paymentCreated: false,
      status: event.status,
      invoiceId: checkout.invoiceId,
      userId: checkout.userId,
      amountCents: checkout.amountCents,
      currency: checkout.currency,
    };
  }

  const existingPayment = await store.findPayment(event.provider, event.providerPaymentId);
  if (existingPayment) {
    await store.markWebhookProcessed(event.provider, event.providerEventId);
    return { duplicate: true as const, paymentCreated: false };
  }

  const payment = await store.insertPayment({
    userId: checkout.userId,
    invoiceId: checkout.invoiceId,
    amountCents: event.amountCents,
    currency: checkout.currency,
    provider: event.provider,
    providerPaymentId: event.providerPaymentId,
    providerCheckoutId: event.providerCheckoutId ?? checkout.providerCheckoutId,
    providerAccountId: event.providerAccountId,
    paidOn: event.occurredAt.slice(0, 10),
  });

  await store.updateCheckoutStatus(checkout.id, "completed");
  await store.markWebhookProcessed(event.provider, event.providerEventId);

  return {
    duplicate: false as const,
    paymentCreated: payment !== "duplicate",
    status: event.status,
    invoiceId: checkout.invoiceId,
    userId: checkout.userId,
    amountCents: checkout.amountCents,
    currency: checkout.currency,
  };
}
