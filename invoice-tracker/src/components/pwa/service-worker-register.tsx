"use client";

import { useEffect } from "react";

import { registerPushServiceWorker } from "@/lib/push/client";

/** Registers the PWA service worker once the dashboard shell mounts. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void registerPushServiceWorker().catch(() => {
      // Registration is best-effort; settings surface errors when enabling push.
    });
  }, []);

  return null;
}
