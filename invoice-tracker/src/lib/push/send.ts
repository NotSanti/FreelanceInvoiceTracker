import webpush from "web-push";

import { getPushEnv } from "@/lib/push/env";
import { createServiceClient } from "@/lib/supabase/service";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function toWebPushSubscription(row: PushSubscriptionRow) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const env = getPushEnv();
  if ("error" in env) {
    return { skipped: env.error } as const;
  }

  webpush.setVapidDetails(env.subject, env.publicKey, env.privateKey);

  const supabase = createServiceClient();
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    return { error: "Could not load push subscriptions." } as const;
  }

  if (!subscriptions?.length) {
    return { sent: 0 } as const;
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    icon: payload.icon ?? "/icons/icon-192.png",
  });

  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), body);
        sent += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
            ? error.statusCode
            : null;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscription.id);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent } as const;
}
