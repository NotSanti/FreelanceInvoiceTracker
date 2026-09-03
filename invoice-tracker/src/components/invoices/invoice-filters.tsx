import Link from "next/link";

import { Input } from "@/components/ui/input";
import { INVOICE_LIST_FILTERS, type InvoiceListFilter } from "@/config/invoices";
import { cn } from "@/lib/utils";

export function InvoiceFilters({
  status,
  query,
}: {
  status: InvoiceListFilter;
  query: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Invoice status" className="flex flex-wrap gap-1">
        {INVOICE_LIST_FILTERS.map((filter) => {
          const params = new URLSearchParams();
          if (filter.value !== "all") {
            params.set("status", filter.value);
          }
          if (query) {
            params.set("q", query);
          }
          const href = params.toString() ? `/invoices?${params}` : "/invoices";
          const current = filter.value === status;

          return (
            <Link
              key={filter.value}
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                current && "bg-secondary text-foreground",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <form action="/invoices" className="sm:w-64">
        {status !== "all" ? (
          <input type="hidden" name="status" value={status} />
        ) : null}
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search invoices"
          aria-label="Search invoices"
        />
      </form>
    </div>
  );
}
