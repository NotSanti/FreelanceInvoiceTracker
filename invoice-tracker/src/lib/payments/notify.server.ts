import "server-only";

import { AnalyticsEvent, trackEvent } from "@/lib/analytics";
import { sendClientPaymentReceipt } from "@/lib/email/send-client-payment-receipt";
import { sendOwnerPaymentEmail } from "@/lib/email/send-payment-notice";
import { formatCurrency } from "@/lib/money/format";
import type { PaymentProvider } from "@/lib/payments/types";
import { sendPushToUser } from "@/lib/push/send";
import { createServiceClient } from "@/lib/supabase/service";

export async function settleRecordedPayment(input: {
  userId: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  provider?: PaymentProvider;
}) {
  const supabase = createServiceClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_id, total_cents, currency")
    .eq("id", input.invoiceId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!invoice) {
    return;
  }

  const { data: paidRows } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("invoice_id", input.invoiceId)
    .eq("user_id", input.userId);
  const paidCents = (paidRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount_cents),
    0,
  );
  const remainingAfter = Math.max(Number(invoice.total_cents) - paidCents, 0);
  const invoiceNumber = invoice.invoice_number;
  const invoiceCurrency = invoice.currency || input.currency;

  trackEvent(AnalyticsEvent.InvoicePaid, {
    paid_in_full: remainingAfter <= 0,
  });

  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "email, business_name, display_name, phone, address_line_1, address_line_2, city, province, postal_code, country",
      )
      .eq("id", input.userId)
      .maybeSingle(),
    invoice.client_id
      ? supabase
          .from("clients")
          .select("name, company_name, email")
          .eq("id", invoice.client_id)
          .eq("user_id", input.userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (profile?.email) {
    try {
      await sendOwnerPaymentEmail({
        to: profile.email,
        businessName: profile.business_name || profile.display_name,
        invoiceNumber,
        amountCents: input.amountCents,
        currency: invoiceCurrency,
      });
    } catch {
      // best-effort
    }
  }

  if (profile && client) {
    try {
      await sendClientPaymentReceipt({
        business: {
          business_name: profile.business_name,
          display_name: profile.display_name,
          email: profile.email,
          phone: profile.phone,
          address_line_1: profile.address_line_1,
          address_line_2: profile.address_line_2,
          city: profile.city,
          province: profile.province,
          postal_code: profile.postal_code,
          country: profile.country,
        },
        client,
        invoiceNumber,
        currency: invoiceCurrency,
        invoiceTotalCents: Number(invoice.total_cents),
        payment: {
          amountCents: input.amountCents,
          paidOn: new Date().toISOString().slice(0, 10),
        method: input.provider === "square" ? "square" : input.provider === "paypal" ? "paypal" : "stripe",
        },
        remainingCentsAfter: remainingAfter,
      });
    } catch {
      // best-effort
    }
  }

  try {
    const amountLabel = formatCurrency(input.amountCents, invoiceCurrency);
    const paidInFull = remainingAfter <= 0;
    await sendPushToUser(input.userId, {
      title: paidInFull ? "Invoice paid" : "Payment received",
      body: paidInFull
        ? `${invoiceNumber} · ${amountLabel} paid in full`
        : `${invoiceNumber} · ${amountLabel} received`,
      url: `/invoices/${input.invoiceId}`,
    });
  } catch {
    // best-effort
  }
}
