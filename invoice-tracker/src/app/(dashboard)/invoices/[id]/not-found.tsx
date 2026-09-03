import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default function InvoiceNotFound() {
  return (
    <PageContainer className="space-y-8">
      <PageHeader title="Invoice" />
      <div className="border-t border-border" />
      <EmptyState
        title="This invoice could not be found."
        description="It may have been deleted, or the link may be incorrect."
        action={
          <Button asChild>
            <Link href="/invoices">Back to invoices</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
