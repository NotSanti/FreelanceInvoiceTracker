import { describe, expect, it } from "vitest";

import { getTaxYearConfig } from "@/config/tax";
import { evaluateSmallSupplierStatus } from "@/lib/tax/small-supplier";

const thresholdCents = getTaxYearConfig(2026).smallSupplierThresholdCents;

describe("small-supplier threshold", () => {
  it("does not reset on January 1", () => {
    const status = evaluateSmallSupplierStatus({
      taxableSupplies: [
        { date: "2025-11-15", amountCents: 2_000_000 },
        { date: "2026-02-10", amountCents: 1_100_000 },
      ],
      asOfDate: "2026-03-01",
      thresholdCents,
    });

    expect(status.currentQuarterTaxableSuppliesCents).toBe(1_100_000);
    expect(status.rollingFourQuarterTaxableSuppliesCents).toBe(3_100_000);
    expect(status.thresholdExceededBy).toBe("rolling_four_quarters");
    expect(status.isSmallSupplier).toBe(false);
  });

  it("detects a single calendar quarter excess", () => {
    const status = evaluateSmallSupplierStatus({
      taxableSupplies: [{ date: "2026-08-20", amountCents: 3_100_000 }],
      asOfDate: "2026-09-01",
      thresholdCents,
    });

    expect(status.thresholdExceededBy).toBe("single_quarter");
    expect(status.estimatedRegistrationEffectiveDate).toBe("2026-10-01");
  });

  it("stays a small supplier below both windows", () => {
    const status = evaluateSmallSupplierStatus({
      taxableSupplies: [{ date: "2026-04-01", amountCents: 2_000_000 }],
      asOfDate: "2026-09-01",
      thresholdCents,
    });

    expect(status.isSmallSupplier).toBe(true);
    expect(status.thresholdExceededBy).toBe("none");
    expect(status.remainingBeforeThresholdCents).toBe(1_000_000);
  });

  it("flags the approaching threshold from rolling supplies", () => {
    const status = evaluateSmallSupplierStatus({
      taxableSupplies: [{ date: "2026-01-15", amountCents: 2_435_000 }],
      asOfDate: "2026-09-01",
      thresholdCents,
    });

    expect(status.isSmallSupplier).toBe(true);
    expect(status.isApproachingThreshold).toBe(true);
  });
});
