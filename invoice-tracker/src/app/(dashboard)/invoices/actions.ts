"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AnalyticsEvent, trackEvent } from "@/lib/analytics";
import { sendInvoiceEmail } from "@/lib/email/send-invoice";
import { buildInvoiceEmailHtml } from "@/lib/email/invoice-email-template";
import { sendClientPaymentReceipt } from "@/lib/email/send-client-payment-receipt";
import { getEmailEnv } from "@/lib/email/env";
import { publicInvoiceUrl } from "@/lib/app-url";
import { getProfile, requireUser } from "@/lib/auth/session";
import { isClientId } from "@/lib/clients/queries";
import { MANUAL_PAYMENT_METHODS, type ManualPaymentMethod } from "@/config/payments";
import { emptyToNull, isValidEmail, readTrimmed } from "@/lib/form";
import { formatISODateLong, isISODate, todayISODate } from "@/lib/dates";
import { buildInvoiceDocument, invoicePdfFilename } from "@/lib/invoice/document";
import {
  calculateBalanceRemaining,
} from "@/lib/invoice/totals";
import {
  canEditInvoice,
  canRecordPayment,
  canResendReceipt,
  canSendInvoice,
  canVoidInvoice,
} from "@/lib/invoice/status";
import { parseInvoiceDraft, type InvoiceDraftValues, type InvoiceFormState } from "@/lib/invoice/parse";
import { parseMoneyToCents } from "@/lib/money/parse";
import { formatCurrency } from "@/lib/money/format";
import { remainingCentsFromPayments } from "@/lib/payments/totals";
import { syncInvoicePaidState } from "@/lib/payments/sync";
import { renderInvoicePdf } from "@/components/invoices/invoice-pdf";
import { getInvoice, isInvoiceId } from "@/lib/invoices/queries";

export type { InvoiceFormState };

