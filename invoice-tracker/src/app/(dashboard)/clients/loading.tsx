import { PageContainer } from "@/components/shared/page-container";

export default function ClientsLoading() {
  return (
    <PageContainer className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="border-t border-border" />
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      </div>
    </PageContainer>
  );
}
