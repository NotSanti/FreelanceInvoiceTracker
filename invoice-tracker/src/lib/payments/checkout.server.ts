import "server-only";

import { canOfferProviderCheckout } from "@/lib/payments/connection-status";
import { PaymentError } from "@/lib/payments/errors";
import { remainingCentsFromPayments } from "@/lib/payments/totals";
import type { PaymentProviderRegistry } from "@/lib/payments/registry";
import type {
  CheckoutInvoiceRecord,
  PaymentProvider,
  PaymentProviderConnection,
  ProviderCheckoutResult,
} from "@/lib/payments/types";
import { isPaymentProvider } from "@/lib/payments/types";
import { isStripeTestMode } from "@/lib/stripe/env";

export type CheckoutStore = {
  getInvoiceByPublicToken(token: string): Promise<CheckoutInvoiceRecord | null>;
  getConnection(
    userId: string,
    provider: PaymentProvider,
  ): Promise<PaymentProviderConnection | null>;
  isProviderEnabledOnInvoice(
    invoiceId: string,
    userId: string,
    provider: PaymentProvider,
  ): Promise<boolean>;
  insertCheckout(row: {
    userId: string;
    invoiceId: string;
    provider: PaymentProvider;
    providerConnectionId: string;
    amountCents: number;
    currency: string;
  }): Promise<{ id: string }>;
  saveProviderCheckoutDetails(
    checkoutId: string,
    details: ProviderCheckoutResult,
  ): Promise<void>;
};

export type CreateHostedCheckoutInput = {
  publicInvoiceToken: string;
  provider: string;
  successUrl: string;
  cancelUrl: string;
};

export async function createHostedCheckout(
  input: CreateHostedCheckoutInput,
  deps: {
    store: CheckoutStore;
    registry: PaymentProviderRegistry;
    assertRateLimit?: () => { ok: true } | { ok: false };
  },
) {
  if (!isPaymentProvider(input.provider)) {
    throw new PaymentError("PAYMENT_PROVIDER_INVALID");
  }

  const adapter = deps.registry.get(input.provider);

  if (deps.assertRateLimit && !deps.assertRateLimit().ok) {
    throw new PaymentError("PAYMENT_CHECKOUT_RATE_LIMITED");
  }

  const invoice = await deps.store.getInvoiceByPublicToken(input.publicInvoiceToken);
  if (!invoice) {
    throw new PaymentError("PAYMENT_INVOICE_NOT_FOUND");
  }

  if (invoice.status === "draft" || invoice.status === "void" || invoice.status === "paid") {
    throw new PaymentError("PAYMENT_INVOICE_NOT_PAYABLE");
  }

  const outstandingCents = remainingCentsFromPayments(invoice.totalCents, [
    { amountCents: invoice.paidCents },
  ]);
  if (outstandingCents <= 0) {
    throw new PaymentError("PAYMENT_INVOICE_NOT_PAYABLE");
  }

  const enabled = await deps.store.isProviderEnabledOnInvoice(
    invoice.id,
    invoice.userId,
    input.provider,
  );
  if (!enabled) {
    throw new PaymentError("PAYMENT_METHOD_NOT_ENABLED");
  }

  const connection = await deps.store.getConnection(invoice.userId, input.provider);
  if (!connection) {
    throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
  }
  if (connection.userId !== invoice.userId) {
    throw new PaymentError("PAYMENT_OWNER_MISMATCH");
  }
  if (!canOfferProviderCheckout(connection, { stripeTestMode: isStripeTestMode() })) {
    throw new PaymentError("PAYMENT_CONNECTION_UNUSABLE");
  }

  const checkout = await deps.store.insertCheckout({
    userId: invoice.userId,
    invoiceId: invoice.id,
    provider: input.provider,
    providerConnectionId: connection.id,
    amountCents: outstandingCents,
    currency: invoice.currency,
  });

  let providerCheckout: ProviderCheckoutResult;
  try {
    providerCheckout = await adapter.createCheckout({
      invoice: {
        id: invoice.id,
        userId: invoice.userId,
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        outstandingCents,
      },
      connection,
      checkoutId: checkout.id,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
  } catch {
    throw new PaymentError("PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED");
  }

  await deps.store.saveProviderCheckoutDetails(checkout.id, providerCheckout);

  return {
    checkoutId: checkout.id,
    checkoutUrl: providerCheckout.checkoutUrl,
    amountCents: outstandingCents,
    currency: invoice.currency,
    provider: input.provider,
  };
}
