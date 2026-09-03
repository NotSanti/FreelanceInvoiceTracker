import type { Metadata } from "next";
import Link from "next/link";

import { YearToggle } from "@/components/taxes/year-toggle";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { MoneyValue } from "@/components/shared/money-value";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/money/format";
import { availableTaxYears, currentTaxYear, readTaxYear } from "@/lib/tax/period";
import { getTaxCentrePage } from "@/lib/tax/queries";
import type { TaxCentreSummary } from "@/lib/tax/summary";

export const metadata: Metadata = {
  title: "Taxes",
};

export default async function TaxesPage({
  searchParams,
}: PageProps<"/taxes">) {
  const params = await searchParams;
  const year = readTaxYear(params.year);
  const years = availableTaxYears();
  const { summary } = await getTaxCentrePage(year);

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        title="Taxes"
        description={`${year} tax year`}
        actions={<YearToggle year={year} years={years} />}
      />

      <section aria-labelledby="net-income-heading">
        <p className="tabular-nums">
          <MoneyValue
            amountCents={summary.netBusinessIncomeCents}
            currency={summary.currency}
            size="hero"
          />
        </p>
        <div className="mt-2 flex items-center gap-0.5">
          <h2
            id="net-income-heading"
            className="text-sm text-muted-foreground"
          >
            Estimated net business income
          </h2>
          <HelpTooltip
            content={`Based on invoices recorded for ${year}. Use it as a simple planning estimate of what you may need to set aside.`}
          />
        </div>
        {summary.usesFallbackConfig ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {year} uses the 2026 Québec configuration until a dedicated year is published.
          </p>
        ) : null}
        {year !== currentTaxYear() ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Showing {year}. Current tax year is {currentTaxYear()}.
          </p>
        ) : null}
      </section>

      <div className="border-t border-border" />

      <section aria-labelledby="income-heading" className="space-y-4">
        <h2 id="income-heading" className="text-base font-medium">
          Business income
        </h2>
        <SummaryRows
          currency={summary.currency}
          rows={[
            ["Gross business revenue", summary.grossBusinessRevenueCents],
            ["Estimated net business income", summary.netBusinessIncomeCents],
          ]}
        />
      </section>

      {summary.isGstQstRegistered ? (
        <>
          <div className="border-t border-border" />
          <SalesTaxSection summary={summary} />
          <div className="border-t border-border" />
          <SmallSupplierSection summary={summary} />
        </>
      ) : null}

      <div className="border-t border-border" />

      <section aria-labelledby="reserves-heading" className="space-y-4">
        <h2 id="reserves-heading" className="text-base font-medium">
          Estimated tax reserve
        </h2>
        <SummaryRows
          currency={summary.currency}
          rows={
            summary.isGstQstRegistered
              ? [
                  ["Income tax / QPP", summary.incomeTaxReserveCents],
                  ["GST/QST remittance", summary.gstQstReserveCents],
                  ["Suggested total reserve", summary.suggestedReserveCents],
                ]
              : [
                  ["Income tax / QPP", summary.incomeTaxReserveCents],
                  ["Suggested total reserve", summary.suggestedReserveCents],
                ]
          }
        />
      </section>

      {summary.isGstQstRegistered ? (
        <p className="text-sm text-muted-foreground">
          GST/QST registration is managed in{" "}
          <Link href="/settings" className="underline-offset-4 hover:underline">
            Settings
          </Link>
          .
        </p>
      ) : null}
    </PageContainer>
  );
}

function SalesTaxSection({ summary }: { summary: TaxCentreSummary }) {
  return (
    <section aria-labelledby="sales-tax-heading" className="space-y-4">
      <h2 id="sales-tax-heading" className="text-base font-medium">
        Sales taxes
      </h2>
      <SummaryRows
        currency={summary.currency}
        rows={[
          ["GST collected", summary.gstCollectedCents],
          ["Estimated GST payable", summary.gstPayableCents],
          ["QST collected", summary.qstCollectedCents],
          ["Estimated QST payable", summary.qstPayableCents],
        ]}
      />
    </section>
  );
}

function SmallSupplierSection({ summary }: { summary: TaxCentreSummary }) {
  const status = summary.smallSupplier;
  const remaining = formatCurrency(status.remainingBeforeThresholdCents, summary.currency);
  const rolling = formatCurrency(status.rollingFourQuarterTaxableSuppliesCents, summary.currency);
  const quarter = formatCurrency(status.currentQuarterTaxableSuppliesCents, summary.currency);
  const threshold = formatCurrency(status.thresholdCents, summary.currency);

  return (
    <section aria-labelledby="threshold-heading" className="space-y-3">
      <h2 id="threshold-heading" className="text-base font-medium">
        GST/QST registration threshold
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Based on taxable supplies recorded in this app, before GST/QST. This is a
        registration watch, not an income-tax exemption.
      </p>
      <dl className="max-w-md space-y-2 text-sm">
        <div className="flex justify-between gap-8">
          <dt className="text-muted-foreground">Rolling taxable supplies</dt>
          <dd className="tabular-nums">{rolling}</dd>
        </div>
        <div className="flex justify-between gap-8">
          <dt className="text-muted-foreground">This calendar quarter</dt>
          <dd className="tabular-nums">{quarter}</dd>
        </div>
        <div className="flex justify-between gap-8">
          <dt className="text-muted-foreground">Threshold</dt>
          <dd className="tabular-nums">{threshold}</dd>
        </div>
        <div className="flex justify-between gap-8">
          <dt className="text-muted-foreground">Remaining</dt>
          <dd className="tabular-nums">{remaining}</dd>
        </div>
      </dl>
      {status.isApproachingThreshold ? (
        <p className="text-sm text-muted-foreground">
          Approaching GST/QST registration threshold
        </p>
      ) : null}
      {status.thresholdExceededBy === "single_quarter" ? (
        <p className="text-sm text-muted-foreground">
          Tracked taxable supplies exceeded {threshold} in this calendar quarter.
          Review your GST/QST registration obligations.
        </p>
      ) : null}
      {status.thresholdExceededBy === "rolling_four_quarters" ? (
        <p className="text-sm text-muted-foreground">
          Tracked taxable supplies exceeded {threshold} across the applicable
          consecutive-quarter window. Review your GST/QST registration obligations.
        </p>
      ) : null}
    </section>
  );
}

function SummaryRows({
  currency,
  rows,
}: {
  currency: string;
  rows: Array<[string, number]>;
}) {
  return (
    <dl className="max-w-md space-y-2 text-sm">
      {rows.map(([label, amount]) => (
        <div key={label} className="flex justify-between gap-8">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{formatCurrency(amount, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}
