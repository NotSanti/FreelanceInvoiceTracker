import { buildInvoiceEmailHtml } from "@/lib/email/invoice-email-template";
import { defaultInvoiceEmail } from "@/lib/invoice/email";

export type InvoiceEmailPreviewFields = {
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  totalLabel: string;
  dueDateLabel: string | null;
  publicUrl?: string;
  subject?: string;
  message?: string;
};

export function buildInvoiceEmailPreview({
  subject,
  message,
  ...template
}: InvoiceEmailPreviewFields) {
  const defaults = defaultInvoiceEmail({
    clientName: template.clientName,
    invoiceNumber: template.invoiceNumber,
    businessName: template.businessName,
    publicUrl: template.publicUrl,
  });
  const resolvedMessage = message?.trim() ? message : defaults.message;

  return {
    subject: subject?.trim() ? subject : defaults.subject,
    html: buildInvoiceEmailHtml({
      ...template,
      message: resolvedMessage,
    }),
  };
}
