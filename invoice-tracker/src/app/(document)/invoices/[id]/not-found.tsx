import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function InvoiceDocumentNotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Invoice</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This invoice could not be found.
      </p>
      <Button asChild className="mt-6">
        <Link href="/invoices">Back to invoices</Link>
      </Button>
    </div>
  );
}
