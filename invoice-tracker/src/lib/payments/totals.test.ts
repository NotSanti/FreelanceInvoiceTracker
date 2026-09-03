import { describe, expect, it } from "vitest";

import { receivedCents, remainingInvoiceCents } from "@/lib/dashboard/metrics";
import {
  isInvoiceFullyPaid,
  remainingCentsFromPayments,
} from "@/lib/payments/totals";

const invoice = {
  id: "1",
  invoiceNumber: "INV-001",
  clientLabel: "Atelier",
  status: "sent" as const,
  displayStatus: "sent" as const,
  issueDate: "2026-08-01",
  dueDate: "2026-08-15",
  paidOn: null,
  totalCents: 210_000,
  paidCents: 100_000,
  payments: [{ amountCents: 100_000, paidOn: "2026-08-30" }],
};

describe("payments", () => {
  it("keeps a remaining balance after a partial payment", () => {
    expect(remainingCentsFromPayments(210_000, [{ amountCents: 100_000 }])).toBe(110_000);
    expect(remainingInvoiceCents(invoice)).toBe(110_000);
    expect(isInvoiceFullyPaid(210_000, [{ amountCents: 100_000 }])).toBe(false);
  });

  it("marks an invoice fully paid when payments cover the total", () => {
    expect(
      isInvoiceFullyPaid(210_000, [{ amountCents: 100_000 }, { amountCents: 110_000 }]),
    ).toBe(true);
  });

  it("attributes received income to the payment date, not the issue date", () => {
    expect(
      receivedCents([invoice], { start: "2026-08-01", end: "2026-08-31" }),
    ).toBe(100_000);
    expect(
      receivedCents([invoice], { start: "2026-08-01", end: "2026-08-15" }),
    ).toBe(0);
  });
});
