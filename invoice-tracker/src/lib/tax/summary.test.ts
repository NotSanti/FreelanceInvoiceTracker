import { describe, expect, it } from "vitest";

import { buildTaxCentreSummary, type InvoiceTaxInput } from "@/lib/tax/summary";

const invoices: InvoiceTaxInput[] = [
  {
    status: "sent",
    issueDate: "2026-03-01",
    taxableSubtotalCents: 2_000_000,
    gstCents: 100_000,
    qstCents: 199_500,
  },
];

describe("tax centre summary", () => {
  it("keeps an income-tax reserve for an unregistered small supplier", () => {
    const summary = buildTaxCentreSummary({
      year: 2026,
      invoices,
      isGstQstRegistered: false,
      asOfDate: "2026-09-01",
    });

    expect(summary.grossBusinessRevenueCents).toBe(2_000_000);
    expect(summary.netBusinessIncomeCents).toBe(2_000_000);
    expect(summary.gstCollectedCents).toBe(0);
    expect(summary.gstQstReserveCents).toBe(0);
    expect(summary.incomeTaxReserveCents).toBeGreaterThan(0);
    expect(summary.smallSupplier.isSmallSupplier).toBe(true);
  });

  it("tracks GST/QST for a voluntarily registered small supplier", () => {
    const summary = buildTaxCentreSummary({
      year: 2026,
      invoices,
      isGstQstRegistered: true,
      asOfDate: "2026-09-01",
    });

    expect(summary.gstCollectedCents).toBe(100_000);
    expect(summary.qstCollectedCents).toBe(199_500);
    expect(summary.gstPayableCents).toBe(100_000);
    expect(summary.qstPayableCents).toBe(199_500);
    expect(summary.gstQstReserveCents).toBe(299_500);
    expect(summary.smallSupplier.isSmallSupplier).toBe(true);
  });

  it("ignores draft invoices for tax revenue", () => {
    const summary = buildTaxCentreSummary({
      year: 2026,
      invoices: [
        {
          status: "draft",
          issueDate: "2026-03-01",
          taxableSubtotalCents: 9_000_000,
          gstCents: 0,
          qstCents: 0,
        },
      ],
      isGstQstRegistered: false,
      asOfDate: "2026-09-01",
    });

    expect(summary.grossBusinessRevenueCents).toBe(0);
  });
});
