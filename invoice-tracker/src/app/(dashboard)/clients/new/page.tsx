import type { Metadata } from "next";
import Link from "next/link";

import { ClientForm } from "@/components/clients/client-form";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "New client",
};

export default function NewClientPage() {
  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="New client"
        description="Add a recipient you can reuse on invoices."
        actions={
          <Link
            href="/clients"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        }
      />

      <div className="border-t border-border" />

      <ClientForm />
    </PageContainer>
  );
}
