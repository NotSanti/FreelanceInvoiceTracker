import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ClientList } from "@/components/clients/client-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { listClients } from "@/lib/clients/queries";

export const metadata: Metadata = {
  title: "Clients",
};

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Clients"
        description="Save recipients so invoicing stays fast."
        actions={
          <Button asChild size="sm">
            <Link href="/clients/new">
              <Plus />
              New client
            </Link>
          </Button>
        }
      />

      <div className="border-t border-border" />

      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet."
          description="Clients make it faster to create and send invoices."
          action={
            <Button asChild>
              <Link href="/clients/new">Add your first client</Link>
            </Button>
          }
        />
      ) : (
        <ClientList clients={clients} />
      )}
    </PageContainer>
  );
}
