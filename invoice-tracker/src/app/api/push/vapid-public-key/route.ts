import { NextResponse } from "next/server";

import { getVapidPublicKey } from "@/lib/push/env";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Push notifications aren't configured yet." },
      { status: 503 },
    );
  }

  return NextResponse.json({ publicKey });
}
