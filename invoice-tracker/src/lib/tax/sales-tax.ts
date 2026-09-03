import {
  combinedSalesTaxRate,
  getTaxYearConfig,
  ratesMatchCombinedQc,
  type TaxYearConfig,
} from "@/config/tax";
import { calculateTax } from "@/lib/invoice/totals";

export type SplitSalesTax = {
  taxableSubtotalCents: number;
  gstRate: number | null;
  gstCents: number;
  qstRate: number | null;
  qstCents: number;
};

export function splitSalesTax({
  taxableSubtotalCents,
  taxRatePercent,
  taxCents,
  config,
}: {
  taxableSubtotalCents: number;
  taxRatePercent: number | null;
  taxCents: number;
  config: TaxYearConfig;
}): SplitSalesTax {
  if (
    taxCents > 0 &&
    ratesMatchCombinedQc(taxRatePercent, config)
  ) {
    const gstCents = calculateTax(taxableSubtotalCents, config.gstRate);
    return {
      taxableSubtotalCents,
      gstRate: config.gstRate,
      gstCents,
      qstRate: config.qstRate,
      qstCents: taxCents - gstCents,
    };
  }

  return {
    taxableSubtotalCents,
    gstRate: null,
    gstCents: 0,
    qstRate: null,
    qstCents: 0,
  };
}

export function defaultInvoiceTaxRate(
  isGstQstRegistered: boolean,
  config: TaxYearConfig,
) {
  return isGstQstRegistered ? String(combinedSalesTaxRate(config)) : "";
}

export function defaultInvoiceTaxName(isGstQstRegistered: boolean) {
  return isGstQstRegistered ? "GST/QST" : "";
}

export function invoiceSalesTaxFromTotals({
  issueDate,
  subtotalCents,
  discountCents,
  taxRatePercent,
  taxCents,
}: {
  issueDate: string;
  subtotalCents: number;
  discountCents: number;
  taxRatePercent: number | null;
  taxCents: number;
}) {
  return splitSalesTax({
    taxableSubtotalCents: subtotalCents - discountCents,
    taxRatePercent,
    taxCents,
    config: getTaxYearConfig(Number(issueDate.slice(0, 4))),
  });
}
