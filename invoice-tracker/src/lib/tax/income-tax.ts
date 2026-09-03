import { calculateTax } from "@/lib/invoice/totals";
import type { TaxBracket, TaxYearConfig } from "@/config/tax";

export function taxOnBrackets(incomeCents: number, brackets: TaxBracket[]) {
  if (incomeCents <= 0) {
    return 0;
  }

  let taxedThrough = 0;
  let taxCents = 0;

  for (const bracket of brackets) {
    const ceiling = bracket.upToCents ?? Number.MAX_SAFE_INTEGER;
    const sliceCents = Math.min(incomeCents, ceiling) - taxedThrough;
    if (sliceCents > 0) {
      taxCents += calculateTax(sliceCents, bracket.ratePercent);
      taxedThrough += sliceCents;
    }
    if (taxedThrough >= incomeCents) {
      break;
    }
  }

  return taxCents;
}

export function personalAmountCredit(
  taxableIncomeCents: number,
  basicPersonalAmountCents: number,
  creditRatePercent: number,
) {
  const eligibleCents = Math.min(Math.max(taxableIncomeCents, 0), basicPersonalAmountCents);
  return calculateTax(eligibleCents, creditRatePercent);
}

export function estimatedIncomeTaxCents(
  taxableIncomeCents: number,
  config: TaxYearConfig,
) {
  const federal = Math.max(
    taxOnBrackets(taxableIncomeCents, config.federalBrackets) -
      personalAmountCredit(
        taxableIncomeCents,
        config.federalBasicPersonalAmountCents,
        config.personalCreditRatePercent,
      ),
    0,
  );
  const quebec = Math.max(
    taxOnBrackets(taxableIncomeCents, config.quebecBrackets) -
      personalAmountCredit(
        taxableIncomeCents,
        config.quebecBasicPersonalAmountCents,
        config.personalCreditRatePercent,
      ),
    0,
  );

  return { federalCents: federal, quebecCents: quebec, totalCents: federal + quebec };
}

export function estimatedSelfEmployedQppCents(
  netBusinessIncomeCents: number,
  config: TaxYearConfig,
) {
  const { qpp } = config;
  const pensionableCents = Math.min(Math.max(netBusinessIncomeCents, 0), qpp.yampeCents);
  const firstBandCents = Math.min(
    Math.max(pensionableCents - qpp.basicExemptionCents, 0),
    qpp.ympeCents - qpp.basicExemptionCents,
  );
  const secondBandCents = Math.min(
    Math.max(pensionableCents - qpp.ympeCents, 0),
    qpp.yampeCents - qpp.ympeCents,
  );
  const firstRate = qpp.selfEmployedBaseRatePercent + qpp.selfEmployedAdditionalRatePercent;

  return (
    calculateTax(firstBandCents, firstRate) +
    calculateTax(secondBandCents, qpp.selfEmployedSecondAdditionalRatePercent)
  );
}
