"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";

const DEMO_INVOICES = [
  { number: "INV-1042", client: "North Studio", amount: "CA$1,840", status: "Paid", tone: "paid" },
  { number: "INV-1043", client: "Cedar Co.", amount: "CA$960", status: "Sent", tone: "sent" },
  { number: "INV-1044", client: "Atelier Lune", amount: "CA$2,100", status: "Overdue", tone: "overdue" },
] as const;

const statusTone: Record<(typeof DEMO_INVOICES)[number]["tone"], string> = {
  paid: "bg-positive/10 text-positive",
  sent: "bg-secondary text-foreground/80",
  overdue: "bg-negative/10 text-negative",
};

function MiniGauge() {
  return (
    <div className="relative mx-auto w-[9.5rem]">
      <svg viewBox="0 0 200 150" className="w-full" aria-hidden>
        {Array.from({ length: 24 }, (_, index) => {
          const start = 135;
          const sweep = 270;
          const angle = start + (sweep * index) / 23;
          const rad = (angle * Math.PI) / 180;
          const cx = 100;
          const cy = 100;
          const outer = 78;
          const inner = 58;
          const half = 0.04;
          const a1 = rad - half;
          const a2 = rad + half;
          const active = index < 14;
          return (
            <path
              key={angle}
              d={`M ${cx + Math.cos(a1) * outer} ${cy + Math.sin(a1) * outer}
                  L ${cx + Math.cos(a2) * outer} ${cy + Math.sin(a2) * outer}
                  L ${cx + Math.cos(a2) * inner} ${cy + Math.sin(a2) * inner}
                  L ${cx + Math.cos(a1) * inner} ${cy + Math.sin(a1) * inner} Z`}
              fill={active ? "var(--positive)" : "var(--border-strong)"}
              fillOpacity={active ? 0.9 : 0.4}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-5 text-center">
        <p className="text-[0.95rem] font-semibold tabular-nums leading-none tracking-tight">
          CA$2,877
        </p>
        <p className="mt-1 text-[0.55rem] text-muted-foreground">Received</p>
      </div>
    </div>
  );
}

function DashboardScreen() {
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <div>
          <p className="text-[0.65rem] font-medium tracking-tight">Overview</p>
          <p className="text-[0.55rem] text-muted-foreground">This month</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-0.5 text-[0.5rem]">
          <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-background">
            Month
          </span>
          <span className="px-1.5 py-0.5 text-muted-foreground">Year</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
        <MiniGauge />
        <p className="mt-1 text-right text-[0.5rem] tabular-nums text-muted-foreground">
          of CA$5,176 projected
        </p>

        <div className="mt-4">
          <p className="text-xl font-semibold tabular-nums tracking-tight">
            CA$5,176
          </p>
          <p className="mt-0.5 text-[0.6rem] text-muted-foreground">
            Projected net income
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div>
            <p className="text-sm font-medium tabular-nums tracking-tight">
              CA$2,877
            </p>
            <p className="mt-0.5 text-[0.55rem] text-muted-foreground">Received</p>
          </div>
          <div>
            <p className="text-sm font-medium tabular-nums tracking-tight">
              CA$2,299
            </p>
            <p className="mt-0.5 text-[0.55rem] text-muted-foreground">
              Outstanding
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="text-sm font-medium tabular-nums tracking-tight">
            CA$1,140
          </p>
          <p className="mt-0.5 text-[0.55rem] text-muted-foreground">
            Estimated tax reserve
          </p>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[0.65rem] font-medium">Needs attention</p>
          <ul className="space-y-2">
            {DEMO_INVOICES.map((invoice) => (
              <li
                key={invoice.number}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[0.6rem] font-medium tabular-nums">
                    {invoice.number}
                  </p>
                  <p className="truncate text-[0.5rem] text-muted-foreground">
                    {invoice.client}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <p className="text-[0.55rem] tabular-nums">{invoice.amount}</p>
                  <span
                    className={`rounded-full px-1.5 py-px text-[0.45rem] font-medium ${statusTone[invoice.tone]}`}
                  >
                    {invoice.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DashboardPhoneDemo() {
  return (
    <div
      aria-hidden
      className="mx-auto w-full max-w-[280px] lg:ml-auto lg:mr-2"
    >
      <div className="relative rounded-[2rem] border border-border bg-foreground/95 p-[0.55rem] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)]">
        <div className="relative overflow-hidden rounded-[1.55rem] bg-background">
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
            <div className="h-4 w-20 rounded-full bg-foreground/90" />
          </div>
          <div className="h-[34rem] pt-7">
            <DashboardScreen />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingHomeHero() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative isolate min-h-[calc(100svh-3.5rem)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_28%,color-mix(in_oklch,var(--positive)_16%,transparent),transparent_52%),radial-gradient(ellipse_at_12%_88%,color-mix(in_oklch,var(--foreground)_5%,transparent),transparent_48%),linear-gradient(165deg,var(--background),color-mix(in_oklch,var(--surface-secondary)_75%,var(--background)))]" />

      <div className="relative mx-auto grid min-h-[calc(100svh-3.5rem)] w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:gap-12 lg:py-20">
        <div className="max-w-xl">
          <motion.p
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <span className="size-2 rounded-full bg-foreground" aria-hidden />
            Personal freelance workspace
          </motion.p>

          <motion.h1
            className="mt-5 text-[clamp(2.75rem,9vw,5.5rem)] font-semibold leading-[0.95] tracking-tight text-foreground"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.06,
            }}
          >
            {APP_NAME}
          </motion.h1>

          <motion.p
            className="mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.14 }}
          >
            Invoices, payments, and projected income in one calm place — built
            for freelancers who want clarity, not another accounting suite.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center gap-3"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.22 }}
          >
            <Button asChild size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">About the product</Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.75,
            ease: [0.22, 1, 0.36, 1],
            delay: 0.16,
          }}
        >
          <DashboardPhoneDemo />
        </motion.div>
      </div>
    </section>
  );
}
