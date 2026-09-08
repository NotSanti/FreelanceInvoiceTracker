import { NextResponse } from "next/server";

import { LIMITS } from "@/config/limits";
import { createClient } from "@/lib/supabase/server";
import { getVapidPublicKey } from "@/lib/push/env";
import {
  validatePushEndpoint,
  validatePushKeys,
} from "@/lib/push/validate-endpoint";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/lib/security/rate-limit";

type SubscribeBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

const MAX_SUBSCRIPTIONS_PER_USER = 10;

async function requireApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  return { supabase, user };
}

function readJsonBody(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { error: NextResponse.json({ error: "Unsupported content type." }, { status: 415 }) };
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { error: NextResponse.json({ error: "Request too large." }, { status: 413 }) };
  }
  return {};
}

export async function POST(request: Request) {
  if (!getVapidPublicKey()) {
    return NextResponse.json(
      { error: "Push notifications aren't configured yet." },
      { status: 503 },
    );
  }

  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const sized = readJsonBody(request, LIMITS.requestBodyBytes.pushSubscribe);
  if ("error" in sized) {
    return sized.error;
  }

  const rate = consumeRateLimit({
    key: `push-subscribe:${auth.user.id}:${clientIpFromRequest(request)}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many subscription changes." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const endpointResult = validatePushEndpoint(body.endpoint ?? "");
  if (!endpointResult.ok) {
    return NextResponse.json({ error: endpointResult.error }, { status: 400 });
  }

  const p256dh = body.keys?.p256dh?.trim() ?? "";
  const authKey = body.keys?.auth?.trim() ?? "";
  const keysResult = validatePushKeys(p256dh, authKey);
  if (!keysResult.ok) {
    return NextResponse.json({ error: keysResult.error }, { status: 400 });
  }

  const userAgentRaw = request.headers.get("user-agent");
  const userAgent =
    userAgentRaw && userAgentRaw.length <= LIMITS.pushUserAgent
      ? userAgentRaw
      : userAgentRaw
        ? userAgentRaw.slice(0, LIMITS.pushUserAgent)
        : null;

  const { data: existingForEndpoint } = await auth.supabase
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("endpoint", endpointResult.endpoint)
    .maybeSingle();

  if (existingForEndpoint && existingForEndpoint.user_id !== auth.user.id) {
    return NextResponse.json(
      { error: "Could not save the push subscription." },
      { status: 409 },
    );
  }

  const { count } = await auth.supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);

  if (
    !existingForEndpoint &&
    typeof count === "number" &&
    count >= MAX_SUBSCRIPTIONS_PER_USER
  ) {
    return NextResponse.json(
      { error: "Too many push subscriptions for this account." },
      { status: 400 },
    );
  }

  const { error } = await auth.supabase.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint: endpointResult.endpoint,
      p256dh,
      auth: authKey,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json(
      { error: "Could not save the push subscription." },
      { status: 500 },
    );
  }

  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const rate = consumeRateLimit({
    key: `push-delete:${auth.user.id}:${clientIpFromRequest(request)}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many subscription changes." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: { endpoint?: string } = {};
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = (await request.json()) as { endpoint?: string };
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();

  let query = auth.supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", auth.user.id);

  if (endpoint) {
    query = query.eq("endpoint", endpoint);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Could not remove the push subscription." },
      { status: 500 },
    );
  }

  return NextResponse.json({ removed: true });
}
