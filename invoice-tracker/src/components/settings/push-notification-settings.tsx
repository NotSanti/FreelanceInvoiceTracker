"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getPushSubscription,
  registerPushServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client";

type Status = "loading" | "unsupported" | "disabled" | "enabled" | "denied";

export function PushNotificationSettings({
  vapidConfigured,
}: {
  vapidConfigured: boolean;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function syncStatus() {
      if (
        !vapidConfigured ||
        typeof window === "undefined" ||
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (!cancelled) {
          setStatus(vapidConfigured ? "unsupported" : "disabled");
        }
        return;
      }

      try {
        await registerPushServiceWorker();
        const subscription = await getPushSubscription();
        if (cancelled) {
          return;
        }
        if (Notification.permission === "denied") {
          setStatus("denied");
          return;
        }
        setStatus(subscription ? "enabled" : "disabled");
      } catch {
        if (!cancelled) {
          setStatus("unsupported");
        }
      }
    }

    void syncStatus();
    return () => {
      cancelled = true;
    };
  }, [vapidConfigured]);

  async function enableNotifications() {
    setPending(true);
    try {
      const keyResponse = await fetch("/api/push/vapid-public-key");
      if (!keyResponse.ok) {
        throw new Error("Push notifications aren't configured yet.");
      }
      const { publicKey } = (await keyResponse.json()) as { publicKey: string };
      const subscription = await subscribeToPush(publicKey);
      const raw = subscription.toJSON();

      const saveResponse = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: raw.endpoint,
          keys: raw.keys,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("Could not save notification preference.");
      }

      setStatus("enabled");
      toast.success("Push notifications enabled");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not enable notifications.";
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setStatus("denied");
      }
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function disableNotifications() {
    setPending(true);
    try {
      const subscription = await getPushSubscription();
      const endpoint = subscription?.endpoint;
      await unsubscribeFromPush();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setStatus("disabled");
      toast.success("Push notifications disabled");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not disable notifications.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-base font-medium">Push notifications</h2>
        <p className="text-sm text-muted-foreground">
          Get notified when a client pays an invoice through Stripe. Works when
          Independent Pocket is installed as an app and notifications are allowed.
        </p>
      </div>

      {!vapidConfigured ? (
        <p className="text-sm text-muted-foreground">
          Push notifications aren&apos;t configured on this deployment yet.
        </p>
      ) : null}

      {status === "unsupported" ? (
        <p className="text-sm text-muted-foreground">
          This browser doesn&apos;t support push notifications.
        </p>
      ) : null}

      {status === "denied" ? (
        <p className="text-sm text-muted-foreground">
          Notifications are blocked in your browser settings. Allow them for this
          site to enable alerts.
        </p>
      ) : null}

      {status === "enabled" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">Notifications are on.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void disableNotifications()}
          >
            {pending ? "Updating…" : "Turn off"}
          </Button>
        </div>
      ) : null}

      {status === "disabled" || status === "loading" ? (
        <Button
          type="button"
          size="sm"
          disabled={pending || !vapidConfigured || status === "loading"}
          onClick={() => void enableNotifications()}
        >
          {pending ? "Enabling…" : "Enable notifications"}
        </Button>
      ) : null}
    </section>
  );
}
