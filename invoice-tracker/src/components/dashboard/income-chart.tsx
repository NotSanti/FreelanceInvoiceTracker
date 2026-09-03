"use client";

import { useMemo } from "react";
import { curveMonotoneX } from "@visx/curve";

import { Area } from "@/components/charts/area";
import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { TooltipContent } from "@/components/charts/tooltip/tooltip-content";
import { formatMonthShort, formatMonthYear } from "@/lib/dates";
import type { ChartMonth } from "@/lib/dashboard/metrics";
import { formatCurrency } from "@/lib/money/format";

const INCOME_STROKE = "var(--chart-line-primary)";
const PROJECTED_STROKE =
  "color-mix(in oklch, var(--chart-line-primary) 55%, white)";

export function IncomeChart({
  months,
  currency,
}: {
  months: ChartMonth[];
  currency: string;
}) {
  const data = useMemo(
    () =>
      months.map((month) => ({
        date: new Date(`${month.month}T12:00:00`),
        income: month.incomeCents / 100,
        projected: month.projectedIncomeCents / 100,
        monthKey: month.month,
      })),
    [months],
  );

  const hasActivity = months.some(
    (month) => month.incomeCents > 0 || month.projectedIncomeCents > 0,
  );

  return (
    <figure className="space-y-3">
      <figcaption className="flex justify-end">
        <ul className="flex gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: INCOME_STROKE }}
              aria-hidden
            />
            Income
          </li>
          <li className="flex items-center gap-2">
            <span
              className="h-px w-3 border-t border-dashed"
              style={{ borderColor: PROJECTED_STROKE }}
              aria-hidden
            />
            Projected
          </li>
        </ul>
      </figcaption>

      <div className="w-full">
        <LineChart
          data={data}
          aspectRatio="3 / 1"
          margin={{ top: 8, right: 4, bottom: 40, left: 4 }}
          animationDuration={900}
          className="w-full"
        >
          <Area
            dataKey="projected"
            fill={PROJECTED_STROKE}
            fillOpacity={0.18}
            gradientToOpacity={0}
            showLine={false}
            showHighlight={false}
            curve={curveMonotoneX}
          />
          <Area
            dataKey="income"
            fill={INCOME_STROKE}
            fillOpacity={0.32}
            gradientToOpacity={0}
            showLine={false}
            showHighlight={false}
            curve={curveMonotoneX}
            fadeEdges
          />
          <Line
            dataKey="projected"
            stroke={PROJECTED_STROKE}
            strokeWidth={2}
            curve={curveMonotoneX}
            fadeEdges
            showHighlight={false}
            dashFromIndex={hasActivity ? 0 : undefined}
            dashArray="5,5"
          />
          <Line
            dataKey="income"
            stroke={INCOME_STROKE}
            strokeWidth={2.5}
            curve={curveMonotoneX}
            fadeEdges
          />
          <XAxis numTicks={Math.min(6, Math.max(months.length, 1))} />
          <ChartTooltip
            showDatePill={false}
            indicatorColor={INCOME_STROKE}
            content={({ point }) => {
              const monthKey =
                typeof point.monthKey === "string"
                  ? point.monthKey
                  : point.date instanceof Date
                    ? point.date.toISOString().slice(0, 10)
                    : "";
              const incomeCents = Math.round(Number(point.income ?? 0) * 100);
              const projectedCents = Math.round(
                Number(point.projected ?? 0) * 100,
              );

              return (
                <TooltipContent
                  title={monthKey ? formatMonthYear(monthKey) : undefined}
                  rows={[
                    {
                      color: INCOME_STROKE,
                      label: "Income",
                      value: formatCurrency(incomeCents, currency),
                    },
                    {
                      color: PROJECTED_STROKE,
                      label: "Projected",
                      value: formatCurrency(projectedCents, currency),
                    },
                  ]}
                />
              );
            }}
          />
        </LineChart>
      </div>

      <table className="sr-only">
        <caption>Monthly income and projected income</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Income</th>
            <th>Projected</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <td>{formatMonthShort(month.month)}</td>
              <td>{formatCurrency(month.incomeCents, currency)}</td>
              <td>{formatCurrency(month.projectedIncomeCents, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
