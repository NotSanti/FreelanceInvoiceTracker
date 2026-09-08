import { NextResponse } from "next/server";

import { STRIPE_CHECKOUT_ENABLED } from "@/config/payments";
import { LIMITS } from "@/config/limits";
import { publicInvoiceUrl } from "@/lib/app-url";
import { remainingCentsFromPayments } from "@/lib/payments/totals";
import { getInvoiceCheckoutState, isPublicToken } from "@/lib/public-invoice";
import {
  clientIpFromRequest,
  consumeRateLimit,
  hashTokenForRateLimit,
} from "@/lib/security/rate-limit";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient, getServiceRoleKey } from "@/lib/supabase/service";

function rejectIfOversized(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > LIMITS.requestBodyBytes.stripeCheckout
  ) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  return null;
}

export async function POST(request: Request) {
  if (!STRIPE_CHECKOUT_ENABLED) {
    return NextResponse.json(
      { error: "Card checkout isn't available." },
      { status: 503 },
    );
  }

  const oversized = rejectIfOversized(request);
  if (oversized) {
    return oversized;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.includes("application/x-www-form-urlencoded") &&
    !contentType.includes("multipart/form-data")
  ) {
    return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
  }

  const stripe = getStripe();
  if (!stripe || "error" in getServiceRoleKey()) {
    return NextResponse.json({ error: "Stripe isn't configured yet." }, { status: 503 });
  }

  const form = await request.formData();
  const publicToken = String(form.get("public_token") ?? "");
  if (!isPublicToken(publicToken)) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const rate = consumeRateLimit({
    key: `stripe-checkout:${clientIpFromRequest(request)}:${hashTokenForRateLimit(publicToken)}`,
    limit: 8,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const state = await getInvoiceCheckoutState(publicToken);
  if (!state) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const remainingCents = remainingCentsFromPayments(state.total_cents, [
    { amountCents: state.paid_cents },
  ]);

  if (remainingCents <= 0) {
    return NextResponse.redirect(publicInvoiceUrl(publicToken));
  }

  const now = Date.now();
  const expiresAt = state.stripe_checkout_expires_at
    ? Date.parse(state.stripe_checkout_expires_at)
    : NaN;
  if (
    state.stripe_payment_url &&
    state.stripe_checkout_session_id &&
    state.stripe_checkout_amount_cents === remainingCents &&
    Number.isFinite(expiresAt) &&
    expiresAt > now + 60_000
  ) {
    return NextResponse.redirect(state.stripe_payment_url, { status: 303 });
  }

  const idempotencyKey = `invoice-checkout:${state.invoice_id}:v${state.total_cents}:paid${state.paid_cents}:rem${remainingCents}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      success_url: `${publicInvoiceUrl(publicToken)}?checkout=success`,
      cancel_url: `${publicInvoiceUrl(publicToken)}?checkout=cancelled`,
      client_reference_id: state.invoice_id,
      metadata: {
        invoice_id: state.invoice_id,
        user_id: state.user_id,
        invoice_number: state.invoice_number,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: state.currency.toLowerCase(),
            unit_amount: remainingCents,
            product_data: {
              name: `Invoice ${state.invoice_number}`,
            },
          },
        },
      ],
    },
    { idempotencyKey },
  );

  if (!session.url) {
    return NextResponse.json({ error: "Checkout could not be started." }, { status: 500 });
  }

  const supabase = createServiceClient();
  await supabase
    .from("invoices")
    .update({
      stripe_checkout_session_id: session.id,
      stripe_checkout_amount_cents: remainingCents,
      stripe_checkout_expires_at: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
      stripe_payment_url: session.url,
    })
    .eq("id", state.invoice_id)
    .eq("user_id", state.user_id);

  return NextResponse.redirect(session.url, { status: 303 });
}
