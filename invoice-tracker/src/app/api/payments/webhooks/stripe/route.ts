import { NextResponse } from "next/server";

import { createLivePaymentProviderRegistry } from "@/lib/payments/adapters.server";
import { isPaymentError } from "@/lib/payments/errors";
import { settleRecordedPayment } from "@/lib/payments/notify.server";
import {
  stripeAccountFromWebhook,
  stripeConnectionFromAccount,
} from "@/lib/payments/providers/stripe.server";
import { reconcilePaymentEvent } from "@/lib/payments/reconcile.server";
import {
  createSupabaseReconcileStore,
  disconnectByProviderAccountId,
  updateProviderConnectionByAccountId,
} from "@/lib/payments/repository.server";
import { getServiceRoleKey } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if ("error" in getServiceRoleKey()) {
    return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
  }

  try {
    const registry = createLivePaymentProviderRegistry();
    const adapter = registry.get("stripe");
    const event = await adapter.verifyWebhook(request);
    const accountUpdate = stripeAccountFromWebhook(event);
    if (accountUpdate?.kind === "updated") {
      await updateProviderConnectionByAccountId(
        "stripe",
        accountUpdate.account.id,
        stripeConnectionFromAccount(accountUpdate.account),
      );
    }
    if (accountUpdate?.kind === "deauthorized") {
      await disconnectByProviderAccountId("stripe", accountUpdate.accountId);
    }

    const normalized = await adapter.mapWebhookToPaymentEvent(event);
    if (!normalized) {
      return NextResponse.json({ received: true });
    }

    const result = await reconcilePaymentEvent(normalized, createSupabaseReconcileStore());
    if (result.paymentCreated && "invoiceId" in result && result.invoiceId) {
      void settleRecordedPayment({
        userId: result.userId,
        invoiceId: result.invoiceId,
        amountCents: result.amountCents,
        currency: result.currency,
        provider: "stripe",
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (isPaymentError(error) && error.code === "PAYMENT_WEBHOOK_INVALID") {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }
    if (isPaymentError(error) && error.code === "PAYMENT_PROVIDER_NOT_IMPLEMENTED") {
      return NextResponse.json({ error: "Stripe isn't configured yet." }, { status: 503 });
    }
    if (isPaymentError(error) && error.code === "PAYMENT_RECONCILE_REJECTED") {
      return NextResponse.json({ error: "Webhook could not be processed." }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }
}