function revalidateInvoicePaths(id: string, publicToken?: string) {
  revalidatePath("/");
  revalidatePath("/taxes");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/invoices/${id}/edit`);
  revalidatePath(`/invoices/${id}/preview`);
  if (publicToken) {
    revalidatePath(`/invoice/${publicToken}`);
  }
}

function invoiceMoneyColumns(values: InvoiceDraftValues, splitGstQst: boolean) {
  const salesTax = splitGstQst
    ? values.salesTax
    : {
        taxableSubtotalCents: values.salesTax.taxableSubtotalCents,
        gstRate: null,
        gstCents: 0,
        qstRate: null,
        qstCents: 0,
      };

  return {
    subtotal_cents: values.totals.subtotalCents,
    discount_cents: values.totals.discountCents,
    tax_cents: values.totals.taxCents,
    total_cents: values.totals.totalCents,
    taxable_subtotal_cents: salesTax.taxableSubtotalCents,
    gst_rate: salesTax.gstRate,
    gst_cents: salesTax.gstCents,
    qst_rate: salesTax.qstRate,
    qst_cents: salesTax.qstCents,
  };
}

async function assertOwnedClient(clientId: string, userId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .maybeSingle();

  return !error && data !== null;
}

export async function createInvoice(
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const { supabase, user } = await requireUser();
  const profile = await getProfile();
  const parsed = parseInvoiceDraft(formData);

  if (!parsed.values) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  if (!(await assertOwnedClient(parsed.values.clientId, user.id))) {
    return { error: "Choose a client.", fieldErrors: { client_id: "Choose a client." } };
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: parsed.values.clientId,
      status: "draft",
      currency: parsed.values.currency,
      issue_date: parsed.values.issueDate,
      due_date: parsed.values.dueDate,
      ...invoiceMoneyColumns(parsed.values, profile.is_gst_qst_registered),
      tax_name: parsed.values.taxName,
      tax_rate: parsed.values.taxRate,
      notes: parsed.values.notes,
      payment_instructions: parsed.values.paymentInstructions,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "We couldn't save this invoice." };
  }

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    parsed.values.items.map((item, position) => ({
      invoice_id: data.id,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      amount_cents: item.amountCents,
      position,
    })),
  );

  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", data.id).eq("user_id", user.id);
    return { error: "We couldn't save this invoice." };
  }

  revalidateInvoicePaths(data.id);
  trackEvent(AnalyticsEvent.InvoiceCreated);
  redirect(`/invoices/${data.id}?toast=created`);
}

export async function updateInvoice(
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const { supabase, user } = await requireUser();
  const profile = await getProfile();
  const id = readTrimmed(formData, "id");

  if (!isInvoiceId(id)) {
    return { error: "This invoice could not be found." };
  }

  const invoice = await getInvoice(id);
  if (!invoice) {
    return { error: "This invoice could not be found." };
  }

  if (!canEditInvoice(invoice.status)) {
    return { error: "Paid and voided invoices cannot be edited." };
  }

  const parsed = parseInvoiceDraft(formData);

  if (!parsed.values) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  if (!isClientId(parsed.values.clientId) || !(await assertOwnedClient(parsed.values.clientId, user.id))) {
    return { error: "Choose a client.", fieldErrors: { client_id: "Choose a client." } };
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({
      client_id: parsed.values.clientId,
      currency: parsed.values.currency,
      issue_date: parsed.values.issueDate,
      due_date: parsed.values.dueDate,
      ...invoiceMoneyColumns(parsed.values, profile.is_gst_qst_registered),
      tax_name: parsed.values.taxName,
      tax_rate: parsed.values.taxRate,
      notes: parsed.values.notes,
      payment_instructions: parsed.values.paymentInstructions,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "We couldn't save this invoice." };
  }

  if (!data) {
    return { error: "This invoice could not be found." };
  }

  const { error: deleteError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", id);

  if (deleteError) {
    return { error: "We couldn't save this invoice." };
  }

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    parsed.values.items.map((item, position) => ({
      invoice_id: id,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      amount_cents: item.amountCents,
      position,
    })),
  );

  if (itemsError) {
    return { error: "We couldn't save this invoice." };
  }

  revalidateInvoicePaths(id, invoice.public_token);
  redirect(`/invoices/${id}`);
}

export type SendInvoiceState = {
  error?: string;
  fieldErrors?: Partial<Record<"to" | "subject" | "message", string>>;
  sent?: boolean;
};

export async function sendInvoice(
  _previous: SendInvoiceState,
  formData: FormData,
): Promise<SendInvoiceState> {
  const { supabase, user } = await requireUser();
  const id = readTrimmed(formData, "id");
  const to = readTrimmed(formData, "to");
  const subject = readTrimmed(formData, "subject");
  const message = readTrimmed(formData, "message");

  if (!isInvoiceId(id)) {
    return { error: "This invoice could not be found." };
  }

  const fieldErrors: NonNullable<SendInvoiceState["fieldErrors"]> = {};
  if (!to) {
    fieldErrors.to = "Enter a recipient.";
  } else if (!isValidEmail(to)) {
    fieldErrors.to = "Enter a valid email.";
  }
  if (!subject) {
    fieldErrors.subject = "Enter a subject.";
  } else if (subject.length > 200) {
    fieldErrors.subject = "Subject is too long.";
  }
  if (!message) {
    fieldErrors.message = "Enter a message.";
  } else if (message.length > 5000) {
    fieldErrors.message = "Message is too long.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const invoice = await getInvoice(id);
  if (!invoice) {
    return { error: "This invoice could not be found." };
  }

  if (!canSendInvoice(invoice.status)) {
    return { error: "Paid and voided invoices cannot be sent." };
  }

  if (invoice.invoice_items.length === 0) {
    return { error: "Add at least one line item before sending." };
  }

  const profile = await getProfile();
  const emailEnv = getEmailEnv();
  if ("error" in emailEnv) {
    return { error: emailEnv.error };
  }

  const document = buildInvoiceDocument(invoice, profile);
  const pdf = await renderInvoicePdf(document);
  const payUrl = publicInvoiceUrl(invoice.public_token);
  const remainingCents = calculateBalanceRemaining(
    invoice.total_cents,
    invoice.paidCents,
  );
  const html = buildInvoiceEmailHtml({
    clientName: invoice.clients.name,
    businessName: document.businessName,
    invoiceNumber: invoice.invoice_number,
    totalLabel: formatCurrency(
      remainingCents > 0 ? remainingCents : invoice.total_cents,
      invoice.currency,
    ),
    dueDateLabel: invoice.due_date ? formatISODateLong(invoice.due_date) : null,
    publicUrl: payUrl,
    message,
  });
  const sent = await sendInvoiceEmail({
    businessName: document.businessName,
    replyTo: profile.email,
    to,
    subject,
    message,
    html,
    filename: invoicePdfFilename(invoice.invoice_number),
    pdf,
  });

  if ("error" in sent) {
    return { error: sent.error };
  }

  const updates =
    invoice.status === "draft"
      ? { status: "sent" as const, sent_at: new Date().toISOString() }
      : {};

  if (invoice.status === "draft") {
    const { data, error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        error:
          "The email was sent, but we couldn't mark this invoice as sent. Refresh and try again if the status still shows draft.",
      };
    }
  }

  revalidateInvoicePaths(id, invoice.public_token);
  trackEvent(AnalyticsEvent.InvoiceSent);
  return { sent: true };
}

export type RecordPaymentState = {
  error?: string;
  fieldErrors?: Partial<Record<"amount" | "paid_on" | "method", string>>;
  saved?: boolean;
  paidInFull?: boolean;
};

export async function recordPayment(
  _previous: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const { supabase, user } = await requireUser();
  const id = readTrimmed(formData, "id");
  const amountInput = readTrimmed(formData, "amount");
  const paidOn = readTrimmed(formData, "paid_on");
  const method = readTrimmed(formData, "method");
  const parsedAmount = parseMoneyToCents(amountInput);
  const fieldErrors: NonNullable<RecordPaymentState["fieldErrors"]> = {};

  if (!isInvoiceId(id)) {
    return { error: "This invoice could not be found." };
  }

  if (!amountInput || "error" in parsedAmount) {
    fieldErrors.amount = !amountInput
      ? "Enter an amount."
      : parsedAmount.error;
  } else if (parsedAmount.value <= 0) {
    fieldErrors.amount = "Amount must be greater than 0.";
  }

  if (!isISODate(paidOn)) {
    fieldErrors.paid_on = "Enter a payment date.";
  }

  if (!MANUAL_PAYMENT_METHODS.some((option) => option.value === method)) {
    fieldErrors.method = "Choose a payment method.";
  }

  if (Object.keys(fieldErrors).length > 0 || "error" in parsedAmount || !amountInput) {
    return { error: "Check the highlighted fields and try again.", fieldErrors };
  }

  const amountCents = parsedAmount.value;

  const invoice = await getInvoice(id);
  if (!invoice) {
    return { error: "This invoice could not be found." };
  }

  const remainingCents = remainingCentsFromPayments(
    invoice.total_cents,
    invoice.payments.map((payment) => ({ amountCents: payment.amount_cents })),
  );

  if (!canRecordPayment(invoice.status, remainingCents)) {
    return { error: "Payments cannot be recorded on this invoice." };
  }

  if (amountCents > remainingCents) {
    return {
      error: "That amount is more than the remaining balance.",
      fieldErrors: { amount: "Cannot exceed the remaining balance." },
    };
  }

  const { error } = await supabase.from("payments").insert({
    user_id: user.id,
    invoice_id: id,
    amount_cents: amountCents,
    currency: invoice.currency,
    paid_on: paidOn,
    method: method as ManualPaymentMethod,
    reference: emptyToNull(readTrimmed(formData, "reference")),
  });

  if (error) {
    return { error: "We couldn't save this payment." };
  }

  const payments = [
    ...invoice.payments.map((payment) => ({ amountCents: payment.amount_cents })),
    { amountCents },
  ];
  const synced = await syncInvoicePaidState({
    supabase,
    invoiceId: id,
    userId: user.id,
    totalCents: invoice.total_cents,
    payments,
  });

  if (synced.error) {
    return { error: synced.error };
  }

  const remainingAfter = remainingCentsFromPayments(
    invoice.total_cents,
    payments,
  );

  revalidateInvoicePaths(id, invoice.public_token);
  trackEvent(AnalyticsEvent.PaymentRecorded, {
    paid_in_full: remainingAfter === 0,
  });
  return { saved: true, paidInFull: remainingAfter === 0 };
}

export type ResendReceiptState = {
  sent?: boolean;
  error?: string;
};

export async function resendReceipt(
  _previous: ResendReceiptState,
  formData: FormData,
): Promise<ResendReceiptState> {
  await requireUser();
  const id = readTrimmed(formData, "id");

  if (!isInvoiceId(id)) {
    return { error: "This invoice could not be found." };
  }

  const invoice = await getInvoice(id);
  if (!invoice || !canResendReceipt(invoice.status)) {
    return { error: "Receipts can only be resent for paid invoices." };
  }

  const payment = invoice.payments.at(-1);
  if (!payment) {
    return { error: "This invoice has no payments to receipt." };
  }

  if (!invoice.clients.email?.trim()) {
    return { error: "Add a client email before resending the receipt." };
  }

  const remainingAfter = calculateBalanceRemaining(
    invoice.total_cents,
    invoice.paidCents,
  );
  const profile = await getProfile();

  try {
    const result = await sendClientPaymentReceipt({
      business: profile,
      client: invoice.clients,
      invoiceNumber: invoice.invoice_number,
      currency: invoice.currency,
      invoiceTotalCents: invoice.total_cents,
      payment: {
        amountCents: payment.amount_cents,
        paidOn: payment.paid_on,
        method: payment.method,
        reference: payment.reference,
      },
      remainingCentsAfter: remainingAfter,
    });

    if ("skipped" in result) {
      return { error: "Add a client email before resending the receipt." };
    }
    if ("error" in result) {
      return { error: result.error };
    }

    return { sent: true };
  } catch {
    return { error: "The receipt email could not be sent." };
  }
}

export async function voidInvoice(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = readTrimmed(formData, "id");

  if (!isInvoiceId(id)) {
    throw new Error("This invoice could not be found.");
  }

  const invoice = await getInvoice(id);
  if (!invoice || !canVoidInvoice(invoice.status)) {
    throw new Error("This invoice cannot be voided.");
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void" })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error("We couldn't void this invoice.");
  }

  revalidateInvoicePaths(id, invoice.public_token);
  trackEvent(AnalyticsEvent.InvoiceVoided);
  redirect(`/invoices/${id}?toast=voided`);
}

export async function duplicateInvoice(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = readTrimmed(formData, "id");

  if (!isInvoiceId(id)) {
    throw new Error("This invoice could not be found.");
  }

  const invoice = await getInvoice(id);
  if (!invoice) {
    throw new Error("This invoice could not be found.");
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: invoice.client_id,
      status: "draft",
      currency: invoice.currency,
      issue_date: todayISODate(),
      due_date: invoice.due_date,
      subtotal_cents: invoice.subtotal_cents,
      discount_cents: invoice.discount_cents,
      tax_cents: invoice.tax_cents,
      total_cents: invoice.total_cents,
      taxable_subtotal_cents: invoice.taxable_subtotal_cents,
      gst_rate: invoice.gst_rate,
      gst_cents: invoice.gst_cents,
      qst_rate: invoice.qst_rate,
      qst_cents: invoice.qst_cents,
      tax_name: invoice.tax_name,
      tax_rate: invoice.tax_rate,
      notes: invoice.notes,
      payment_instructions: invoice.payment_instructions,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("We couldn't duplicate this invoice.");
  }

  if (invoice.invoice_items.length > 0) {
    const { error: itemsError } = await supabase.from("invoice_items").insert(
      invoice.invoice_items.map((item, position) => ({
        invoice_id: data.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        amount_cents: item.amount_cents,
        position,
      })),
    );

    if (itemsError) {
      await supabase.from("invoices").delete().eq("id", data.id).eq("user_id", user.id);
      throw new Error("We couldn't duplicate this invoice.");
    }
  }

  revalidateInvoicePaths(data.id);
  trackEvent(AnalyticsEvent.InvoiceDuplicated);
  redirect(`/invoices/${data.id}`);
}

