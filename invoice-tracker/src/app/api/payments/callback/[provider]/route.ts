import { NextResponse } from "next/server";

import { completePaymentProviderConnect } from "@/lib/payments/connect.server";
import { isPaymentError } from "@/lib/payments/errors";
import { isPaymentProvider } from "@/lib/payments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/payments/callback/[provider]">,
) {
  const { provider } = await context.params;
  const url = new URL(request.url);
  const origin = url.origin;

  if (!isPaymentProvider(provider)) {
    return NextResponse.redirect(new URL("/settings?payments=error", origin));
  }

  try {
    const result = await completePaymentProviderConnect({
      provider,
      code: url.searchParams.get("code") ?? url.searchParams.get("merchantIdInPayPal"),
      state: url.searchParams.get("state") ?? url.searchParams.get("merchantId"),
      error: url.searchParams.get("error"),
      returnAttributes: {
        permissionsGranted: url.searchParams.get("permissionsGranted"),
        isEmailConfirmed: url.searchParams.get("isEmailConfirmed"),
        accountStatus: url.searchParams.get("accountStatus"),
        consentStatus: url.searchParams.get("consentStatus"),
      },
    });
    const path = result.denied ? "/settings?payments=denied" : result.returnPath;
    return NextResponse.redirect(new URL(path, origin));
  } catch (error) {
    if (isPaymentError(error)) {
      return NextResponse.redirect(new URL("/settings?payments=error", origin));
    }
    return NextResponse.redirect(new URL("/settings?payments=error", origin));
  }
}
