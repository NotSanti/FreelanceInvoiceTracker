import { calculateBalanceRemaining } from "@/lib/invoice/totals";

export type PaymentAmount = {
  amountCents: number;
};

export function paidCentsFromPayments(payments: PaymentAmount[]) {
  return payments.reduce((sum, payment) => sum + payment.amountCents, 0);
}

export function remainingCentsFromPayments(totalCents: number, payments: PaymentAmount[]) {
  return calculateBalanceRemaining(totalCents, paidCentsFromPayments(payments));
}

export function isInvoiceFullyPaid(totalCents: number, payments: PaymentAmount[]) {
  return remainingCentsFromPayments(totalCents, payments) === 0 && totalCents > 0;
}
