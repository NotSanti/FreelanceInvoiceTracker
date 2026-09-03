import { formatISODateLong } from "@/lib/dates";
import { formatAddressLines } from "@/lib/invoice/document";
import { formatCurrency } from "@/lib/money/format";
import { paymentMethodLabel } from "@/config/payments";

export type PaymentReceiptModel = {
  receiptTitle: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string | null;
  businessAddress: string[];
  clientName: string;
  clientCompany: string | null;
  clientEmail: string;
  invoiceNumber: string;
  paidOnLabel: string;
  methodLabel: string;
  reference: string | null;
  amountPaidLabel: string;
  invoiceTotalLabel: string;
  remainingLabel: string;
  isPaidInFull: boolean;
  currency: string;
};

export function buildPaymentReceiptDocument({
  business,
  client,
  invoiceNumber,
  currency,
  invoiceTotalCents,
  payment,
  remainingCentsAfter,
}: {
  business: {
    business_name: string;
    display_name: string;
    email: string;
    phone: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country: string | null;
  };
  client: {
    name: string;
    company_name: string | null;
    email: string;
  };
  invoiceNumber: string;
  currency: string;
  invoiceTotalCents: number;
  payment: {
    amountCents: number;
    paidOn: string;
    method: string;
    reference?: string | null;
  };
  remainingCentsAfter: number;
}): PaymentReceiptModel {
  const isPaidInFull = remainingCentsAfter <= 0;
  const money = (cents: number) => formatCurrency(cents, currency);

  return {
    receiptTitle: isPaidInFull ? "Payment receipt" : "Payment received",
    businessName: business.business_name || business.display_name,
    businessEmail: business.email,
    businessPhone: business.phone,
    businessAddress: formatAddressLines(business),
    clientName: client.name,
    clientCompany: client.company_name,
    clientEmail: client.email,
    invoiceNumber,
    paidOnLabel: formatISODateLong(payment.paidOn),
    methodLabel: paymentMethodLabel(payment.method),
    reference: payment.reference?.trim() || null,
    amountPaidLabel: money(payment.amountCents),
    invoiceTotalLabel: money(invoiceTotalCents),
    remainingLabel: money(Math.max(remainingCentsAfter, 0)),
    isPaidInFull,
    currency,
  };
}

export function receiptPdfFilename(invoiceNumber: string) {
  const safe = invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, "-") || "invoice";
  return `${safe}-receipt.pdf`;
}
