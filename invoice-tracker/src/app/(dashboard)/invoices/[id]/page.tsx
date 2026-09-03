import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { duplicateInvoice, voidInvoice } from "@/app/(dashboard)/invoices/actions";
import { CopyPublicLinkButton } from "@/components/invoices/copy-public-link-button";
import { InvoiceDetailView } from "@/components/invoices/invoice-detail";
import { InvoiceEmailPreviewDialog } from "@/components/invoices/invoice-email-preview";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { ResendReceiptButton } from "@/components/invoices/resend-receipt-button";
import { SendInvoiceDialog } from "@/components/invoices/send-invoice-dialog";
import { VoidInvoiceButton } from "@/components/invoices/void-invoice-button";
import { PageContainer } from "@/components/shared/page-container";
import { Button } from "@/components/ui/button";
import { publicInvoiceUrl } from "@/lib/app-url";
import { getProfile } from "@/lib/auth/session";
import { formatISODateLong } from "@/lib/dates";
import { DEFAULT_FROM_EMAIL, formatFromAddress } from "@/lib/email/env";
import {
  canEditInvoice,
  canRecordPayment,
  canResendReceipt,
  canSendInvoice,
  canVoidInvoice,
} from "@/lib/invoice/status";
import { calculateBalanceRemaining } from "@/lib/invoice/totals";
import { getInvoice } from "@/lib/invoices/queries";
import { formatCurrency } from "@/lib/money/format";

export async function generateMetadata({
  params,
}: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoice(id);

  return {
    title: invoice?.invoice_number ?? "Invoice",
  };
}

export default async function InvoiceDetailPage({
  params,
}: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const [invoice, profile] = await Promise.all([getInvoice(id), getProfile()]);

  if (!invoice) {
    notFound();
  }

  const remainingCents = calculateBalanceRemaining(
    invoice.total_cents,
    invoice.paidCents,
  );
  const businessName = profile.business_name || profile.display_name;
  const publicUrl = publicInvoiceUrl(invoice.public_token);
  const emailPreview = {
    invoiceNumber: invoice.invoice_number,
    clientName: invoice.clients.name,
    clientEmail: invoice.clients.email,
    businessName,
    fromLabel: formatFromAddress(
      businessName,
      process.env.EMAIL_FROM?.trim() || DEFAULT_FROM_EMAIL,
    ),
    totalLabel: formatCurrency(
      remainingCents > 0 ? remainingCents : invoice.total_cents,
      invoice.currency,
    ),
    dueDateLabel: invoice.due_date ? formatISODateLong(invoice.due_date) : null,
    publicUrl,
  };

  return (
    <PageContainer className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/invoices/${invoice.id}/preview`}>Preview</Link>
        </Button>
        <InvoiceEmailPreviewDialog
          invoiceNumber={emailPreview.invoiceNumber}
          clientName={emailPreview.clientName}
          businessName={emailPreview.businessName}
          fromLabel={emailPreview.fromLabel}
          to={emailPreview.clientEmail}
          totalLabel={emailPreview.totalLabel}
          dueDateLabel={emailPreview.dueDateLabel}
          publicUrl={emailPreview.publicUrl}
        />
        <Button asChild variant="outline" size="sm">
          <a href={`/invoices/${invoice.id}/pdf`}>Download PDF</a>
        </Button>
        <CopyPublicLinkButton url={publicUrl} />
        <form action={duplicateInvoice}>
          <input type="hidden" name="id" value={invoice.id} />
          <Button type="submit" size="sm" variant="outline">
            Duplicate
          </Button>
        </form>
        {canRecordPayment(invoice.status, remainingCents) ? (
          <RecordPaymentDialog
            invoiceId={invoice.id}
            remainingCents={remainingCents}
            currency={invoice.currency}
          />
        ) : null}
        {canSendInvoice(invoice.status) ? (
          <SendInvoiceDialog
            invoiceId={invoice.id}
            invoiceNumber={emailPreview.invoiceNumber}
            clientName={emailPreview.clientName}
            clientEmail={emailPreview.clientEmail}
            businessName={emailPreview.businessName}
            fromLabel={emailPreview.fromLabel}
            totalLabel={emailPreview.totalLabel}
            dueDateLabel={emailPreview.dueDateLabel}
            publicUrl={emailPreview.publicUrl}
            isResend={invoice.status === "sent"}
          />
        ) : null}
        {canResendReceipt(invoice.status) ? (
          <ResendReceiptButton
            invoiceId={invoice.id}
            clientEmail={invoice.clients.email}
          />
        ) : null}
        {canEditInvoice(invoice.status) ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/invoices/${invoice.id}/edit`}>Edit</Link>
          </Button>
        ) : null}
        {canVoidInvoice(invoice.status) ? (
          <form action={voidInvoice}>
            <input type="hidden" name="id" value={invoice.id} />
            <VoidInvoiceButton invoiceNumber={invoice.invoice_number} />
          </form>
        ) : null}
        <Link
          href="/invoices"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          All invoices
        </Link>
      </div>
      <InvoiceDetailView invoice={invoice} />
    </PageContainer>
  );
}
