import type { ReactNode } from "react";
import { Suspense } from "react";

import {
  DesktopSidebar,
  MobileChrome,
} from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { FlashToast } from "@/components/shared/flash-toast";
import { getAccountLabel, getProfile, requireUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser();
  const profile = await getProfile();

  return (
    <div className="flex min-h-full">
      <DesktopSidebar accountLabel={getAccountLabel(profile)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileChrome accountLabel={getAccountLabel(profile)} />
        <main className="flex-1">{children}</main>
      </div>
      <ServiceWorkerRegister />
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
    </div>
  );
}
