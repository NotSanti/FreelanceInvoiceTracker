import type { Metadata } from "next";
import Link from "next/link";

import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { getTaxYearConfig } from "@/config/tax";
import { getProfile } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/queries";
import { todayISODate } from "@/lib/dates";
import { formatInvoiceNumber } from "@/lib/invoice/number";
import { defaultInvoiceTaxName, defaultInvoiceTaxRate } from "@/lib/tax/sales-tax";

export const metadata: Metadata = {
  title: "New invoice",
};

export default async function NewInvoicePage() {
  const [clients, profile] = await Promise.all([listClients(), getProfile()]);
  const issueDate = todayISODate();
  const taxConfig = getTaxYearConfig(Number(issueDate.slice(0, 4)));
  const taxRate = !profile.taxes_enabled
    ? ""
    : profile.default_tax_rate === null || profile.default_tax_rate === undefined
      ? profile.is_gst_qst_registered
        ? defaultInvoiceTaxRate(true, taxConfig)
        : ""
      : String(Number(profile.default_tax_rate));
  const taxName = !profile.taxes_enabled
    ? ""
    : profile.default_tax_name ||
      (profile.is_gst_qst_registered ? defaultInvoiceTaxName(true) : "");

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="New invoice"
        description="Save a draft when the numbers look right."
        actions={
          <Link
            href="/invoices"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        }
      />

      <div className="border-t border-border" />

      <InvoiceEditor
        mode="create"
        clients={clients}
        showTaxFields={profile.taxes_enabled}
        defaults={{
          invoiceNumber: formatInvoiceNumber(
            profile.invoice_prefix,
            profile.next_invoice_number,
          ),
          clientId: "",
          issueDate,
          dueDate: "",
          currency: profile.default_currency,
          taxName,
          taxRate,
          discount: "",
          notes: "",
          paymentInstructions: profile.payment_instructions ?? "",
          items: [{ description: "", quantity: "1", rate: "" }],
        }}
      />
    </PageContainer>
  );
}
