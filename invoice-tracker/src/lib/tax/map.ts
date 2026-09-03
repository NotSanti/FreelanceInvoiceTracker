import type { InvoiceTaxInput } from "@/lib/tax/summary";
import type { Invoice } from "@/types/database";

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return typeof value === "number" ? value : Number(value);
}

export function toInvoiceTaxInput(invoice: Invoice): InvoiceTaxInput {
  const subtotal = toNumber(invoice.subtotal_cents);
  const discount = toNumber(invoice.discount_cents);
  const storedTaxable = toNumber(invoice.taxable_subtotal_cents, -1);

  return {
    status: invoice.status,
    issueDate: invoice.issue_date,
    taxableSubtotalCents: storedTaxable >= 0 ? storedTaxable : subtotal - discount,
    gstCents: toNumber(invoice.gst_cents),
    qstCents: toNumber(invoice.qst_cents),
  };
}
