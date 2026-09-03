import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { AnalyticsEvent, trackEvent } from "@/lib/analytics";
import { sendClientPaymentReceipt } from "@/lib/email/send-client-payment-receipt";
import { sendOwnerPaymentEmail } from "@/lib/email/send-payment-notice";
import { formatCurrency } from "@/lib/money/format";
import { remainingCentsFromPayments } from "@/lib/payments/totals";
import { syncInvoicePaidState } from "@/lib/payments/sync";
import { sendPushToUser } from "@/lib/push/send";
import { getStripe } from "@/lib/stripe/client";
import { getStripeEnv } from "@/lib/stripe/env";
import { createServiceClient, getServiceRoleKey } from "@/lib/supabase/service";
import { todayISODate } from "@/lib/dates";

export async function POST(request: Request) {
  const stripe = getStripe();
  const env = getStripeEnv();
  if (!stripe || "error" in env) {
    return NextResponse.json({ error: "Stripe isn't configured yet." }, { status: 503 });
  }
  if (!env.webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET." }, { status: 503 });
  }
  if ("error" in getServiceRoleKey()) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const invoiceId = session.metadata?.invoice_id;
  const userId = session.metadata?.user_id;
  const amountCents = session.amount_total;
  if (!invoiceId || !userId || !amountCents) {
    return NextResponse.json({ error: "Incomplete Stripe metadata." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, user_id, client_id, total_cents, currency, invoice_number, status")
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (invoiceError || !invoice || invoice.status === "void") {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("invoice_id", invoiceId);

  const alreadyPaid = remainingCentsFromPayments(
    invoice.total_cents,
    (payments ?? []).map((payment) => ({ amountCents: Number(payment.amount_cents) })),
  );
  if (alreadyPaid <= 0) {
    return NextResponse.json({ received: true });
  }

  const paidOn = todayISODate();
  const { error: insertError } = await supabase.from("payments").insert({
    user_id: userId,
    invoice_id: invoiceId,
    amount_cents: amountCents,
    currency: invoice.currency,
    paid_on: paidOn,
    method: "stripe",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true });
    }
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }

  const { data: updatedPayments } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("invoice_id", invoiceId);

  const paymentAmounts = (updatedPayments ?? []).map((payment) => ({
    amountCents: Number(payment.amount_cents),
  }));

  await syncInvoicePaidState({
    supabase,
    invoiceId,
    userId,
    totalCents: invoice.total_cents,
    payments: paymentAmounts,
  });

  const remainingAfter = remainingCentsFromPayments(
    invoice.total_cents,
    paymentAmounts,
  );

  trackEvent(AnalyticsEvent.InvoicePaid, {
    paid_in_full: remainingAfter <= 0,
  });

  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "email, business_name, display_name, phone, address_line_1, address_line_2, city, province, postal_code, country",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("name, company_name, email")
      .eq("id", invoice.client_id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (profile?.email) {
    try {
      await sendOwnerPaymentEmail({
        to: profile.email,
        businessName: profile.business_name || profile.display_name,
        invoiceNumber: invoice.invoice_number,
        amountCents,
        currency: invoice.currency,
      });
    } catch {
      // Payment is saved; owner notice is best-effort.
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
        invoiceNumber: invoice.invoice_number,
        currency: invoice.currency,
        invoiceTotalCents: invoice.total_cents,
        payment: {
          amountCents,
          paidOn,
          method: "stripe",
        },
        remainingCentsAfter: remainingAfter,
      });
    } catch {
      // Payment is saved; client receipt is best-effort.
    }
  }

  try {
    const amountLabel = formatCurrency(amountCents, invoice.currency);
    const paidInFull = remainingAfter <= 0;
    await sendPushToUser(userId, {
      title: paidInFull ? "Invoice paid" : "Payment received",
      body: paidInFull
        ? `${invoice.invoice_number} · ${amountLabel} paid in full`
        : `${invoice.invoice_number} · ${amountLabel} received`,
      url: `/invoices/${invoiceId}`,
    });
  } catch {
    // Payment is saved; push delivery is best-effort.
  }

  return NextResponse.json({ received: true });
}
