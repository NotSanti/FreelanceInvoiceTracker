import { endOfYearISO, isDateInRange, startOfYearISO } from "@/lib/dates";
import {
  estimatedIncomeTaxCents,
  estimatedSelfEmployedQppCents,
} from "@/lib/tax/income-tax";
import {
  evaluateSmallSupplierStatus,
  type SmallSupplierStatus,
  type TaxableSupply,
} from "@/lib/tax/small-supplier";
import {
  getTaxYearConfig,
  isConfiguredTaxYear,
  type TaxYearConfig,
} from "@/config/tax";

export type InvoiceTaxInput = {
  status: "draft" | "sent" | "paid" | "void";
  issueDate: string;
  taxableSubtotalCents: number;
  gstCents: number;
  qstCents: number;
};

function isRecognizedInvoice(status: InvoiceTaxInput["status"]) {
  return status === "sent" || status === "paid";
}

export function invoicesInTaxYear(invoices: InvoiceTaxInput[], year: number) {
  const start = startOfYearISO(`${year}-01-01`);
  const end = endOfYearISO(`${year}-01-01`);
  return invoices.filter(
    (invoice) =>
      isRecognizedInvoice(invoice.status) &&
      isDateInRange(invoice.issueDate, start, end),
  );
}

export function grossBusinessRevenueCents(invoices: InvoiceTaxInput[]) {
  return invoices.reduce((sum, invoice) => sum + invoice.taxableSubtotalCents, 0);
}

export function taxableSuppliesFromInvoices(invoices: InvoiceTaxInput[]): TaxableSupply[] {
  return invoices
    .filter((invoice) => isRecognizedInvoice(invoice.status))
    .map((invoice) => ({
      date: invoice.issueDate,
      amountCents: invoice.taxableSubtotalCents,
    }));
}

export type TaxCentreSummary = {
  year: number;
  config: TaxYearConfig;
  currency: string;
  isGstQstRegistered: boolean;
  grossBusinessRevenueCents: number;
  netBusinessIncomeCents: number;
  gstCollectedCents: number;
  qstCollectedCents: number;
  gstPayableCents: number;
  qstPayableCents: number;
  recordedInvoiceSalesTaxCents: number;
  incomeTaxCents: number;
  qppCents: number;
  incomeTaxReserveCents: number;
  gstQstReserveCents: number;
  suggestedReserveCents: number;
  smallSupplier: SmallSupplierStatus;
  usesFallbackConfig: boolean;
};

export function buildTaxCentreSummary({
  year,
  invoices,
  isGstQstRegistered,
  asOfDate,
  currency = "CAD",
}: {
  year: number;
  invoices: InvoiceTaxInput[];
  isGstQstRegistered: boolean;
  asOfDate: string;
  currency?: string;
}): TaxCentreSummary {
  const config = getTaxYearConfig(year);
  const yearInvoices = invoicesInTaxYear(invoices, year);
  const grossRevenue = grossBusinessRevenueCents(yearInvoices);
  const netBusinessIncome = grossRevenue;
  const incomeTax = estimatedIncomeTaxCents(netBusinessIncome, config);
  const qppCents = estimatedSelfEmployedQppCents(netBusinessIncome, config);
  const incomeTaxReserveCents = incomeTax.totalCents + qppCents;

  const smallSupplier = evaluateSmallSupplierStatus({
    taxableSupplies: taxableSuppliesFromInvoices(invoices),
    asOfDate,
    thresholdCents: config.smallSupplierThresholdCents,
    approachingThresholdRatio: config.approachingThresholdRatio,
  });

  const trackSalesTax = isGstQstRegistered;
  const gstCollected = trackSalesTax
    ? yearInvoices.reduce((sum, invoice) => sum + invoice.gstCents, 0)
    : 0;
  const qstCollected = trackSalesTax
    ? yearInvoices.reduce((sum, invoice) => sum + invoice.qstCents, 0)
    : 0;
  const gstPayable = gstCollected;
  const qstPayable = qstCollected;
  const gstQstReserveCents = isGstQstRegistered
    ? gstPayable + qstPayable
    : 0;

  return {
    year,
    config,
    currency,
    isGstQstRegistered,
    grossBusinessRevenueCents: grossRevenue,
    netBusinessIncomeCents: netBusinessIncome,
    gstCollectedCents: gstCollected,
    qstCollectedCents: qstCollected,
    gstPayableCents: gstPayable,
    qstPayableCents: qstPayable,
    recordedInvoiceSalesTaxCents: yearInvoices.reduce(
      (sum, invoice) => sum + invoice.gstCents + invoice.qstCents,
      0,
    ),
    incomeTaxCents: incomeTax.totalCents,
    qppCents,
    incomeTaxReserveCents,
    gstQstReserveCents,
    suggestedReserveCents: incomeTaxReserveCents + gstQstReserveCents,
    smallSupplier,
    usesFallbackConfig: !isConfiguredTaxYear(year),
  };
}
