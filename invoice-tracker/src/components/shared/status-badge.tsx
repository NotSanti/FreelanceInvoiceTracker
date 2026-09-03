import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/types/invoice";
import { cn } from "@/lib/utils";

const statusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  due_soon: "Due soon",
};

const statusClassName: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-secondary text-foreground/80",
  paid: "bg-positive/10 text-positive",
  overdue: "bg-negative/10 text-negative",
  void: "bg-muted text-muted-foreground",
  due_soon: "bg-warning/10 text-warning",
};

export function StatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("capitalize", statusClassName[status], className)}
    >
      {statusLabel[status]}
    </Badge>
  );
}
