"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  FLASH_TOAST_MESSAGES,
  isFlashToastKey,
} from "@/lib/flash-toast";

export function FlashToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const shownKey = useRef<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("toast");
    if (!key || !isFlashToastKey(key)) {
      return;
    }
    if (shownKey.current === key) {
      return;
    }
    shownKey.current = key;

    toast.success(FLASH_TOAST_MESSAGES[key]);

    const next = new URLSearchParams(searchParams.toString());
    next.delete("toast");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
