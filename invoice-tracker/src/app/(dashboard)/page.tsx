import type { Metadata } from "next";
import Link from "next/link";

import { AttentionList, RecentInvoiceList } from "@/components/dashboard/dashboard-invoice-lists";
import { IncomeChart } from "@/components/dashboard/income-chart";
import { InvoiceStatusChart } from "@/components/dashboard/invoice-status-chart";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import { ReceivedProjectedGauge } from "@/components/dashboard/received-projected-gauge";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { MoneyValue } from "@/components/shared/money-value";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardOverview } from "@/lib/dashboard/queries";
import { readDashboardPeriod } from "@/lib/dashboard/period";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function OverviewPage({
  searchParams,
}: PageProps<"/">) {
  const params = await searchParams;
  const periodKind = readDashboardPeriod(params.period);
  const dashboard = await getDashboardOverview(periodKind);
  const periodPhrase =
    dashboard.period.kind === "year" ? "this year" : "this month";

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        title="Overview"
        description={dashboard.period.label}
        actions={<PeriodToggle period={dashboard.period.kind} />}
      />

      <ReceivedProjectedGauge
        receivedCents={dashboard.metrics.receivedCents}
        projectedNetCents={dashboard.metrics.projectedNetCents}
        currency={dashboard.currency}
      />

      <section aria-labelledby="projected-net-heading">
        <p className="tabular-nums">
          <MoneyValue
            amountCents={dashboard.metrics.projectedNetCents}
            currency={dashboard.currency}
            size="hero"
          />
        </p>
        <div className="mt-2 flex items-center gap-0.5">
          <h2
            id="projected-net-heading"
            className="text-sm text-muted-foreground"
          >
            Projected net income
          </h2>
          <HelpTooltip
            content={`Estimate from payments received and unpaid invoices due ${periodPhrase}.`}
          />
        </div>
      </section>

      <div className="border-t border-border" />

      <section
        aria-label="Income summary"
        className="grid gap-8 sm:grid-cols-2"
      >
        <SummaryStat
          label="Received"
          amountCents={dashboard.metrics.receivedCents}
          currency={dashboard.currency}
        />
        <SummaryStat
          label="Outstanding"
          amountCents={dashboard.metrics.outstandingCents}
          currency={dashboard.currency}
        />
      </section>

      <div className="border-t border-border" />

      <section
        aria-label="Tax reserve"
        className={
          dashboard.tax.isGstQstRegistered
            ? "grid gap-8 sm:grid-cols-2"
            : "grid gap-8"
        }
      >
        <div>
          <MoneyValue
            amountCents={dashboard.tax.incomeTaxReserveCents}
            currency={dashboard.currency}
            size="lg"
          />
          <p className="mt-2 text-sm text-muted-foreground">Estimated tax reserve</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href="/taxes" className="underline-offset-4 hover:underline">
              View taxes
            </Link>
          </p>
        </div>
        {dashboard.tax.isGstQstRegistered ? (
          <div>
            <MoneyValue
              amountCents={dashboard.tax.gstQstReserveCents}
              currency={dashboard.currency}
              size="lg"
            />
            <p className="mt-2 text-sm text-muted-foreground">GST/QST to set aside</p>
          </div>
        ) : null}
      </section>

      <div className="border-t border-border" />

      <section
        aria-label="Charts"
        className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.85fr)]"
      >
        <Card>
          <CardHeader>
            <CardTitle>Income overview</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeChart months={dashboard.chart} currency={dashboard.currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice status</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceStatusChart statuses={dashboard.invoiceStatus} />
          </CardContent>
        </Card>
      </section>

      {dashboard.hasInvoices ? (
        <>
          <div className="border-t border-border" />
          <AttentionList
            invoices={dashboard.attention}
            currency={dashboard.currency}
          />
          <div className="border-t border-border" />
          <RecentInvoiceList
            invoices={dashboard.recent}
            currency={dashboard.currency}
          />
        </>
      ) : (
        <>
          <div className="border-t border-border" />
          <EmptyState
            title="Your finances will appear here."
            description="Create your first invoice to start tracking income."
            action={
              <Button asChild>
                <Link href="/invoices/new">Create invoice</Link>
              </Button>
            }
          />
        </>
      )}
    </PageContainer>
  );
}

function SummaryStat({
  label,
  amountCents,
  currency,
}: {
  label: string;
  amountCents: number;
  currency: string;
}) {
  return (
    <div>
      <MoneyValue amountCents={amountCents} currency={currency} size="lg" />
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
