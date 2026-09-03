import { describe, expect, it } from "vitest";

import { getTaxYearConfig } from "@/config/tax";
import { calculateTax } from "@/lib/invoice/totals";
import {
  estimatedIncomeTaxCents,
  estimatedSelfEmployedQppCents,
  taxOnBrackets,
} from "@/lib/tax/income-tax";

const config = getTaxYearConfig(2026);

describe("federal and Québec brackets", () => {
  it("applies the second federal rate after $58,523", () => {
    const atTop = estimatedIncomeTaxCents(5_852_300, config);
    const over = estimatedIncomeTaxCents(5_852_400, config);
    expect(over.federalCents - atTop.federalCents).toBe(calculateTax(100, 20.5));
  });

  it("applies the third federal rate after $117,045", () => {
    const atTop = taxOnBrackets(11_704_500, config.federalBrackets);
    const over = taxOnBrackets(11_704_600, config.federalBrackets);
    expect(over - atTop).toBe(calculateTax(100, 26));
  });

  it("applies the second Québec rate after $54,345", () => {
    const atTop = estimatedIncomeTaxCents(5_434_500, config);
    const over = estimatedIncomeTaxCents(5_434_600, config);
    expect(over.quebecCents - atTop.quebecCents).toBe(calculateTax(100, 19));
  });

  it("zeros income tax while income stays inside basic personal amounts", () => {
    const tax = estimatedIncomeTaxCents(360_000, config);
    expect(tax.federalCents).toBe(0);
    expect(tax.quebecCents).toBe(0);
  });
});

describe("self-employed QPP", () => {
  it("ignores income at the basic exemption", () => {
    expect(estimatedSelfEmployedQppCents(350_000, config)).toBe(0);
  });

  it("uses 12.6% between the exemption and YMPE", () => {
    expect(estimatedSelfEmployedQppCents(350_100, config)).toBe(calculateTax(100, 12.6));
  });

  it("uses 8% between YMPE and YAMPE", () => {
    const atYmpe = estimatedSelfEmployedQppCents(7_460_000, config);
    const over = estimatedSelfEmployedQppCents(7_460_100, config);
    expect(over - atYmpe).toBe(calculateTax(100, 8));
  });

  it("caps pensionable income at YAMPE", () => {
    const atYampe = estimatedSelfEmployedQppCents(8_500_000, config);
    const over = estimatedSelfEmployedQppCents(9_000_000, config);
    expect(over).toBe(atYampe);
    expect(atYampe).toBe(
      calculateTax(7_110_000, 12.6) + calculateTax(1_040_000, 8),
    );
  });
});
