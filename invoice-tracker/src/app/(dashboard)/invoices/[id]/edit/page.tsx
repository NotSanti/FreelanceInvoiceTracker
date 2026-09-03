import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/queries";
import { formatCentsForInput } from "@/lib/money/parse";
import { canEditInvoice } from "@/lib/invoice/status";
import { getInvoice } from "@/lib/invoices/queries";

export async function generateMetadata({
  params,
}: PageProps<"/invoices/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoice(id);

  return {
    title: invoice ? `Edit ${invoice.invoice_number}` : "Edit invoice",
  };
}

export default async function EditInvoicePage({
  params,
}: PageProps<"/invoices/[id]/edit">) {
  const { id } = await params;
  const [invoice, clients, profile] = await Promise.all([
    getInvoice(id),
    listClients(),
    getProfile(),
  ]);

  if (!invoice) {
    notFound();
  }

  if (!canEditInvoice(invoice.status)) {
    return (
      <PageContainer className="space-y-8">
        <PageHeader title={invoice.invoice_number} />
        <div className="border-t border-border" />
        <EmptyState
          title="This invoice cannot be edited."
          description="Paid and voided invoices are kept as a record."
          action={
            <Button asChild>
              <Link href={`/invoices/${invoice.id}`}>Back to invoice</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const taxRate =
    invoice.tax_rate === null || invoice.tax_rate === undefined
      ? ""
      : String(Number(invoice.tax_rate));
  const invoiceHasTax =
    Boolean(invoice.tax_name) ||
    (invoice.tax_rate !== null && invoice.tax_rate !== undefined) ||
    invoice.tax_cents > 0;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title={`Edit ${invoice.invoice_number}`}
        description="Save a draft when the numbers look right."
        actions={
          <Link
            href={`/invoices/${invoice.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        }
      />

      <div className="border-t border-border" />

      <InvoiceEditor
        mode="edit"
        clients={clients}
        showTaxFields={profile.taxes_enabled || invoiceHasTax}
        defaults={{
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          clientId: invoice.client_id,
          issueDate: invoice.issue_date,
          dueDate: invoice.due_date ?? "",
          currency: invoice.currency,
          taxName: invoice.tax_name ?? "",
          taxRate,
          discount: formatCentsForInput(invoice.discount_cents),
          notes: invoice.notes ?? "",
          paymentInstructions: invoice.payment_instructions ?? "",
          items:
            invoice.invoice_items.length > 0
              ? invoice.invoice_items.map((item) => ({
                  description: item.description,
                  quantity: String(item.quantity),
                  rate: formatCentsForInput(item.unit_price_cents),
                }))
              : [{ description: "", quantity: "1", rate: "" }],
        }}
      />
    </PageContainer>
  );
}
