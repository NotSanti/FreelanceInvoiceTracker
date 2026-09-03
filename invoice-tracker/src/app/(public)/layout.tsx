import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-background">
      <main>{children}</main>
    </div>
  );
}
