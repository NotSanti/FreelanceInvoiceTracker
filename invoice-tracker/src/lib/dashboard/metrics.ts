import {
  ATTENTION_LIMIT,
  DUE_SOON_DAYS,
  OLD_DRAFT_DAYS,
  RECENT_INVOICE_LIMIT,
} from "@/config/dashboard";
import { addDaysISO, endOfMonthISO, isDateInRange } from "@/lib/dates";
import {
  calculateBalanceRemaining,
} from "@/lib/invoice/totals";
import type { DisplayInvoiceStatus, StoredInvoiceStatus } from "@/types/invoice";
import type { DashboardPeriod } from "@/lib/dashboard/period";

export type InvoiceMetricInput = {
  id: string;
  invoiceNumber: string;
  clientLabel: string;
  status: StoredInvoiceStatus;
  displayStatus: DisplayInvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  paidOn: string | null;
  totalCents: number;
  paidCents: number;
  payments: Array<{ amountCents: number; paidOn: string }>;
};

export type AttentionReason = "overdue" | "due_soon" | "old_draft";

export type AttentionInvoice = InvoiceMetricInput & {
  reason: AttentionReason;
};

export type ChartMonth = {
  month: string;
  incomeCents: number;
  projectedIncomeCents: number;
};

export type InvoiceStatusBreakdownItem = {
  key: DisplayInvoiceStatus;
  label: string;
  count: number;
  color: string;
};

export type DashboardMetrics = {
  receivedCents: number;
  outstandingCents: number;
  expectedInvoiceCents: number;
  projectedNetCents: number;
};

export function remainingInvoiceCents(invoice: InvoiceMetricInput) {
  return calculateBalanceRemaining(invoice.totalCents, invoice.paidCents);
}

export function receivedCents(
  invoices: InvoiceMetricInput[],
  period: Pick<DashboardPeriod, "start" | "end">,
) {
  return invoices.reduce((sum, invoice) => {
    return (
      sum +
      invoice.payments.reduce((paid, payment) => {
        if (!isDateInRange(payment.paidOn, period.start, period.end)) {
          return paid;
        }
        return paid + payment.amountCents;
      }, 0)
    );
  }, 0);
}

export function outstandingCents(invoices: InvoiceMetricInput[]) {
  return invoices.reduce((sum, invoice) => {
    if (invoice.status !== "sent") {
      return sum;
    }
    return sum + remainingInvoiceCents(invoice);
  }, 0);
}

export function expectedInvoiceCents(
  invoices: InvoiceMetricInput[],
  period: Pick<DashboardPeriod, "start" | "end">,
) {
  return invoices.reduce((sum, invoice) => {
    if (invoice.status !== "sent" || !invoice.dueDate) {
      return sum;
    }
    if (!isDateInRange(invoice.dueDate, period.start, period.end)) {
      return sum;
    }
    return sum + remainingInvoiceCents(invoice);
  }, 0);
}

export function projectedNetCents({
  received,
  expectedInvoices,
}: {
  received: number;
  expectedInvoices: number;
}) {
  return received + expectedInvoices;
}

export function calculateDashboardMetrics({
  invoices,
  period,
}: {
  invoices: InvoiceMetricInput[];
  period: Pick<DashboardPeriod, "start" | "end">;
}): DashboardMetrics {
  const received = receivedCents(invoices, period);
  const expectedInvoices = expectedInvoiceCents(invoices, period);

  return {
    receivedCents: received,
    outstandingCents: outstandingCents(invoices),
    expectedInvoiceCents: expectedInvoices,
    projectedNetCents: projectedNetCents({
      received,
      expectedInvoices,
    }),
  };
}

export function buildIncomeChart({
  invoices,
  months,
}: {
  invoices: InvoiceMetricInput[];
  months: string[];
}): ChartMonth[] {
  return months.map((month) => {
    const range = { start: month, end: endOfMonthISO(month) };
    const income = receivedCents(invoices, range);
    const expectedInvoices = expectedInvoiceCents(invoices, range);
    return {
      month,
      incomeCents: income,
      projectedIncomeCents: projectedNetCents({
        received: income,
        expectedInvoices,
      }),
    };
  });
}

const STATUS_BREAKDOWN_ORDER: DisplayInvoiceStatus[] = [
  "paid",
  "sent",
  "overdue",
  "draft",
  "void",
];

const STATUS_BREAKDOWN_LABEL: Record<DisplayInvoiceStatus, string> = {
  paid: "Paid",
  sent: "Sent",
  overdue: "Overdue",
  draft: "Draft",
  void: "Void",
};

const STATUS_BREAKDOWN_COLOR: Record<DisplayInvoiceStatus, string> = {
  paid: "var(--positive)",
  sent: "var(--chart-2)",
  overdue: "var(--negative)",
  draft: "var(--chart-5)",
  void: "var(--muted-foreground)",
};

export function buildInvoiceStatusBreakdown(
  invoices: InvoiceMetricInput[],
): InvoiceStatusBreakdownItem[] {
  const counts: Record<DisplayInvoiceStatus, number> = {
    draft: 0,
    sent: 0,
    overdue: 0,
    paid: 0,
    void: 0,
  };

  for (const invoice of invoices) {
    counts[invoice.displayStatus] += 1;
  }

  return STATUS_BREAKDOWN_ORDER.flatMap((key) => {
    const count = counts[key];
    if (key === "void" && count === 0) {
      return [];
    }

    return [
      {
        key,
        label: STATUS_BREAKDOWN_LABEL[key],
        count,
        color: STATUS_BREAKDOWN_COLOR[key],
      },
    ];
  });
}

export function getAttentionReason(
  invoice: InvoiceMetricInput,
  today: string,
): AttentionReason | null {
  if (invoice.status === "sent" && remainingInvoiceCents(invoice) > 0) {
    if (!invoice.dueDate) {
      return null;
    }
    if (invoice.dueDate < today) {
      return "overdue";
    }
    if (invoice.dueDate <= addDaysISO(today, DUE_SOON_DAYS)) {
      return "due_soon";
    }
    return null;
  }

  if (
    invoice.status === "draft" &&
    invoice.issueDate <= addDaysISO(today, -OLD_DRAFT_DAYS)
  ) {
    return "old_draft";
  }

  return null;
}

const ATTENTION_ORDER: Record<AttentionReason, number> = {
  overdue: 0,
  due_soon: 1,
  old_draft: 2,
};

export function getInvoicesNeedingAttention(
  invoices: InvoiceMetricInput[],
  today: string,
): AttentionInvoice[] {
  return invoices
    .flatMap((invoice) => {
      const reason = getAttentionReason(invoice, today);
      return reason ? [{ ...invoice, reason }] : [];
    })
    .sort((a, b) => {
      const rank = ATTENTION_ORDER[a.reason] - ATTENTION_ORDER[b.reason];
      if (rank !== 0) {
        return rank;
      }
      if ((a.dueDate ?? "") !== (b.dueDate ?? "")) {
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      }
      return a.invoiceNumber.localeCompare(b.invoiceNumber);
    })
    .slice(0, ATTENTION_LIMIT);
}

export function getRecentInvoices(invoices: InvoiceMetricInput[]) {
  return [...invoices]
    .sort((a, b) => {
      if (a.issueDate !== b.issueDate) {
        return b.issueDate.localeCompare(a.issueDate);
      }
      return b.invoiceNumber.localeCompare(a.invoiceNumber);
    })
    .slice(0, RECENT_INVOICE_LIMIT);
}
