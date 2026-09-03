import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="relative z-20 border-b border-border/70 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <BrandMark href={user ? "/" : "/"} />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/about">About</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={user ? "/" : "/login"}>
                {user ? "Open workspace" : "Sign in"}
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Independent Pocket</p>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
            <Link
              href={user ? "/" : "/login"}
              className="hover:text-foreground"
            >
              {user ? "Workspace" : "Sign in"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
