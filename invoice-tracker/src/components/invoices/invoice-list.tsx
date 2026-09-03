import Link from "next/link";

import { MoneyValue } from "@/components/shared/money-value";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatISODate } from "@/lib/dates";
import type { InvoiceListItem } from "@/lib/invoices/queries";

function clientLabel(invoice: InvoiceListItem) {
  return invoice.clients.company_name || invoice.clients.name;
}

export function InvoiceList({ invoices }: { invoices: InvoiceListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Invoices</caption>
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted-foreground">
            <th scope="col" className="py-3 pr-4 font-medium">
              Invoice
            </th>
            <th scope="col" className="py-3 pr-4 font-medium">
              Client
            </th>
            <th scope="col" className="py-3 pr-4 font-medium">
              Issued
            </th>
            <th scope="col" className="py-3 pr-4 font-medium">
              Due
            </th>
            <th scope="col" className="py-3 pr-4 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="py-3 text-right font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className="border-b border-border last:border-b-0 hover:bg-muted/40"
            >
              <td className="py-3.5 pr-4">
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="font-medium tabular-nums text-foreground hover:underline"
                >
                  {invoice.invoice_number}
                </Link>
              </td>
              <td className="py-3.5 pr-4">{clientLabel(invoice)}</td>
              <td className="py-3.5 pr-4 text-muted-foreground">
                {formatISODate(invoice.issue_date)}
              </td>
              <td className="py-3.5 pr-4 text-muted-foreground">
                {invoice.due_date ? formatISODate(invoice.due_date) : "—"}
              </td>
              <td className="py-3.5 pr-4 text-right">
                <MoneyValue
                  amountCents={invoice.total_cents}
                  currency={invoice.currency}
                  size="sm"
                />
              </td>
              <td className="py-3.5 text-right">
                <StatusBadge status={invoice.displayStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
