import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8 md:py-10 lg:px-10 lg:py-12",
        className,
      )}
    >
      {children}
    </div>
  );
}
