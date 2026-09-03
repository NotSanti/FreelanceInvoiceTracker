"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function InvoicePreviewToolbar({
  invoiceId,
}: {
  invoiceId: string;
}) {
  return (
    <header className="document-toolbar flex items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-8">
      <Link
        href={`/invoices/${invoiceId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Back to invoice
      </Link>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.print()}
        >
          Print
        </Button>
        <Button asChild size="sm">
          <a href={`/invoices/${invoiceId}/pdf`}>Download PDF</a>
        </Button>
      </div>
    </header>
  );
}
