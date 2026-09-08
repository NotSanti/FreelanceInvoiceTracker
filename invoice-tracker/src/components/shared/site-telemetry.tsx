import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** Mount only on authenticated / marketing shells — never public invoice URLs. */
export function SiteTelemetry() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
