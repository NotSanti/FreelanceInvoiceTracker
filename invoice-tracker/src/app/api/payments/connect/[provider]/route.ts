import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { startPaymentProviderConnect } from "@/lib/payments/connect.server";
import { isPaymentError } from "@/lib/payments/errors";
import { isPaymentProvider } from "@/lib/payments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/payments/connect/[provider]">,
) {
  const { user } = await requireUser();
  const { provider } = await context.params;
  if (!isPaymentProvider(provider)) {
    return NextResponse.json({ error: "That payment method is not available." }, { status: 404 });
  }

  const returnPath = new URL(request.url).searchParams.get("returnPath");
  try {
    const url = await startPaymentProviderConnect({
      userId: user.id,
      provider,
      returnPath,
    });
    return NextResponse.redirect(url);
  } catch (error) {
    if (isPaymentError(error)) {
      return NextResponse.redirect(new URL("/settings?payments=setup", request.url));
    }
    return NextResponse.redirect(new URL("/settings?payments=error", request.url));
  }
}
