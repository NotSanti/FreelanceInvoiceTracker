"use client";

import { useMemo } from "react";

import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";
import type { InvoiceStatusBreakdownItem } from "@/lib/dashboard/metrics";

export function InvoiceStatusChart({
  statuses,
}: {
  statuses: InvoiceStatusBreakdownItem[];
}) {
  const total = useMemo(
    () => statuses.reduce((sum, status) => sum + status.count, 0),
    [statuses],
  );

  const data = useMemo(
    () =>
      statuses.map((status) => ({
        label: status.label,
        value: status.count,
        maxValue: Math.max(total, 1),
        color: status.color,
      })),
    [statuses, total],
  );

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Create an invoice to see status tracking here.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="mx-auto size-[200px] shrink-0 sm:mx-0">
        <RingChart
          data={data}
          size={200}
          strokeWidth={10}
          ringGap={5}
          baseInnerRadius={42}
          className="size-full"
        >
          {data.map((item, index) => (
            <Ring key={item.label} index={index} showGlow={false} />
          ))}
          <RingCenter defaultLabel="Invoices" />
        </RingChart>
      </div>

      <ul className="w-full space-y-2.5 text-sm">
        {statuses.map((status) => {
          const percent =
            total > 0 ? Math.round((status.count / total) * 100) : 0;

          return (
            <li
              key={status.key}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: status.color }}
                  aria-hidden
                />
                {status.label}
              </span>
              <span className="tabular-nums text-foreground">
                {status.count}
                <span className="ml-2 text-muted-foreground">{percent}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
