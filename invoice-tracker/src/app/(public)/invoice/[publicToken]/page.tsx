import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoiceDocumentView } from "@/components/invoices/invoice-document";
import { PublicPayButton } from "@/components/invoices/public-pay-button";
import { MoneyValue } from "@/components/shared/money-value";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { buildPublicInvoiceDocument } from "@/lib/invoice/document";
import { formatISODateLong } from "@/lib/dates";
import {
  getPublicInvoice,
  isPublicToken,
  markPublicInvoiceViewed,
} from "@/lib/public-invoice";
import { isStripeConfigured } from "@/lib/stripe/env";
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
  searchParams,
}: PageProps<"/invoice/[publicToken]">) {
  const { publicToken } = await params;
  const query = await searchParams;

  if (!isPublicToken(publicToken)) {
    notFound();
  }

  const record = await getPublicInvoice(publicToken);
  if (!record) {
    notFound();
  }

  await markPublicInvoiceViewed(publicToken);

  const document = buildPublicInvoiceDocument(record);
  const checkout = Array.isArray(query.checkout) ? query.checkout[0] : query.checkout;
  const paid = record.remainingCents === 0;
  const stripeReady = isStripeConfigured();

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
        ) : stripeReady ? (
          <PublicPayButton publicToken={publicToken} />
        ) : (
          <Button type="button" size="sm" disabled>
            Pay invoice
          </Button>
        )}
      </div>

      {checkout === "success" && !paid ? (
        <p className="text-sm text-muted-foreground">
          Payment is processing. This page will show Paid once Stripe confirms it.
        </p>
      ) : null}
      {checkout === "cancelled" ? (
        <p className="text-sm text-muted-foreground">
          Checkout was cancelled. You can try again when you are ready.
        </p>
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

      <InvoiceDocumentView document={document} />

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
