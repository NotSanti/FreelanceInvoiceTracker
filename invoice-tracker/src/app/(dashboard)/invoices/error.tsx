"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";

export default function InvoicesError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Invoices"
        description="Create, send, and track what you are owed."
      />
      <div className="border-t border-border" />
      <EmptyState
        title="Invoices could not be loaded."
        description={error.message || "Something went wrong. Try again."}
        action={
          <Button type="button" onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </PageContainer>
  );
}
