import {
  MONTH_CHART_MONTHS,
  type DashboardPeriodKind,
} from "@/config/dashboard";

export type { DashboardPeriodKind };
import {
  addMonthsISO,
  endOfMonthISO,
  endOfYearISO,
  formatMonthYear,
  startOfMonthISO,
  startOfYearISO,
} from "@/lib/dates";

export type DashboardPeriod = {
  kind: DashboardPeriodKind;
  start: string;
  end: string;
  label: string;
  chartMonths: string[];
};

export function readDashboardPeriod(
  value: string | string[] | undefined,
): DashboardPeriodKind {
  const period = Array.isArray(value) ? value[0] : value;
  return period === "year" ? "year" : "month";
}

export function resolveDashboardPeriod(
  kind: DashboardPeriodKind,
  today: string,
): DashboardPeriod {
  if (kind === "year") {
    const start = startOfYearISO(today);
    return {
      kind,
      start,
      end: endOfYearISO(today),
      label: today.slice(0, 4),
      chartMonths: monthsFrom(start, 12),
    };
  }

  const start = startOfMonthISO(today);
  return {
    kind,
    start,
    end: endOfMonthISO(today),
    label: formatMonthYear(today),
    chartMonths: monthsFrom(addMonthsISO(start, -(MONTH_CHART_MONTHS - 1)), MONTH_CHART_MONTHS),
  };
}

function monthsFrom(start: string, count: number) {
  return Array.from({ length: count }, (_, index) => addMonthsISO(start, index));
}
