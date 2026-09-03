import {
  calculateBalanceRemaining,
} from "@/lib/invoice/totals";
import { formatISODateLong } from "@/lib/dates";
import { paymentMethodLabel } from "@/config/payments";
import { MoneyValue } from "@/components/shared/money-value";
import { StatusBadge } from "@/components/shared/status-badge";
import type { InvoiceDetail } from "@/lib/invoices/queries";

function formatQuantity(quantity: number) {
  return quantity.toLocaleString("en-CA", { maximumFractionDigits: 4 });
}

function clientLabel(invoice: InvoiceDetail) {
  return invoice.clients.company_name || invoice.clients.name;
}

function formatClientAddress(invoice: InvoiceDetail) {
  const lines = [
    invoice.clients.address_line_1,
    invoice.clients.address_line_2,
    [invoice.clients.city, invoice.clients.province, invoice.clients.postal_code]
      .filter(Boolean)
      .join(" "),
    invoice.clients.country,
  ].filter(Boolean);

  return lines;
}

export function InvoiceDetailView({ invoice }: { invoice: InvoiceDetail }) {
  const paidCents = invoice.paidCents;
  const remainingCents = calculateBalanceRemaining(invoice.total_cents, paidCents);
  const taxLabel = invoice.tax_name || "Tax";
  const addressLines = formatClientAddress(invoice);
  const activity = [
    { at: invoice.created_at, label: "Invoice created" },
    invoice.sent_at ? { at: invoice.sent_at, label: "Invoice sent" } : null,
    invoice.viewed_at ? { at: invoice.viewed_at, label: "Invoice viewed" } : null,
    invoice.paid_at ? { at: invoice.paid_at, label: "Invoice paid" } : null,
  ].filter((event): event is { at: string; label: string } => event !== null);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight tabular-nums md:text-[1.75rem]">
            {invoice.invoice_number}
          </h1>
          <StatusBadge status={invoice.displayStatus} />
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="text-foreground">{clientLabel(invoice)}</p>
          <p>
            {invoice.due_date
              ? `Due ${formatISODateLong(invoice.due_date)}`
              : "No due date"}
          </p>
        </div>
        <div>
          <MoneyValue
            amountCents={invoice.total_cents}
            currency={invoice.currency}
            size="lg"
          />
          <p className="mt-1 text-sm text-muted-foreground">Total invoice</p>
        </div>
        <dl className="grid max-w-sm gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Paid</dt>
            <dd>
              <MoneyValue
                amountCents={paidCents}
                currency={invoice.currency}
                size="sm"
              />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Remaining</dt>
            <dd>
              <MoneyValue
                amountCents={remainingCents}
                currency={invoice.currency}
                size="sm"
              />
            </dd>
          </div>
        </dl>
      </section>

      <div className="border-t border-border" />

      <section className="space-y-4">
        <h2 className="text-base font-medium">Bill to</h2>
        <div className="text-sm">
          <p>{invoice.clients.name}</p>
          {invoice.clients.company_name ? (
            <p className="text-muted-foreground">{invoice.clients.company_name}</p>
          ) : null}
          <p className="text-muted-foreground">{invoice.clients.email}</p>
          {invoice.clients.phone ? (
            <p className="text-muted-foreground">{invoice.clients.phone}</p>
          ) : null}
          {addressLines.map((line) => (
            <p key={line} className="text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      </section>

      <div className="border-t border-border" />

      <section className="space-y-4">
        <h2 className="text-base font-medium">Invoice</h2>
        {invoice.invoice_items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No line items yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Line items</caption>
            <thead>
              <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Description
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Rate
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-4">{item.description}</td>
                  <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                    {formatQuantity(item.quantity)}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <MoneyValue
                      amountCents={item.unit_price_cents}
                      currency={invoice.currency}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 text-right">
                    <MoneyValue
                      amountCents={item.amount_cents}
                      currency={invoice.currency}
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <dl className="ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>
              <MoneyValue
                amountCents={invoice.subtotal_cents}
                currency={invoice.currency}
                size="sm"
              />
            </dd>
          </div>
          {invoice.discount_cents > 0 ? (
            <div className="flex justify-between gap-8">
              <dt className="text-muted-foreground">Discount</dt>
              <dd>
                <MoneyValue
                  amountCents={invoice.discount_cents}
                  currency={invoice.currency}
                  size="sm"
                />
              </dd>
            </div>
          ) : null}
          {invoice.gst_cents > 0 || invoice.qst_cents > 0 ? (
            <>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">
                  {invoice.gst_rate !== null ? `GST ${Number(invoice.gst_rate)}%` : "GST"}
                </dt>
                <dd>
                  <MoneyValue
                    amountCents={invoice.gst_cents}
                    currency={invoice.currency}
                    size="sm"
                  />
                </dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">
                  {invoice.qst_rate !== null ? `QST ${Number(invoice.qst_rate)}%` : "QST"}
                </dt>
                <dd>
                  <MoneyValue
                    amountCents={invoice.qst_cents}
                    currency={invoice.currency}
                    size="sm"
                  />
                </dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-8">
              <dt className="text-muted-foreground">{taxLabel}</dt>
              <dd>
                <MoneyValue
                  amountCents={invoice.tax_cents}
                  currency={invoice.currency}
                  size="sm"
                />
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-8 border-t border-border pt-2 font-medium">
            <dt>Total</dt>
            <dd>
              <MoneyValue
                amountCents={invoice.total_cents}
                currency={invoice.currency}
                size="sm"
              />
            </dd>
          </div>
        </dl>
      </section>

      {invoice.notes ? (
        <>
          <div className="border-t border-border" />
          <section className="space-y-2">
            <h2 className="text-base font-medium">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {invoice.notes}
            </p>
          </section>
        </>
      ) : null}

      {invoice.payment_instructions ? (
        <>
          <div className="border-t border-border" />
          <section className="space-y-2">
            <h2 className="text-base font-medium">Payment instructions</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {invoice.payment_instructions}
            </p>
          </section>
        </>
      ) : null}

      <div className="border-t border-border" />

      <section className="space-y-3">
        <h2 className="text-base font-medium">Payments</h2>
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {invoice.payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  {formatISODateLong(payment.paid_on)} · {paymentMethodLabel(payment.method)}
                  {payment.reference ? ` · ${payment.reference}` : ""}
                </span>
                <MoneyValue
                  amountCents={payment.amount_cents}
                  currency={invoice.currency}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="border-t border-border" />

      <section className="space-y-3">
        <h2 className="text-base font-medium">Activity</h2>
        <ol className="space-y-2 text-sm">
          {activity.map((event) => (
            <li key={`${event.label}-${event.at}`} className="flex gap-4">
              <span className="w-28 shrink-0 text-muted-foreground">
                {formatISODateLong(event.at.slice(0, 10))}
              </span>
              <span>{event.label}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
