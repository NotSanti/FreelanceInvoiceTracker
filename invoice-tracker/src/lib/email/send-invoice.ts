import { Resend } from "resend";

import {
  formatFromAddress,
  formatReplyToAddress,
  getEmailEnv,
} from "@/lib/email/env";

export async function sendInvoiceEmail({
  businessName,
  replyTo,
  to,
  subject,
  message,
  html,
  filename,
  pdf,
}: {
  businessName: string;
  replyTo: string;
  to: string;
  subject: string;
  message: string;
  html: string;
  filename: string;
  pdf: Buffer;
}) {
  const env = getEmailEnv();
  if ("error" in env) {
    return env;
  }

  const replyToAddress = formatReplyToAddress(businessName, replyTo);
  if (!replyToAddress) {
    return { error: "Add an account email before sending invoices." } as const;
  }

  const resend = new Resend(env.apiKey);
  const { data, error } = await resend.emails.send({
    from: formatFromAddress(businessName, env.from),
    to,
    replyTo: replyToAddress,
    subject,
    text: message,
    html,
    attachments: [
      {
        filename,
        content: pdf,
      },
    ],
  });

  if (error) {
    return { error: error.message || "The email could not be sent." } as const;
  }

  if (!data?.id) {
    return { error: "The email could not be sent." } as const;
  }

  return { id: data.id } as const;
}
