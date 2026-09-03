import { NextResponse } from "next/server";

import { publicInvoiceUrl } from "@/lib/app-url";
import { remainingCentsFromPayments } from "@/lib/payments/totals";
import { getInvoiceCheckoutState } from "@/lib/public-invoice";
import { getStripe } from "@/lib/stripe/client";
import { getServiceRoleKey } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || "error" in getServiceRoleKey()) {
    return NextResponse.json({ error: "Stripe isn't configured yet." }, { status: 503 });
  }

  const form = await request.formData();
  const publicToken = String(form.get("public_token") ?? "");
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${publicInvoiceUrl(publicToken)}?checkout=success`,
    cancel_url: `${publicInvoiceUrl(publicToken)}?checkout=cancelled`,
    client_reference_id: state.invoice_id,
    metadata: {
      invoice_id: state.invoice_id,
      user_id: state.user_id,
      invoice_number: state.invoice_number,
      public_token: publicToken,
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
  });

  if (!session.url) {
    return NextResponse.json({ error: "Checkout could not be started." }, { status: 500 });
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
