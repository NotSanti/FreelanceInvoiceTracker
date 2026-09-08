import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-full">{children}</main>;
}
