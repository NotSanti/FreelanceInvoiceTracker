import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getVapidPublicKey } from "@/lib/push/env";

type SubscribeBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

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

  const body = (await request.json()) as SubscribeBody;
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const authKey = body.keys?.auth?.trim();

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json(
      { error: "Incomplete push subscription." },
      { status: 400 },
    );
  }

  const { error } = await auth.supabase.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: request.headers.get("user-agent"),
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

  const body = (await request.json().catch(() => ({}))) as {
    endpoint?: string;
  };
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
