"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Plus } from "lucide-react";

import { signOut } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { BrandMark } from "@/components/layout/brand-mark";
import { APP_NAME } from "@/config/app";
import { primaryNav, secondaryNav } from "@/config/navigation";

function NewInvoiceButton({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <Button asChild size="sm" className={className}>
      <Link href="/invoices/new" onClick={onNavigate}>
        <Plus />
        New invoice
      </Link>
    </Button>
  );
}

function NavigationSections({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <nav aria-label="Main">
        <SidebarNav items={primaryNav} onNavigate={onNavigate} />
      </nav>
      <Separator className="my-5" />
      <nav aria-label="Workspace">
        <SidebarNav items={secondaryNav} onNavigate={onNavigate} />
      </nav>
    </>
  );
}

function AccountFooter({
  accountLabel,
  onNavigate,
}: {
  accountLabel: string;
  onNavigate?: () => void;
}) {
  const initial = accountLabel.slice(0, 1).toUpperCase() || "A";

  return (
    <div className="space-y-1">
      <Link
        href="/settings"
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full bg-surface-secondary text-[11px] font-medium"
        >
          {initial}
        </span>
        <span className="truncate text-sm">{accountLabel}</span>
      </Link>
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
        >
          Sign out
        </Button>
      </form>
    </div>
  );
}

export function DesktopSidebar({ accountLabel }: { accountLabel: string }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
      <div className="px-2.5">
        <BrandMark />
      </div>
      <div className="mt-6 px-0.5">
        <NewInvoiceButton className="w-full justify-start" />
      </div>
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <NavigationSections />
        <div className="mt-auto">
          <AccountFooter accountLabel={accountLabel} />
        </div>
      </div>
    </aside>
  );
}

export function MobileChrome({ accountLabel }: { accountLabel: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          <BrandMark />
        </div>
        <NewInvoiceButton />
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="border-b border-sidebar-border px-5 py-4">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-foreground"
              />
              {APP_NAME}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Navigate between overview, invoices, clients, taxes, and settings.
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col px-3 py-4">
            <div className="mb-4 px-0.5">
              <NewInvoiceButton
                className="w-full justify-start"
                onNavigate={() => setOpen(false)}
              />
            </div>
            <NavigationSections onNavigate={() => setOpen(false)} />
            <div className="mt-auto">
              <AccountFooter
                accountLabel={accountLabel}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
