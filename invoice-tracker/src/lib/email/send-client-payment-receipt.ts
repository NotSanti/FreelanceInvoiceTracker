import { renderPaymentReceiptPdf } from "@/components/receipts/receipt-pdf";
import { paymentMethodLabel } from "@/config/payments";
import { buildReceiptEmailHtml } from "@/lib/email/receipt-email-template";
import { sendClientReceiptEmail } from "@/lib/email/send-receipt";
import { formatISODateLong } from "@/lib/dates";
import { formatCurrency } from "@/lib/money/format";
import {
  buildPaymentReceiptDocument,
  receiptPdfFilename,
} from "@/lib/receipt/document";

type ReceiptBusiness = {
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

type ReceiptClient = {
  name: string;
  company_name: string | null;
  email: string | null;
};

export async function sendClientPaymentReceipt({
  business,
  client,
  invoiceNumber,
  currency,
  invoiceTotalCents,
  payment,
  remainingCentsAfter,
}: {
  business: ReceiptBusiness;
  client: ReceiptClient;
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
}) {
  const to = client.email?.trim();
  if (!to) {
    return { skipped: "no_client_email" } as const;
  }

  const document = buildPaymentReceiptDocument({
    business,
    client: {
      name: client.name,
      company_name: client.company_name,
      email: to,
    },
    invoiceNumber,
    currency,
    invoiceTotalCents,
    payment,
    remainingCentsAfter,
  });

  const pdf = await renderPaymentReceiptPdf(document);
  const amountPaidLabel = formatCurrency(payment.amountCents, currency);
  const methodLabel = paymentMethodLabel(payment.method);
  const paidOnLabel = formatISODateLong(payment.paidOn);
  const isPaidInFull = remainingCentsAfter <= 0;
  const subject = isPaidInFull
    ? `Receipt · ${invoiceNumber} paid in full`
    : `Receipt · Payment received for ${invoiceNumber}`;
  const text = [
    `Hi ${client.name},`,
    "",
    `Thank you — we received your payment of ${amountPaidLabel} for invoice ${invoiceNumber}.`,
    `Paid on ${paidOnLabel} via ${methodLabel}.`,
    isPaidInFull
      ? "This invoice is paid in full."
      : `Remaining balance: ${formatCurrency(Math.max(remainingCentsAfter, 0), currency)}.`,
    "",
    "A PDF receipt is attached.",
    "",
    document.businessName,
  ].join("\n");

  const html = buildReceiptEmailHtml({
    clientName: client.name,
    businessName: document.businessName,
    invoiceNumber,
    amountPaidLabel,
    paidOnLabel,
    methodLabel,
    isPaidInFull,
    remainingLabel: formatCurrency(Math.max(remainingCentsAfter, 0), currency),
  });

  return sendClientReceiptEmail({
    businessName: document.businessName,
    replyTo: business.email,
    to,
    subject,
    text,
    html,
    filename: receiptPdfFilename(invoiceNumber),
    pdf: Buffer.from(pdf),
  });
}
