import { formatCurrency } from "@/lib/money/format";
import { cn } from "@/lib/utils";

const sizeClassName = {
  hero: "text-[2rem] leading-none font-medium tracking-tight md:text-[2.5rem]",
  lg: "text-2xl leading-none font-medium tracking-tight",
  md: "text-lg leading-none font-medium tracking-tight",
  sm: "text-sm leading-none font-medium",
} as const;

export function MoneyValue({
  amountCents,
  currency = "CAD",
  size = "md",
  className,
}: {
  amountCents: number;
  currency?: string;
  size?: keyof typeof sizeClassName;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", sizeClassName[size], className)}>
      {formatCurrency(amountCents, currency)}
    </span>
  );
}
