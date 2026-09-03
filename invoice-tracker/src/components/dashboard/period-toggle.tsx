import Link from "next/link";

import { DASHBOARD_PERIODS, type DashboardPeriodKind } from "@/config/dashboard";
import { cn } from "@/lib/utils";

export function PeriodToggle({ period }: { period: DashboardPeriodKind }) {
  return (
    <nav aria-label="Dashboard period" className="flex gap-1">
      {DASHBOARD_PERIODS.map((option) => {
        const href = option.value === "year" ? "/?period=year" : "/";
        const current = option.value === period;

        return (
          <Link
            key={option.value}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
              current && "bg-secondary text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
