import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientForm } from "@/components/clients/client-form";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { getClient } from "@/lib/clients/queries";

export async function generateMetadata({
  params,
}: PageProps<"/clients/[id]">): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);

  return {
    title: client?.name ?? "Client",
  };
}

export default async function ClientDetailPage({
  params,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) {
    notFound();
  }

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title={client.name}
        description={client.company_name || client.email}
        actions={
          <Link
            href="/clients"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            All clients
          </Link>
        }
      />

      <div className="border-t border-border" />

      <ClientForm client={client} />

      <div className="border-t border-border" />

      <section className="space-y-3">
        <h2 className="text-base font-medium">Delete</h2>
        <p className="text-sm text-muted-foreground">
          This recipient will be removed from your list.
        </p>
        <DeleteClientButton clientId={client.id} clientName={client.name} />
      </section>
    </PageContainer>
  );
}
