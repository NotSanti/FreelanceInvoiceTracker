import type { SupabaseClient } from "@supabase/supabase-js";

import { isInvoiceFullyPaid, paidCentsFromPayments } from "@/lib/payments/totals";
import type { Database } from "@/types/database";

export async function syncInvoicePaidState({
  supabase,
  invoiceId,
  userId,
  totalCents,
  payments,
}: {
  supabase: SupabaseClient<Database>;
  invoiceId: string;
  userId: string;
  totalCents: number;
  payments: Array<{ amountCents: number }>;
}) {
  const paidCents = paidCentsFromPayments(payments);
  const fullyPaid = isInvoiceFullyPaid(totalCents, payments);

  if (fullyPaid) {
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .neq("status", "void");

    return error ? { error: "The payment was saved, but the invoice status could not be updated." } : {};
  }

  if (paidCents > 0) {
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        paid_at: null,
      })
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .eq("status", "paid");

    return error ? { error: "The payment was saved, but the invoice status could not be updated." } : {};
  }

  return {};
}

export async function syncInvoicePaidStateFromDatabase({
  supabase,
  invoiceId,
  userId,
}: {
  supabase: SupabaseClient<Database>;
  invoiceId: string;
  userId: string;
}) {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("total_cents")
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (invoiceError || !invoice) {
    return { error: "The payment was saved, but the invoice status could not be updated." };
  }

  const { data: paidRows, error: paymentsError } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("invoice_id", invoiceId)
    .eq("user_id", userId);
  if (paymentsError) {
    return { error: "The payment was saved, but the invoice status could not be updated." };
  }

  return syncInvoicePaidState({
    supabase,
    invoiceId,
    userId,
    totalCents: Number(invoice.total_cents),
    payments: (paidRows ?? []).map((row) => ({ amountCents: Number(row.amount_cents) })),
  });
}
