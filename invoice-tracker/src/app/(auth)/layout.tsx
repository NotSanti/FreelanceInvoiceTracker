import type { ReactNode } from "react";

import { SiteTelemetry } from "@/components/shared/site-telemetry";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SiteTelemetry />
    </>
  );
}
