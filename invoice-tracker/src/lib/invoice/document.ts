import { formatISODateLong } from "@/lib/dates";
import { formatCurrency } from "@/lib/money/format";
import type { InvoiceDetail } from "@/lib/invoices/queries";
import type { Profile } from "@/types/database";

export type AddressFields = {
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
};

export type InvoiceDocumentLine = {
  description: string;
  quantityLabel: string;
  rateLabel: string;
  amountLabel: string;
};

export type InvoiceDocumentTaxLine = {
  label: string;
  amountLabel: string;
};

export type InvoiceDocumentModel = {
  invoiceNumber: string;
  issueDateLabel: string;
  dueDateLabel: string | null;
  currency: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string | null;
  businessAddress: string[];
  taxRegistration: string | null;
  gstRegistration: string | null;
  qstRegistration: string | null;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string;
  clientAddress: string[];
  items: InvoiceDocumentLine[];
  subtotalLabel: string;
  discountLabel: string | null;
  taxLines: InvoiceDocumentTaxLine[];
  totalLabel: string;
  notes: string | null;
  paymentInstructions: string | null;
};

export function formatAddressLines(fields: AddressFields) {
  const locality = [fields.city, fields.province, fields.postal_code]
    .filter(Boolean)
    .join(" ");

  return [
    fields.address_line_1,
    fields.address_line_2,
    locality || null,
    fields.country,
  ].filter((line): line is string => Boolean(line?.trim()));
}

export function formatInvoiceQuantity(quantity: number) {
  return quantity.toLocaleString("en-CA", { maximumFractionDigits: 4 });
}

function formatRate(rate: number | null) {
  if (rate === null) {
    return "";
  }
  return String(Number(rate));
}

export function invoiceTaxLines(
  invoice: Pick<InvoiceDetail, "gst_cents" | "gst_rate" | "qst_cents" | "qst_rate" | "tax_cents" | "tax_name">,
  money: (cents: number) => string,
): InvoiceDocumentTaxLine[] {
  if (invoice.gst_cents > 0 || invoice.qst_cents > 0) {
    const lines: InvoiceDocumentTaxLine[] = [];
    if (invoice.gst_cents > 0 || invoice.gst_rate !== null) {
      const rate = formatRate(invoice.gst_rate);
      lines.push({
        label: rate ? `GST ${rate}%` : "GST",
        amountLabel: money(invoice.gst_cents),
      });
    }
    if (invoice.qst_cents > 0 || invoice.qst_rate !== null) {
      const rate = formatRate(invoice.qst_rate);
      lines.push({
        label: rate ? `QST ${rate}%` : "QST",
        amountLabel: money(invoice.qst_cents),
      });
    }
    return lines;
  }

  return [
    {
      label: invoice.tax_name || "Tax",
      amountLabel: money(invoice.tax_cents),
    },
  ];
}

export function buildInvoiceDocument(
  invoice: InvoiceDetail,
  profile: Profile,
): InvoiceDocumentModel {
  const money = (cents: number) => formatCurrency(cents, invoice.currency);

  return {
    invoiceNumber: invoice.invoice_number,
    issueDateLabel: formatISODateLong(invoice.issue_date),
    dueDateLabel: invoice.due_date ? formatISODateLong(invoice.due_date) : null,
    currency: invoice.currency,
    businessName: profile.business_name || profile.display_name,
    businessEmail: profile.email,
    businessPhone: profile.phone,
    businessAddress: formatAddressLines(profile),
    taxRegistration: profile.tax_registration_number,
    gstRegistration: profile.is_gst_qst_registered
      ? profile.gst_registration_number
      : null,
    qstRegistration: profile.is_gst_qst_registered
      ? profile.qst_registration_number
      : null,
    clientName: invoice.clients.name,
    clientCompany: invoice.clients.company_name,
    clientEmail: invoice.clients.email,
    clientAddress: formatAddressLines(invoice.clients),
    items: invoice.invoice_items.map((item) => ({
      description: item.description,
      quantityLabel: formatInvoiceQuantity(item.quantity),
      rateLabel: money(item.unit_price_cents),
      amountLabel: money(item.amount_cents),
    })),
    subtotalLabel: money(invoice.subtotal_cents),
    discountLabel:
      invoice.discount_cents > 0 ? money(invoice.discount_cents) : null,
    taxLines: invoiceTaxLines(invoice, money),
    totalLabel: money(invoice.total_cents),
    notes: invoice.notes,
    paymentInstructions: invoice.payment_instructions,
  };
}

export function buildPublicInvoiceDocument({
  invoice,
  profile,
  client,
  items,
}: {
  invoice: {
    invoice_number: string;
    issue_date: string;
    due_date: string | null;
    currency: string;
    subtotal_cents: number;
    discount_cents: number;
    tax_cents: number;
    tax_name: string | null;
    gst_cents: number;
    gst_rate: number | null;
    qst_cents: number;
    qst_rate: number | null;
    total_cents: number;
    payment_instructions: string | null;
  };
  profile: AddressFields & {
    business_name: string;
    display_name: string;
    email: string;
    phone: string | null;
    tax_registration_number: string | null;
    is_gst_qst_registered?: boolean;
    gst_registration_number: string | null;
    qst_registration_number: string | null;
  };
  client: AddressFields & {
    name: string;
    company_name: string | null;
    email: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit_price_cents: number;
    amount_cents: number;
  }>;
}): InvoiceDocumentModel {
  const money = (cents: number) => formatCurrency(cents, invoice.currency);
  const showGstQstRegistration = Boolean(profile.is_gst_qst_registered);

  return {
    invoiceNumber: invoice.invoice_number,
    issueDateLabel: formatISODateLong(invoice.issue_date),
    dueDateLabel: invoice.due_date ? formatISODateLong(invoice.due_date) : null,
    currency: invoice.currency,
    businessName: profile.business_name || profile.display_name,
    businessEmail: profile.email,
    businessPhone: profile.phone,
    businessAddress: formatAddressLines(profile),
    taxRegistration: profile.tax_registration_number,
    gstRegistration: showGstQstRegistration
      ? profile.gst_registration_number
      : null,
    qstRegistration: showGstQstRegistration
      ? profile.qst_registration_number
      : null,
    clientName: client.name,
    clientCompany: client.company_name,
    clientEmail: client.email,
    clientAddress: formatAddressLines(client),
    items: items.map((item) => ({
      description: item.description,
      quantityLabel: formatInvoiceQuantity(Number(item.quantity)),
      rateLabel: money(Number(item.unit_price_cents)),
      amountLabel: money(Number(item.amount_cents)),
    })),
    subtotalLabel: money(Number(invoice.subtotal_cents)),
    discountLabel:
      Number(invoice.discount_cents) > 0 ? money(Number(invoice.discount_cents)) : null,
    taxLines: invoiceTaxLines(
      {
        gst_cents: Number(invoice.gst_cents),
        gst_rate: invoice.gst_rate === null ? null : Number(invoice.gst_rate),
        qst_cents: Number(invoice.qst_cents),
        qst_rate: invoice.qst_rate === null ? null : Number(invoice.qst_rate),
        tax_cents: Number(invoice.tax_cents),
        tax_name: invoice.tax_name,
      },
      money,
    ),
    totalLabel: money(Number(invoice.total_cents)),
    notes: null,
    paymentInstructions: invoice.payment_instructions,
  };
}

export function invoicePdfFilename(invoiceNumber: string) {
  const safe = invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, "-") || "invoice";
  return `${safe}.pdf`;
}
