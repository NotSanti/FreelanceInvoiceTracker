import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CheckoutReturnStatus } from "@/components/invoices/checkout-return-status";
import { InvoiceDocumentView } from "@/components/invoices/invoice-document";
import { PublicPayButton } from "@/components/invoices/public-pay-button";
import { MoneyValue } from "@/components/shared/money-value";
import { StatusBadge } from "@/components/shared/status-badge";
import { buildPublicInvoiceDocument } from "@/lib/invoice/document";
import { formatISODateLong } from "@/lib/dates";
import {
  getInvoiceCheckoutState,
  getPublicInvoice,
  isPublicToken,
  markPublicInvoiceViewed,
} from "@/lib/public-invoice";
import { checkoutReturnFromSearchParam } from "@/lib/payments/checkout-return";
import {
  canOfferAnyProviderCheckout,
  canOfferProviderCheckout,
} from "@/lib/payments/connection-status";
import { getProviderConnection } from "@/lib/payments/repository.server";
import { isStripeTestMode } from "@/lib/stripe/env";
import { paymentMethodLabel } from "@/config/payments";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/invoice/[publicToken]">): Promise<Metadata> {
  const { publicToken } = await params;
  const record = isPublicToken(publicToken)
    ? await getPublicInvoice(publicToken)
    : null;

  return {
    title: record ? `Invoice ${record.invoice.invoice_number}` : "Invoice",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        noarchive: true,
      },
    },
  };
}

export default async function PublicInvoicePage({
  params,
  searchParams,
}: PageProps<"/invoice/[publicToken]">) {
  const { publicToken } = await params;
  const checkoutReturn = checkoutReturnFromSearchParam((await searchParams).checkout);

  if (!isPublicToken(publicToken)) {
    notFound();
  }

  const record = await getPublicInvoice(publicToken);
  if (!record) {
    notFound();
  }

  await markPublicInvoiceViewed(publicToken);

  const document = buildPublicInvoiceDocument(record);
  const paid = record.remainingCents === 0;
  const checkoutState = await getInvoiceCheckoutState(publicToken);
  const stripeConnection = checkoutState
    ? await getProviderConnection(checkoutState.user_id, "stripe")
    : null;
  const squareConnection = checkoutState
    ? await getProviderConnection(checkoutState.user_id, "square")
    : null;
  const paypalConnection = checkoutState
    ? await getProviderConnection(checkoutState.user_id, "paypal")
    : null;
  const stripeTestMode = isStripeTestMode();
  const offerStripeCheckout = canOfferProviderCheckout(stripeConnection, {
    stripeTestMode,
  });
  const offerSquareCheckout = canOfferProviderCheckout(squareConnection);
  const offerPaypalCheckout = canOfferProviderCheckout(paypalConnection);
  const showPaySecurely = canOfferAnyProviderCheckout(
    [stripeConnection, squareConnection, paypalConnection],
    { stripeTestMode },
  );
  const awaitingConfirmation = checkoutReturn === "success" && !paid;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Invoice</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums">
              {record.invoice.invoice_number}
            </h1>
            <StatusBadge status={paid ? "paid" : record.invoice.status} />
          </div>
        </div>
        {paid ? (
          <p className="text-sm text-muted-foreground">This invoice is paid.</p>
        ) : null}
      </div>

      {checkoutReturn ? (
        <CheckoutReturnStatus checkout={checkoutReturn} paid={paid} />
      ) : null}

      <section className="grid max-w-sm gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Paid</p>
          <MoneyValue amountCents={record.paidCents} currency={record.invoice.currency} size="sm" />
        </div>
        <div>
          <p className="text-muted-foreground">Remaining</p>
          <MoneyValue
            amountCents={record.remainingCents}
            currency={record.invoice.currency}
            size="sm"
          />
        </div>
      </section>

      <div className="border-t border-border" />

      <InvoiceDocumentView
        document={document}
        hidePaymentInstructions={!paid}
      />

      {!paid && !awaitingConfirmation ? (
        <>
          <div className="border-t border-border" />
          <section className="space-y-5">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              How to pay
            </h2>
            <div>
              <p className="text-sm text-muted-foreground">Amount due</p>
              <p className="mt-1">
                <MoneyValue
                  amountCents={record.remainingCents}
                  currency={record.invoice.currency}
                  size="lg"
                />
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">E-transfer</p>
              {record.invoice.payment_instructions ? (
                <p className="whitespace-pre-wrap text-base leading-7 sm:text-lg sm:leading-8">
                  {record.invoice.payment_instructions}
                </p>
              ) : (
                <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                  Pay by e-transfer using the details the sender provided.
                </p>
              )}
            </div>
            {showPaySecurely ? (
              <>
                <p className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  or
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </p>
                <div className="space-y-3">
                  <p className="text-sm font-medium">Pay securely</p>
                  <div className="flex flex-wrap gap-2">
                    {offerStripeCheckout ? (
                      <PublicPayButton publicToken={publicToken} provider="stripe" />
                    ) : null}
                    {offerSquareCheckout ? (
                      <PublicPayButton publicToken={publicToken} provider="square" />
                    ) : null}
                    {offerPaypalCheckout ? (
                      <PublicPayButton publicToken={publicToken} provider="paypal" />
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Payments are processed by the selected provider and paid to the
                    invoice issuer&apos;s connected account. IndependentPocket does not
                    hold your funds.
                  </p>
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : null}

      {record.payments.length > 0 ? (
        <>
          <div className="border-t border-border" />
          <section className="space-y-2">
            <h2 className="text-base font-medium">Payments</h2>
            <ul className="space-y-2 text-sm">
              {record.payments.map((payment, index) => (
                <li key={`${payment.paid_on}-${index}`} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {formatISODateLong(payment.paid_on)} · {paymentMethodLabel(payment.method)}
                  </span>
                  <MoneyValue
                    amountCents={Number(payment.amount_cents)}
                    currency={record.invoice.currency}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
