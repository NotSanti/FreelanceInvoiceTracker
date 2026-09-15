import { NextResponse } from "next/server";

import { publicInvoiceUrl } from "@/lib/app-url";
import { LIMITS } from "@/config/limits";
import { createLivePaymentProviderRegistry } from "@/lib/payments/adapters.server";
import { createHostedCheckout } from "@/lib/payments/checkout.server";
import { CLIENT_PAYMENT_UNAVAILABLE, isPaymentError } from "@/lib/payments/errors";
import { createSupabaseCheckoutStore } from "@/lib/payments/repository.server";
import { isPaymentProvider } from "@/lib/payments/types";
import { isPublicToken } from "@/lib/public-invoice";
import {
  clientIpFromRequest,
  consumeRateLimit,
  hashTokenForRateLimit,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function paymentErrorStatus(code: string) {
  if (code === "PAYMENT_INVOICE_NOT_FOUND") {
    return 404;
  }
  if (code === "PAYMENT_CHECKOUT_RATE_LIMITED") {
    return 429;
  }
  if (code === "PAYMENT_OWNER_MISMATCH") {
    return 403;
  }
  if (
    code === "PAYMENT_INVOICE_NOT_PAYABLE" ||
    code === "PAYMENT_CONNECTION_UNUSABLE" ||
    code === "PAYMENT_METHOD_NOT_ENABLED"
  ) {
    return 409;
  }
  return 503;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > LIMITS.requestBodyBytes.paymentsCheckout
  ) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
  }

  let body: { publicInvoiceToken?: unknown; provider?: unknown };
  try {
    body = (await request.json()) as { publicInvoiceToken?: unknown; provider?: unknown };
  } catch {
    return NextResponse.json({ error: "Invoice not found." }, { status: 400 });
  }

  const publicInvoiceToken = String(body.publicInvoiceToken ?? "");
  const provider = String(body.provider ?? "");
  if (!isPublicToken(publicInvoiceToken) || !isPaymentProvider(provider)) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const rate = consumeRateLimit({
    key: `payments-checkout:${clientIpFromRequest(request)}:${hashTokenForRateLimit(publicInvoiceToken)}:${provider}`,
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

  try {
    const result = await createHostedCheckout(
      {
        publicInvoiceToken,
        provider,
        successUrl: `${publicInvoiceUrl(publicInvoiceToken)}?checkout=success`,
        cancelUrl: `${publicInvoiceUrl(publicInvoiceToken)}?checkout=cancelled`,
      },
      {
        store: createSupabaseCheckoutStore(),
        registry: createLivePaymentProviderRegistry(),
      },
    );
    return NextResponse.json({ checkoutUrl: result.checkoutUrl });
  } catch (error) {
    if (isPaymentError(error)) {
      const status = paymentErrorStatus(error.code);
      return NextResponse.json(
        {
          error:
            status === 404
              ? "Invoice not found."
              : status === 429
                ? "Too many checkout attempts. Try again shortly."
                : CLIENT_PAYMENT_UNAVAILABLE,
        },
        {
          status,
          ...(error.code === "PAYMENT_CHECKOUT_RATE_LIMITED"
            ? { headers: { "Retry-After": "60" } }
            : {}),
        },
      );
    }
    return NextResponse.json({ error: CLIENT_PAYMENT_UNAVAILABLE }, { status: 503 });
  }
}
