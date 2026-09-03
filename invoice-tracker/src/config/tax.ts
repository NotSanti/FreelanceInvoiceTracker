export type TaxBracket = {
  upToCents: number | null;
  ratePercent: number;
};

export type QppConfig = {
  basicExemptionCents: number;
  ympeCents: number;
  yampeCents: number;
  selfEmployedBaseRatePercent: number;
  selfEmployedAdditionalRatePercent: number;
  selfEmployedSecondAdditionalRatePercent: number;
};

export type TaxYearConfig = {
  year: number;
  jurisdiction: "QC";
  gstRate: number;
  qstRate: number;
  smallSupplierThresholdCents: number;
  approachingThresholdRatio: number;
  federalBrackets: TaxBracket[];
  quebecBrackets: TaxBracket[];
  federalBasicPersonalAmountCents: number;
  quebecBasicPersonalAmountCents: number;
  personalCreditRatePercent: number;
  qpp: QppConfig;
  sources: readonly string[];
};

const QC_2026: TaxYearConfig = {
  year: 2026,
  jurisdiction: "QC",
  gstRate: 5,
  qstRate: 9.975,
  smallSupplierThresholdCents: 3_000_000,
  approachingThresholdRatio: 0.8,
  // CRA, "Current year tax rates and income brackets (2026)":
  // https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html
  // Retrieved 2026-09-01.
  federalBrackets: [
    { upToCents: 5_852_300, ratePercent: 14 },
    { upToCents: 11_704_500, ratePercent: 20.5 },
    { upToCents: 18_144_000, ratePercent: 26 },
    { upToCents: 25_848_200, ratePercent: 29 },
    { upToCents: null, ratePercent: 33 },
  ],
  // Revenu Québec, "Income Tax Rates" for the 2026 taxation year:
  // https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/
  // Retrieved 2026-09-01.
  quebecBrackets: [
    { upToCents: 5_434_500, ratePercent: 14 },
    { upToCents: 10_868_000, ratePercent: 19 },
    { upToCents: 13_224_500, ratePercent: 24 },
    { upToCents: null, ratePercent: 25.75 },
  ],
  // CRA 2026 maximum basic personal amount.
  federalBasicPersonalAmountCents: 1_645_200,
  // Revenu Québec / Finance Québec indexed 2026 basic personal amount.
  quebecBasicPersonalAmountCents: 1_895_200,
  personalCreditRatePercent: 14,
  // Retraite Québec, "Québec Pension Plan Figures" for 2026:
  // https://www.retraitequebec.gouv.qc.ca/en/programs/quebec-pension-plan/quebec-pension-plan-figures
  // Retrieved 2026-09-01. Self-employed workers pay both shares.
  qpp: {
    basicExemptionCents: 350_000,
    ympeCents: 7_460_000,
    yampeCents: 8_500_000,
    selfEmployedBaseRatePercent: 10.6,
    selfEmployedAdditionalRatePercent: 2,
    selfEmployedSecondAdditionalRatePercent: 8,
  },
  sources: [
    "https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html",
    "https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/",
    "https://www.retraitequebec.gouv.qc.ca/en/programs/quebec-pension-plan/quebec-pension-plan-figures",
  ],
};

const TAX_YEARS: Record<number, TaxYearConfig> = {
  2026: QC_2026,
};

export function isConfiguredTaxYear(year: number) {
  return Object.hasOwn(TAX_YEARS, year);
}

export function getTaxYearConfig(year: number): TaxYearConfig {
  return TAX_YEARS[year] ?? { ...QC_2026, year };
}

export function combinedSalesTaxRate(config: TaxYearConfig) {
  return config.gstRate + config.qstRate;
}

export function ratesMatchCombinedQc(
  taxRatePercent: number | null,
  config: TaxYearConfig,
) {
  if (taxRatePercent === null) {
    return false;
  }
  return Math.abs(taxRatePercent - combinedSalesTaxRate(config)) < 0.001;
}
