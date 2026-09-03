import type { Metadata } from "next";

import { MarketingHomeHero } from "@/components/marketing/marketing-home-hero";
import { APP_DESCRIPTION, APP_NAME } from "@/config/app";

export const metadata: Metadata = {
  title: {
    absolute: APP_NAME,
  },
  description: APP_DESCRIPTION,
};

export default function MarketingHomePage() {
  return (
    <>
      <MarketingHomeHero />

      <section className="border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:grid-cols-3 sm:gap-10">
          <Feature
            title="Send polished invoices"
            description="Draft, email with PDF, and share a public pay link — without the CRM clutter."
          />
          <Feature
            title="See money clearly"
            description="Received, outstanding, and projected net income stay front and center on your overview."
          />
          <Feature
            title="Stay tax-aware"
            description="GST/QST and reserve estimates help you set money aside as payments come in."
          />
        </div>
      </section>
    </>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
