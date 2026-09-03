"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";

export default function ClientsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <PageContainer className="space-y-8">
      <PageHeader title="Clients" description="Save recipients so invoicing stays fast." />
      <div className="border-t border-border" />
      <EmptyState
        title="Clients could not be loaded."
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
