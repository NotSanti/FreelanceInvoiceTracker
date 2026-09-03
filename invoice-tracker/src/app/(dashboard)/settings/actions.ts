"use server";

import { revalidatePath } from "next/cache";

import { emptyToNull, parseTaxRate, readTrimmed } from "@/lib/form";
import { getProfile, requireUser } from "@/lib/auth/session";
import { combinedSalesTaxRate, getTaxYearConfig } from "@/config/tax";
import { todayISODate } from "@/lib/dates";

export type ProfileFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  saved?: boolean;
  savedAt?: number;
};

const CURRENCIES = new Set(["CAD", "USD"]);

export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();
  const profile = await getProfile();

  const displayName = readTrimmed(formData, "display_name");
  const businessName = readTrimmed(formData, "business_name");
  const invoicePrefix = readTrimmed(formData, "invoice_prefix");
  const currency = readTrimmed(formData, "default_currency").toUpperCase();
  const taxesEnabled = formData.get("taxes_enabled") === "on";
  const taxRateResult = taxesEnabled
    ? parseTaxRate(readTrimmed(formData, "default_tax_rate"))
    : ({ value: profile.default_tax_rate } as const);

  const fieldErrors: ProfileFormState["fieldErrors"] = {};

  if (!displayName) {
    fieldErrors.display_name = "Enter a display name.";
  }
  if (!businessName) {
    fieldErrors.business_name = "Enter a business name.";
  }
  if (!invoicePrefix) {
    fieldErrors.invoice_prefix = "Enter an invoice prefix.";
  }
  if (!CURRENCIES.has(currency)) {
    fieldErrors.default_currency = "Choose a supported currency.";
  }
  if (taxesEnabled && "error" in taxRateResult) {
    fieldErrors.default_tax_rate = taxRateResult.error;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const isGstQstRegistered = formData.get("is_gst_qst_registered") === "on";
  const taxConfig = getTaxYearConfig(Number(todayISODate().slice(0, 4)));

  let resolvedTaxName = profile.default_tax_name;
  let resolvedTaxRate =
    profile.default_tax_rate === null || profile.default_tax_rate === undefined
      ? null
      : Number(profile.default_tax_rate);

  if (taxesEnabled) {
    const taxRate =
      "value" in taxRateResult ? (taxRateResult.value ?? null) : null;
    resolvedTaxRate =
      isGstQstRegistered && taxRate === null
        ? combinedSalesTaxRate(taxConfig)
        : taxRate;
    resolvedTaxName =
      isGstQstRegistered && !readTrimmed(formData, "default_tax_name")
        ? "GST/QST"
        : emptyToNull(readTrimmed(formData, "default_tax_name"));
  }

  const gstRegistrationNumber = isGstQstRegistered
    ? emptyToNull(readTrimmed(formData, "gst_registration_number"))
    : profile.gst_registration_number;
  const qstRegistrationNumber = isGstQstRegistered
    ? emptyToNull(readTrimmed(formData, "qst_registration_number"))
    : profile.qst_registration_number;

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      business_name: businessName,
      phone: emptyToNull(readTrimmed(formData, "phone")),
      address_line_1: emptyToNull(readTrimmed(formData, "address_line_1")),
      address_line_2: emptyToNull(readTrimmed(formData, "address_line_2")),
      city: emptyToNull(readTrimmed(formData, "city")),
      province: emptyToNull(readTrimmed(formData, "province")),
      postal_code: emptyToNull(readTrimmed(formData, "postal_code")),
      country: readTrimmed(formData, "country") || "CA",
      default_currency: currency,
      taxes_enabled: taxesEnabled,
      default_tax_name: resolvedTaxName,
      default_tax_rate: resolvedTaxRate,
      tax_registration_number: emptyToNull(
        readTrimmed(formData, "tax_registration_number"),
      ),
      is_gst_qst_registered: isGstQstRegistered,
      gst_registration_number: gstRegistrationNumber,
      qst_registration_number: qstRegistrationNumber,
      invoice_prefix: invoicePrefix,
      payment_instructions: emptyToNull(
        readTrimmed(formData, "payment_instructions"),
      ),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "We couldn't save your settings. Your changes were not stored." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/taxes");
  return { saved: true, savedAt: Date.now() };
}
