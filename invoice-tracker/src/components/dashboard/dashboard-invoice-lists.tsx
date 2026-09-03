import Link from "next/link";

import { MoneyValue } from "@/components/shared/money-value";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatISODate } from "@/lib/dates";
import type { AttentionInvoice, InvoiceMetricInput } from "@/lib/dashboard/metrics";
import type { InvoiceStatus } from "@/types/invoice";

function attentionStatus(invoice: AttentionInvoice): InvoiceStatus {
  if (invoice.reason === "due_soon") {
    return "due_soon";
  }
  if (invoice.reason === "overdue") {
    return "overdue";
  }
  return "draft";
}

function attentionMeta(invoice: AttentionInvoice) {
  if (invoice.reason === "old_draft") {
    return `Draft since ${formatISODate(invoice.issueDate)}`;
  }
  if (!invoice.dueDate) {
    return "No due date";
  }
  return `Due ${formatISODate(invoice.dueDate)}`;
}

function InvoiceRow({
  invoice,
  status,
  meta,
  currency,
}: {
  invoice: InvoiceMetricInput;
  status: InvoiceStatus;
  meta: string;
  currency: string;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/invoices/${invoice.id}`}
        className="flex items-baseline gap-4 py-3.5 hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium tabular-nums text-foreground">
            {invoice.invoiceNumber}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {invoice.clientLabel}
            <span className="text-border"> · </span>
            {meta}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <MoneyValue
            amountCents={invoice.totalCents}
            currency={currency}
            size="sm"
          />
          <StatusBadge status={status} className="whitespace-nowrap" />
        </div>
      </Link>
    </li>
  );
}

export function AttentionList({
  invoices,
  currency,
}: {
  invoices: AttentionInvoice[];
  currency: string;
}) {
  return (
    <section aria-labelledby="attention-heading" className="space-y-4">
      <h2 id="attention-heading" className="text-base font-medium text-foreground">
        Invoices needing attention
      </h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing needs attention.</p>
      ) : (
        <ul>
          {invoices.map((invoice) => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              status={attentionStatus(invoice)}
              meta={attentionMeta(invoice)}
              currency={currency}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentInvoiceList({
  invoices,
  currency,
}: {
  invoices: InvoiceMetricInput[];
  currency: string;
}) {
  return (
    <section aria-labelledby="recent-heading" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="recent-heading" className="text-base font-medium text-foreground">
          Recent invoices
        </h2>
        <Link
          href="/invoices"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          All invoices
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <ul>
          {invoices.map((invoice) => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              status={invoice.displayStatus}
              meta={
                invoice.dueDate
                  ? `Due ${formatISODate(invoice.dueDate)}`
                  : "No due date"
              }
              currency={currency}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
