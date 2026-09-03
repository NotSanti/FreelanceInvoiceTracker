import { after } from "next/server";
import { track } from "@vercel/analytics/server";

export const AnalyticsEvent = {
  SignIn: "Sign In",
  AccountCreated: "Account Created",
  ClientCreated: "Client Created",
  InvoiceCreated: "Invoice Created",
  InvoiceSent: "Invoice Sent",
  InvoiceVoided: "Invoice Voided",
  InvoiceDuplicated: "Invoice Duplicated",
  InvoicePaid: "Invoice Paid",
  PaymentRecorded: "Payment Recorded",
} as const;

type EventProperties = Record<string, string | number | boolean | null | undefined>;

/** Fire-and-forget product event. Never blocks the response or fails the action. */
export function trackEvent(name: string, properties?: EventProperties) {
  after(() => {
    void track(name, properties).catch(() => {
      // Analytics must never fail a completed user action.
    });
  });
}
