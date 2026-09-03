"use client";

import { motion, useReducedMotion } from "motion/react";

import { Gauge } from "@/components/charts/gauge";
import { formatCurrency } from "@/lib/money/format";

/** Matches Gauge arc defaults: endAngle 405° → 45° in SVG space. */
const ARC_END_ANGLE_RAD = (45 * Math.PI) / 180;
/** Matches GaugeArcInner outerRadius = size * 0.42 */
const ARC_OUTER_RADIUS_RATIO = 0.42;
/** Gauge responsive shell uses aspect-[21/16]; width ≥ height so size = height. */
const GAUGE_ASPECT_HEIGHT_OVER_WIDTH = 16 / 21;
/** Matches Gauge default totalNotches (40) and bg delay: index * 0.015 */
const LAST_NOTCH_ENTER_DELAY = 39 * 0.015;

function progressPercent(receivedCents: number, projectedCents: number) {
  if (projectedCents <= 0) {
    return receivedCents > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((receivedCents / projectedCents) * 100));
}

export function ReceivedProjectedGauge({
  receivedCents,
  projectedNetCents,
  currency,
}: {
  receivedCents: number;
  projectedNetCents: number;
  currency: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const value = progressPercent(receivedCents, projectedNetCents);
  const receivedMajor = receivedCents / 100;

  // Tip of the last notch, as % of the gauge shell, then nudge right of the tip.
  const tipLeftPercent =
    (0.5 +
      Math.cos(ARC_END_ANGLE_RAD) *
        ARC_OUTER_RADIUS_RATIO *
        GAUGE_ASPECT_HEIGHT_OVER_WIDTH) *
    100;
  const tipTopPercent =
    (0.5 + Math.sin(ARC_END_ANGLE_RAD) * ARC_OUTER_RADIUS_RATIO) * 100;

  return (
    <section
      aria-label="Received income versus projected net income"
      className="relative mx-auto w-full max-w-md overflow-visible"
    >
      <Gauge
        value={value}
        centerValue={receivedMajor}
        defaultLabel="Received"
        spacing={22}
        inactiveFillOpacity={0.35}
        className="w-full"
        formatOptions={{
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }}
      />
      <motion.p
        className="pointer-events-none absolute whitespace-nowrap pl-2 text-sm tabular-nums text-muted-foreground"
        style={{
          left: `${tipLeftPercent}%`,
          top: `${tipTopPercent}%`,
        }}
        initial={
          prefersReducedMotion ? false : { opacity: 0, scale: 0.85, y: "-50%" }
        }
        animate={{ opacity: 1, scale: 1, y: "-50%" }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : {
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: LAST_NOTCH_ENTER_DELAY,
              }
        }
      >
        <span className="sr-only">Projected net </span>
        {formatCurrency(projectedNetCents, currency)}
      </motion.p>
    </section>
  );
}
