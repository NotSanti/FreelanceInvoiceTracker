import { NextResponse } from "next/server";

import { createLivePaymentProviderRegistry } from "@/lib/payments/adapters.server";
import { isPaymentError } from "@/lib/payments/errors";
import { settleRecordedPayment } from "@/lib/payments/notify.server";
import { squareRevocationMerchantId } from "@/lib/payments/providers/square.server";
import { reconcilePaymentEvent } from "@/lib/payments/reconcile.server";
import {
  createSupabaseReconcileStore,
  disconnectByProviderAccountId,
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
    const adapter = registry.get("square");
    const event = await adapter.verifyWebhook(request);
    const revokedMerchantId = squareRevocationMerchantId(event);
    if (revokedMerchantId) {
      await disconnectByProviderAccountId("square", revokedMerchantId);
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
        provider: "square",
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (isPaymentError(error) && error.code === "PAYMENT_WEBHOOK_INVALID") {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }
    if (isPaymentError(error) && error.code === "PAYMENT_PROVIDER_NOT_IMPLEMENTED") {
      return NextResponse.json({ error: "Square isn't configured yet." }, { status: 503 });
    }
    if (isPaymentError(error) && error.code === "PAYMENT_RECONCILE_REJECTED") {
      return NextResponse.json({ error: "Webhook could not be processed." }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }
}
