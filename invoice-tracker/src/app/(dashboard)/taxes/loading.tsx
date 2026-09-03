import { PageContainer } from "@/components/shared/page-container";

export default function TaxesLoading() {
  return (
    <PageContainer className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="border-t border-border" />
      <div className="h-12 w-48 animate-pulse rounded-md bg-muted" />
    </PageContainer>
  );
}
