import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  INVOICE_LIST_FILTERS,
  type InvoiceListFilter,
} from "@/config/invoices";
import { listInvoices } from "@/lib/invoices/queries";

export const metadata: Metadata = {
  title: "Invoices",
};

function readFilter(value: string | string[] | undefined): InvoiceListFilter {
  const status = Array.isArray(value) ? value[0] : value;
  return INVOICE_LIST_FILTERS.some((filter) => filter.value === status)
    ? (status as InvoiceListFilter)
    : "all";
}

function readQuery(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function InvoicesPage({
  searchParams,
}: PageProps<"/invoices">) {
  const params = await searchParams;
  const status = readFilter(params.status);
  const query = readQuery(params.q);
  const invoices = await listInvoices({ status, query });
  const hasFilters = status !== "all" || query.trim().length > 0;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Invoices"
        description="Create, send, and track what you are owed."
        actions={
          <Button asChild size="sm">
            <Link href="/invoices/new">
              <Plus />
              New invoice
            </Link>
          </Button>
        }
      />

      <div className="border-t border-border" />

      <InvoiceFilters status={status} query={query} />

      {invoices.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No invoices match this view." : "No invoices yet."}
          description={
            hasFilters
              ? "Try a different status or search."
              : "Create your first invoice and start tracking what you are owed."
          }
          action={
            hasFilters ? (
              <Button asChild variant="outline">
                <Link href="/invoices">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/invoices/new">Create invoice</Link>
              </Button>
            )
          }
        />
      ) : (
        <InvoiceList invoices={invoices} />
      )}
    </PageContainer>
  );
}
