import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoiceDocumentView } from "@/components/invoices/invoice-document";
import { PublicPayButton } from "@/components/invoices/public-pay-button";
import { MoneyValue } from "@/components/shared/money-value";
import { StatusBadge } from "@/components/shared/status-badge";
import { buildPublicInvoiceDocument } from "@/lib/invoice/document";
import { formatISODateLong } from "@/lib/dates";
import {
  getPublicInvoice,
  isPublicToken,
  markPublicInvoiceViewed,
} from "@/lib/public-invoice";
import { isStripeCheckoutOffered } from "@/lib/stripe/env";
import { paymentMethodLabel } from "@/config/payments";

export async function generateMetadata({
  params,
}: PageProps<"/invoice/[publicToken]">): Promise<Metadata> {
  const { publicToken } = await params;
  const record = await getPublicInvoice(publicToken);

  return {
    title: record ? `Invoice ${record.invoice.invoice_number}` : "Invoice",
  };
}

export default async function PublicInvoicePage({
  params,
}: PageProps<"/invoice/[publicToken]">) {
  const { publicToken } = await params;

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
  const offerCardCheckout = isStripeCheckoutOffered();

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
        ) : offerCardCheckout ? (
          <PublicPayButton publicToken={publicToken} />
        ) : null}
      </div>

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

      {!paid ? (
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
            {record.invoice.payment_instructions ? (
              <p className="whitespace-pre-wrap text-base leading-7 sm:text-lg sm:leading-8">
                {record.invoice.payment_instructions}
              </p>
            ) : (
              <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Pay by e-transfer using the details the sender provided.
              </p>
            )}
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
