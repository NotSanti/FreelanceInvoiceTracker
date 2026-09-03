import type { InvoiceDocumentModel } from "@/lib/invoice/document";

export function InvoiceDocumentView({
  document,
}: {
  document: InvoiceDocumentModel;
}) {
  return (
    <article className="text-[13px] leading-6 text-foreground">
      <header className="flex flex-col justify-between gap-8 sm:flex-row">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight">
            {document.businessName}
          </p>
          <div className="mt-2 text-muted-foreground">
            {document.businessAddress.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>{document.businessEmail}</p>
            {document.businessPhone ? <p>{document.businessPhone}</p> : null}
            {document.gstRegistration ? <p>GST {document.gstRegistration}</p> : null}
            {document.qstRegistration ? <p>QST {document.qstRegistration}</p> : null}
            {document.taxRegistration && !document.gstRegistration && !document.qstRegistration ? (
              <p>Tax ID {document.taxRegistration}</p>
            ) : null}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Invoice
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
            {document.invoiceNumber}
          </p>
          <dl className="mt-4 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 sm:justify-end">
            <dt className="text-muted-foreground">Issued</dt>
            <dd>{document.issueDateLabel}</dd>
            {document.dueDateLabel ? (
              <>
                <dt className="text-muted-foreground">Due</dt>
                <dd>{document.dueDateLabel}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </header>

      <div className="my-8 border-t border-border" />

      <section>
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Bill to
        </h2>
        <div className="mt-2">
          <p>{document.clientName}</p>
          {document.clientCompany ? (
            <p className="text-muted-foreground">{document.clientCompany}</p>
          ) : null}
          {document.clientAddress.map((line) => (
            <p key={line} className="text-muted-foreground">
              {line}
            </p>
          ))}
          <p className="text-muted-foreground">{document.clientEmail}</p>
        </div>
      </section>

      <div className="my-8 border-t border-border" />

      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="border-b border-border text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
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
          {document.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-3 text-muted-foreground">
                No line items
              </td>
            </tr>
          ) : (
            document.items.map((item, index) => (
              <tr
                key={`${item.description}-${index}`}
                className="border-b border-border last:border-b-0"
              >
                <td className="py-3 pr-4 break-words">{item.description}</td>
                <td className="py-3 pr-4 text-right tabular-nums whitespace-nowrap">
                  {item.quantityLabel}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums whitespace-nowrap">
                  {item.rateLabel}
                </td>
                <td className="py-3 text-right tabular-nums whitespace-nowrap">
                  {item.amountLabel}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <dl className="ml-auto mt-6 w-full max-w-[240px] space-y-1">
        <div className="flex justify-between gap-8">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{document.subtotalLabel}</dd>
        </div>
        {document.discountLabel ? (
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="tabular-nums">{document.discountLabel}</dd>
          </div>
        ) : null}
        {document.taxLines.map((line) => (
          <div key={line.label} className="flex justify-between gap-8">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="tabular-nums">{line.amountLabel}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-8 border-t border-foreground pt-2 font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{document.totalLabel}</dd>
        </div>
      </dl>

      {document.notes ? (
        <section className="mt-10 break-inside-avoid">
          <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {document.notes}
          </p>
        </section>
      ) : null}

      {document.paymentInstructions ? (
        <section className="mt-8 break-inside-avoid">
          <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Payment instructions
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {document.paymentInstructions}
          </p>
        </section>
      ) : null}
    </article>
  );
}
