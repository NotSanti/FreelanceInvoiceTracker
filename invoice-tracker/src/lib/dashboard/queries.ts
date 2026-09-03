import { getProfile } from "@/lib/auth/session";
import { todayISODate, toAppISODate } from "@/lib/dates";
import {
  buildIncomeChart,
  buildInvoiceStatusBreakdown,
  calculateDashboardMetrics,
  getInvoicesNeedingAttention,
  getRecentInvoices,
  type InvoiceMetricInput,
} from "@/lib/dashboard/metrics";
import {
  resolveDashboardPeriod,
  type DashboardPeriodKind,
} from "@/lib/dashboard/period";
import { listInvoices, type InvoiceListItem } from "@/lib/invoices/queries";
import { currentTaxYear } from "@/lib/tax/period";
import { toInvoiceTaxInput } from "@/lib/tax/map";
import { buildTaxCentreSummary } from "@/lib/tax/summary";

function toInvoiceMetricInput(invoice: InvoiceListItem): InvoiceMetricInput {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientLabel: invoice.clients.company_name || invoice.clients.name,
    status: invoice.status,
    displayStatus: invoice.displayStatus,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    paidOn: invoice.paid_at
      ? toAppISODate(invoice.paid_at)
      : invoice.status === "paid"
        ? invoice.issue_date
        : null,
    totalCents: invoice.total_cents,
    paidCents: invoice.paidCents,
    payments: (invoice.payments ?? []).map((payment) => ({
      amountCents: payment.amount_cents,
      paidOn: payment.paid_on,
    })),
  };
}

export async function getDashboardOverview(periodKind: DashboardPeriodKind) {
  const year = currentTaxYear();
  const [invoices, profile] = await Promise.all([listInvoices(), getProfile()]);
  const today = todayISODate();
  const period = resolveDashboardPeriod(periodKind, today);
  const invoiceInputs = invoices.map(toInvoiceMetricInput);
  const taxSummary = buildTaxCentreSummary({
    year,
    invoices: invoices.map(toInvoiceTaxInput),
    isGstQstRegistered: Boolean(profile.is_gst_qst_registered),
    asOfDate: today,
    currency: profile.default_currency,
  });

  return {
    currency: profile.default_currency,
    hasInvoices: invoices.length > 0,
    period,
    metrics: calculateDashboardMetrics({
      invoices: invoiceInputs,
      period,
    }),
    chart: buildIncomeChart({
      invoices: invoiceInputs,
      months: period.chartMonths,
    }),
    invoiceStatus: buildInvoiceStatusBreakdown(invoiceInputs),
    attention: getInvoicesNeedingAttention(invoiceInputs, today),
    recent: getRecentInvoices(invoiceInputs),
    tax: {
      year,
      incomeTaxReserveCents: taxSummary.incomeTaxReserveCents,
      gstQstReserveCents: taxSummary.gstQstReserveCents,
      isGstQstRegistered: Boolean(profile.is_gst_qst_registered),
    },
  };
}
