import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default function ClientNotFound() {
  return (
    <PageContainer className="space-y-8">
      <PageHeader title="Client" />
      <div className="border-t border-border" />
      <EmptyState
        title="This client could not be found."
        description="It may have been deleted, or the link may be incorrect."
        action={
          <Button asChild>
            <Link href="/clients">Back to clients</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
