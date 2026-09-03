import { getProfile } from "@/lib/auth/session";
import { todayISODate } from "@/lib/dates";
import { listInvoices } from "@/lib/invoices/queries";
import { toInvoiceTaxInput } from "@/lib/tax/map";
import { buildTaxCentreSummary } from "@/lib/tax/summary";

export async function getTaxCentrePage(year: number) {
  const [invoices, profile] = await Promise.all([listInvoices(), getProfile()]);
  const today = todayISODate();

  return {
    profile,
    summary: buildTaxCentreSummary({
      year,
      invoices: invoices.map(toInvoiceTaxInput),
      isGstQstRegistered: Boolean(profile.is_gst_qst_registered),
      asOfDate: today,
      currency: profile.default_currency,
    }),
  };
}
