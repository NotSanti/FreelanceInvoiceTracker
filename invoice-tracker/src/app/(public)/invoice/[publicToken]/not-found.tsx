import { EmptyState } from "@/components/shared/empty-state";

export default function PublicInvoiceNotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <EmptyState
        title="Invoice not found"
        description="This link is invalid or the invoice is no longer available."
      />
    </div>
  );
}
