import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoiceDocumentView } from "@/components/invoices/invoice-document";
import { InvoicePreviewToolbar } from "@/components/invoices/invoice-preview-toolbar";
import { getProfile } from "@/lib/auth/session";
import { buildInvoiceDocument } from "@/lib/invoice/document";
import { getInvoice } from "@/lib/invoices/queries";

export async function generateMetadata({
  params,
}: PageProps<"/invoices/[id]/preview">): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoice(id);

  return {
    title: invoice ? `${invoice.invoice_number} preview` : "Invoice preview",
  };
}

export default async function InvoicePreviewPage({
  params,
}: PageProps<"/invoices/[id]/preview">) {
  const { id } = await params;
  const [invoice, profile] = await Promise.all([getInvoice(id), getProfile()]);

  if (!invoice) {
    notFound();
  }

  const document = buildInvoiceDocument(invoice, profile);

  return (
    <div className="min-h-full bg-background">
      <InvoicePreviewToolbar invoiceId={invoice.id} />
      <div className="invoice-sheet mx-auto max-w-[800px] bg-white px-6 py-10 shadow-sm md:my-8 md:px-12 md:py-14">
        <InvoiceDocumentView document={document} />
      </div>
    </div>
  );
}
