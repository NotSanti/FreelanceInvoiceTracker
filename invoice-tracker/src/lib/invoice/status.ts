import {
  calculateBalanceRemaining,
  paidCentsFromStoredStatus,
} from "@/lib/invoice/totals";
import type { DisplayInvoiceStatus, StoredInvoiceStatus } from "@/types/invoice";

export function getDisplayStatus({
  status,
  dueDate,
  totalCents,
  paidCents,
  today,
}: {
  status: StoredInvoiceStatus;
  dueDate: string | null;
  totalCents: number;
  paidCents?: number;
  today: string;
}): DisplayInvoiceStatus {
  if (status !== "sent") {
    return status;
  }

  const remainingCents = calculateBalanceRemaining(
    totalCents,
    paidCents ?? paidCentsFromStoredStatus(status, totalCents),
  );

  if (dueDate && remainingCents > 0 && dueDate < today) {
    return "overdue";
  }

  return "sent";
}

export function canEditInvoice(status: StoredInvoiceStatus) {
  return status === "draft" || status === "sent";
}

export function canSendInvoice(status: StoredInvoiceStatus) {
  return status === "draft" || status === "sent";
}

export function canVoidInvoice(status: StoredInvoiceStatus) {
  return status === "draft" || status === "sent";
}

export function canRecordPayment(status: StoredInvoiceStatus, remainingCents: number) {
  return remainingCents > 0 && status !== "void" && status !== "draft";
}

export function canResendReceipt(status: StoredInvoiceStatus) {
  return status === "paid";
}
