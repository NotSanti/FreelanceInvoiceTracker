import Link from "next/link";

import { cn } from "@/lib/utils";

export function YearToggle({
  year,
  years,
}: {
  year: number;
  years: number[];
}) {
  return (
    <nav aria-label="Tax year" className="flex gap-1">
      {years.map((option) => {
        const href = option === years[years.length - 1] ? "/taxes" : `/taxes?year=${option}`;
        const current = option === year;

        return (
          <Link
            key={option}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
              current && "bg-secondary text-foreground",
            )}
          >
            {option}
          </Link>
        );
      })}
    </nav>
  );
}
