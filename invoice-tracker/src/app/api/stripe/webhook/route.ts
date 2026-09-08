import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { AnalyticsEvent, trackEvent } from "@/lib/analytics";
import { sendClientPaymentReceipt } from "@/lib/email/send-client-payment-receipt";
import { sendOwnerPaymentEmail } from "@/lib/email/send-payment-notice";
import { formatCurrency } from "@/lib/money/format";
import { sendPushToUser } from "@/lib/push/send";
import { getStripe } from "@/lib/stripe/client";
import { getStripeEnv } from "@/lib/stripe/env";
import { createServiceClient, getServiceRoleKey } from "@/lib/supabase/service";
import { todayISODate } from "@/lib/dates";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RecordPaymentResult = {
  duplicate_event?: boolean;
  payment_created?: boolean;
  paid_cents?: number;
  remaining_cents?: number;
  overpaid?: boolean;
  client_id?: string;
  invoice_number?: string;
  total_cents?: number;
  currency?: string;
};

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
  if (session.mode !== "payment") {
    return NextResponse.json({ received: true });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const invoiceId = session.metadata?.invoice_id;
  const userId = session.metadata?.user_id;
  const amountCents = session.amount_total;
  const currency = session.currency;

  if (
    !invoiceId ||
    !userId ||
    !UUID_PATTERN.test(invoiceId) ||
    !UUID_PATTERN.test(userId) ||
    !amountCents ||
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    !currency
  ) {
    return NextResponse.json({ error: "Incomplete Stripe metadata." }, { status: 400 });
  }

  if (session.client_reference_id && session.client_reference_id !== invoiceId) {
    return NextResponse.json({ error: "Client reference mismatch." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, user_id, status, currency, stripe_checkout_session_id, stripe_checkout_amount_cents",
    )
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (invoice.status === "void") {
    return NextResponse.json({ error: "Invoice is void." }, { status: 400 });
  }

  if (invoice.currency.toLowerCase() !== currency.toLowerCase()) {
    return NextResponse.json({ error: "Currency mismatch." }, { status: 400 });
  }

  const paidOn = todayISODate();
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  if (
    invoice.stripe_checkout_session_id &&
    invoice.stripe_checkout_session_id !== session.id
  ) {
    console.error("stripe_webhook_session_replaced", {
      eventId: event.id,
      sessionId: session.id,
      invoiceId,
    });
  }

  const { data: recorded, error: recordError } = await supabase.rpc(
    "record_stripe_checkout_payment",
    {
      p_event_id: event.id,
      p_event_type: event.type,
      p_session_id: session.id,
      p_invoice_id: invoiceId,
      p_user_id: userId,
      p_amount_cents: amountCents,
      p_currency: currency,
      p_payment_intent_id: paymentIntent,
      p_paid_on: paidOn,
    },
  );

  if (recordError) {
    console.error("stripe_webhook_record_failed", {
      eventId: event.id,
      sessionId: session.id,
      invoiceId,
      code: recordError.code,
    });
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }

  const result = (recorded ?? {}) as RecordPaymentResult;
  if (result.duplicate_event || !result.payment_created) {
    return NextResponse.json({ received: true });
  }

  const remainingAfter = Number(result.remaining_cents ?? 0);
  const invoiceNumber = String(result.invoice_number ?? "");
  const totalCents = Number(result.total_cents ?? 0);
  const invoiceCurrency = String(result.currency ?? invoice.currency);
  const clientId = typeof result.client_id === "string" ? result.client_id : null;

  trackEvent(AnalyticsEvent.InvoicePaid, {
    paid_in_full: remainingAfter <= 0,
  });

  if (result.overpaid) {
    console.error("stripe_webhook_overpayment", {
      eventId: event.id,
      sessionId: session.id,
      invoiceId,
      paidCents: result.paid_cents,
      totalCents,
    });
  }

  // Side effects after durable write; failures must not roll back payment.
  void settleNotifications({
    userId,
    clientId,
    invoiceId,
    invoiceNumber,
    amountCents,
    currency: invoiceCurrency,
    totalCents,
    remainingAfter,
    paidOn,
  });

  return NextResponse.json({ received: true });
}

async function settleNotifications(input: {
  userId: string;
  clientId: string | null;
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  totalCents: number;
  remainingAfter: number;
  paidOn: string;
}) {
  try {
    const supabase = createServiceClient();
    const [{ data: profile }, { data: client }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "email, business_name, display_name, phone, address_line_1, address_line_2, city, province, postal_code, country",
        )
        .eq("id", input.userId)
        .maybeSingle(),
      input.clientId
        ? supabase
            .from("clients")
            .select("name, company_name, email")
            .eq("id", input.clientId)
            .eq("user_id", input.userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (profile?.email) {
      try {
        await sendOwnerPaymentEmail({
          to: profile.email,
          businessName: profile.business_name || profile.display_name,
          invoiceNumber: input.invoiceNumber,
          amountCents: input.amountCents,
          currency: input.currency,
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
          invoiceNumber: input.invoiceNumber,
          currency: input.currency,
          invoiceTotalCents: input.totalCents,
          payment: {
            amountCents: input.amountCents,
            paidOn: input.paidOn,
            method: "stripe",
          },
          remainingCentsAfter: input.remainingAfter,
        });
      } catch {
        // best-effort
      }
    }

    try {
      const amountLabel = formatCurrency(input.amountCents, input.currency);
      const paidInFull = input.remainingAfter <= 0;
      await sendPushToUser(input.userId, {
        title: paidInFull ? "Invoice paid" : "Payment received",
        body: paidInFull
          ? `${input.invoiceNumber} · ${amountLabel} paid in full`
          : `${input.invoiceNumber} · ${amountLabel} received`,
        url: `/invoices/${input.invoiceId}`,
      });
    } catch {
      // best-effort
    }
  } catch (error) {
    console.error("stripe_webhook_notify_failed", {
      invoiceId: input.invoiceId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
