import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/app";

export const metadata: Metadata = {
  title: "About",
  description: `About ${APP_NAME} — product overview, privacy notes, and legal information.`,
};

export default function AboutPage() {
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-foreground" aria-hidden />
        About
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
        {APP_NAME}
      </h1>
      <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
        A personal invoice and cash-flow workspace for freelancers. Create
        invoices, collect payments, and keep a simple view of what you&apos;ve
        earned and what to set aside.
      </p>

      <div className="mt-8">
        <Button asChild>
          <Link href="/login">Sign in to your workspace</Link>
        </Button>
      </div>

      <div className="mt-16 space-y-12 border-t border-border pt-12">
        <section className="space-y-3">
          <h2 className="text-lg font-medium tracking-tight">What it is</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {APP_NAME} is a private product for managing freelance invoices,
            client records, Stripe checkout links, payment history, and
            high-level tax reserves. It is not a full accounting system, CRM, or
            tax-filing service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium tracking-tight">Privacy</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Account and business data are stored in your connected Supabase
            project. Card payments are processed by Stripe; we do not store full
            card numbers. Transactional email may be sent through Resend when
            configured. Push notifications, if enabled, use your browser&apos;s
            Web Push subscription.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium tracking-tight">
            Legal &amp; copyright
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            © {year} {APP_NAME}. All rights reserved. The {APP_NAME} name, visual
            marks, and product interface are provided for authorized use of this
            workspace only. You may not copy, redistribute, or resell the
            application or its branding without permission.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Tax figures shown in the product are estimates for planning only and
            are not professional tax, legal, or accounting advice. Confirm
            amounts with a qualified advisor before filing.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Stripe, Supabase, Resend, and other third-party names are trademarks
            of their respective owners and are used only to describe
            integrations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium tracking-tight">Contact</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            For access or account questions, sign in to your workspace or reach
            the workspace owner through the email on your invoices.
          </p>
        </section>
      </div>
    </div>
  );
}
