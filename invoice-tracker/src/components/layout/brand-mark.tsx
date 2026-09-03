import Link from "next/link";

import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 text-foreground", className)}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-foreground" />
      <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}
