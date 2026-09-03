import {
  formatFromAddress,
  formatReplyToAddress,
  getEmailEnv,
} from "@/lib/email/env";
import { formatCurrency } from "@/lib/money/format";
import { Resend } from "resend";

export async function sendOwnerPaymentEmail({
  to,
  businessName,
  invoiceNumber,
  amountCents,
  currency,
}: {
  to: string;
  businessName: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
}) {
  const env = getEmailEnv();
  if ("error" in env) {
    return env;
  }

  const resend = new Resend(env.apiKey);
  const amount = formatCurrency(amountCents, currency);
  const subject = `Invoice ${invoiceNumber} was paid`;
  const text = `Invoice ${invoiceNumber} was paid.\n${amount}\n`;
  const replyTo = formatReplyToAddress(businessName, to);

  const { error } = await resend.emails.send({
    from: formatFromAddress(businessName, env.from),
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
  });

  if (error) {
    return { error: error.message || "The payment notice could not be sent." } as const;
  }

  return { sent: true } as const;
}
